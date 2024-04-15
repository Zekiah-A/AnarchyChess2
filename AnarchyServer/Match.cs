using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net.WebSockets;
using System.Text;
using AnarchyServer.DataModel;
using DataProto;
using Timer = System.Timers.Timer;

namespace AnarchyServer;

public class Match
{
    public int Id;
    public DateTime CreatedDate;
    public int Capacity;
    public string Name;
    public bool Started;
    public int HostId;
    public IReadOnlyList<ClientData> Players { get => players; }
    public bool AdvertisePublic;
    public Ruleset Ruleset;
    public Arrangement Arrangement;

    private int currentTurn = -1;
    private TimeSpan turnDuration;
    private DateTimeOffset turnStart;

    private readonly Random random;
    private readonly Piece?[,] board;
    private readonly JsonArray rulesJsonArray;
    private readonly List<ClientData> players;
    private readonly JsonSerializerOptions jsonOptions;
    private delegate void BinaryPacketHandler(ClientData fromClient, ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;
    private readonly List<string> colours = [ "white", "black" ];
    private readonly List<string> validPromotions = ["rook", "knight", "bishop", "queen"];
    private readonly Timer turnTimer;

    public Match(int matchId, int hostId, string name, int capacity, Ruleset ruleset, Arrangement arrangement, bool advertisePublic)
    {
        Id = matchId;
        CreatedDate = DateTime.Now;
        Name = name;
        Capacity = capacity;
        Ruleset = ruleset;
        Arrangement = arrangement;
        HostId = hostId;
        AdvertisePublic = advertisePublic;

        players = new List<ClientData>();
        jsonOptions = new JsonSerializerOptions()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        binaryPacketHandlers = new Dictionary<int, BinaryPacketHandler>()
        {
            { 0, HandlePieceMoves },
            { 1, HandleMove },
            { 2, HandlePromote }
        };
        random = new Random();
        board = new Piece[arrangement.Columns, arrangement.Rows];

        var arrangementData = JsonNode.Parse(arrangement.Data);
        if (arrangementData is not JsonArray arrangementColumns)
        {
            throw new InvalidDataException("Couldn't parse arrangement data (invalid columns data)");
        }
        for (var column = 0; column < arrangement.Columns; column++)
        {
            for (var row = 0; row < arrangement.Rows; row++)
            {
                var pieceData = arrangementData[row * arrangement.Columns + column];
                if (pieceData is not JsonObject pieceObject)
                {
                    continue;
                }
                var type = pieceObject["type"]?.GetValue<string>();
                var colour = pieceObject["colour"]?.GetValue<string>();
                if (type is null || colour is null)
                {
                    continue;
                }
                var piece = new Piece(type, colour);
                board[column, row] = piece;
            }
        }
        
        var ruleData = JsonNode.Parse(Ruleset.Data);
        if (ruleData is not JsonArray ruleArray)
        {
            throw new InvalidDataException("Couldn't parse rules data");
        }
        rulesJsonArray = ruleArray;
        
        turnDuration = TimeSpan.FromSeconds(30);
        turnTimer = new Timer(turnDuration.TotalMilliseconds);
        turnTimer.AutoReset = false;
        turnTimer.Elapsed += (_, _) => ProceedNextTurn();
    }

    public void AddPlayer(ClientData player)
    {
        players.Add(player);
        if (players.Count == Capacity)
        {
            StartMatch();
        }
    }

    private void StartMatch()
    {
        // Start match
        Started = true;
        // Send match info
        var matchInfo = new WriteablePacket();
        matchInfo.WriteByte(OutgoingCodes.MatchInfo);
        matchInfo.WriteByte((byte) Arrangement.Columns);
        matchInfo.WriteByte((byte) Arrangement.Rows);
        matchInfo.WriteInt(Ruleset.Id);
        matchInfo.WriteInt(Arrangement.Id);
        SendPacketToAll(ref matchInfo);

        // Setup and send player info
        var startingColour = "white";
        foreach (var ruleJson in rulesJsonArray)
        {
            if (ruleJson is null || ruleJson["condixtion"]?.GetValue<string>() != "matchStart")
            {
                continue;
            }
            var action = ruleJson["action"];
            if (action is null || action["type"]?.GetValue<string>() != "setCurrentTurn")
            {
                continue;
            }
            startingColour = action["turnColour"]?.GetValue<string>();
        }
        startingColour ??= "white";
        currentTurn = random.Next(0, Players.Count);
        players[currentTurn].Colour = startingColour;
        colours.Remove(startingColour);

        DistributePlayerInfos();
        
        // Send current turn and time remaining before skip turn
        var turnInfo = new WriteablePacket();
        turnInfo.WriteByte(OutgoingCodes.CurrentTurn);
        turnInfo.WriteByte((byte) currentTurn);
        
        turnInfo.WriteUInt((uint) turnDuration.TotalMilliseconds);
        SendPacketToAll(ref turnInfo);
        
        turnTimer.Start();
    }
    
    private void DistributePlayerInfos()
    {
        // Set up info for all other players
        var playerInfo = new WriteablePacket();
        playerInfo.WriteByte(OutgoingCodes.PlayerInfo);
        playerInfo.WriteByte((byte) Players.Count);
        var i = 0;
        for (var playerI = 0; playerI < Players.Count; playerI++)
        {
            var player = Players[playerI];
            // Current turn also is starting colour
            if (playerI != currentTurn)
            {
                var colour = colours[i % colours.Count];
                player.Colour = colour;
                i++;
            }
            playerInfo.WriteInt(player.Account.Id);
            playerInfo.WriteString(player.Colour);
        }
        SendPacketToAll(ref playerInfo);
    }

    private void ProceedNextTurn()
    {
        turnTimer.Stop();
        currentTurn = (currentTurn + 1) % players.Count;
        
        // If all of new turn's kings are in check & can't make any more moves, then checkmate
        var currentColour = players[currentTurn].Colour;
        if (AllKingsInCheck(currentColour))
        {
            var colourKingCanMove = true;
            foreach (var location in GetPieceLocations("king", currentColour))
            {
                var kingPiece = board[location.Column, location.Row]!;
                var kingMoves = FindAllPieceMoves(location.Column, location.Row, kingPiece);
                if (kingMoves.Count > 0)
                {
                    colourKingCanMove = true;
                }
            }
            // None of our colour's kings can move - checkmate
            if (!colourKingCanMove)
            {
                foreach (var client in players.ToList())
                {
                    _ =  client.CloseAsync(WebSocketCloseStatus.NormalClosure,
                        $"Match ended - {currentColour} was checkmated.");
                }
                return;
            }
        }

        // Send new turn to all players
        var turnInfo = new WriteablePacket();
        turnInfo.WriteByte(OutgoingCodes.CurrentTurn);
        turnInfo.WriteByte((byte) currentTurn);
        turnDuration = TimeSpan.FromSeconds(30);
        turnInfo.WriteUInt((uint) turnDuration.TotalMilliseconds);
        SendPacketToAll(ref turnInfo);
        
        // Schedule a new turn change after turn period
        turnTimer.Start();
    }
    
    private void SendPacketToAll(ref WriteablePacket data)
    {
        var playerList = Players.ToList();
        var sendTasks = new Task[playerList.Count];
        for (var i = 0; i < playerList.Count; i++)
        {
            var player = players[i];
            sendTasks[i] = player.SendAsync(data, WebSocketMessageType.Binary);
        }
        Task.WaitAll(sendTasks);
    }

    public async Task RemovePlayer(ClientData player)
    {
        players.Remove(player);
        if (Started)
        {
            if (players.Count < 2)
            {
                // Game can not continue with less than 2 players - Stop match
                foreach (var client in players.ToList())
                {
                    await client.CloseAsync(WebSocketCloseStatus.NormalClosure,
                        "Match ended - Not enough players left to continue match");
                }
            }
            else
            {
                // Game can continue but turns need to be amended
                currentTurn %= players.Count;
                DistributePlayerInfos();
            }
        }
    }

    public void CallHandlerDelegate(ClientData fromClient, ReceivedMessage message)
    {
        if (message.MessageType == WebSocketMessageType.Text)
        {
            var stringMessage = Encoding.UTF8.GetString(message.Data);
            HandleChatMessage(fromClient, stringMessage);
            return;
        }

        var packet = new ReadablePacket(message.Data);
        var code = packet.ReadByte();

        if (binaryPacketHandlers.TryGetValue(code, out var handler))
        {
            handler(fromClient, ref packet);
        }
    }

    private void HandleChatMessage(ClientData fromClient, string message)
    {
        // Format message to include name of sender, etc, then send as a JSON object, reject empty chat messages
        var trimmed = message.Trim();
        if (trimmed.Length == 0)
        {
            return;
        }
        var truncated = trimmed.Length > 96 ? trimmed[..96] : trimmed;
        var messageData = new { UserId = fromClient.Account.Id, Message = truncated };
        var formatted = JsonSerializer.Serialize(messageData, jsonOptions);
        var encoded = Encoding.UTF8.GetBytes(formatted);

        // Iterate and send chat message to all other connected clients
        foreach (var client in Players.ToList())
        {
            _ = client.SendAsync(encoded, WebSocketMessageType.Text);
        }
    }

    private List<PieceLocation> FindAllRookMoves(int column, int row)
    {
        var locations = new List<PieceLocation>();
        var columns = board.GetLength(0);
        for (var x = column - columns; x < column + columns; x++)
        {
            if (x != column)
            {
                locations.Add(new PieceLocation(x, row));
            }
        }
        var rows = board.GetLength(1);
        for (var y = row - rows; y < row + rows; y++)
        {
            if (y != row)
            {
                locations.Add(new PieceLocation(column, y));
            }
        }
        return locations;
    }

    private List<PieceLocation> FindAllBishopMoves(int column, int row)
    {
        var locations = new List<PieceLocation>();
        var columns = board.GetLength(0);
        for (var x = column - columns; x < column + columns; x++)
        {
            if (x == column)
            {
                continue;
            }
            var diagonalDownY = row + (x - column);
            locations.Add(new PieceLocation(x, diagonalDownY));
            var diagonalUpY = row - (x - column);
            locations.Add(new PieceLocation(x, diagonalUpY));
        }
        return locations;
    }

    /// <summary>
    /// Returns a list of all possible locations a piece could move to, regardless of
    /// the validity of such a location. This includes locations that could possibly
    /// fall outside the bounds of the chess board.
    /// </summary>
    private List<PieceLocation> FindAllPieceMoves(int column, int row, Piece piece)
    {
        switch (piece.Type)
        {
            case "pawn":
            {
                if (piece.Colour == "white")
                {
                    var locations = new List<PieceLocation>()
                    {
                        new PieceLocation(column - 1, row - 1),
                        new PieceLocation(column + 1, row - 1),
                        new PieceLocation(column, row - 1),
                        new PieceLocation(column, row - 2)
                    };
                    return locations;
                }
                else if (piece.Colour == "black")
                {
                    var locations = new List<PieceLocation>()
                    {
                        new PieceLocation(column - 1, row + 1),
                        new PieceLocation(column + 1, row + 1),
                        new PieceLocation(column, row + 1),
                        new PieceLocation(column, row + 2)
                    };
                    return locations;
                }
                break;
            }
            case "bishop":
            {
                return FindAllBishopMoves(column, row);
            }
            case "king":
            {
                var locations = new List<PieceLocation>()
                {
                    // Top row:    x x x
                    new PieceLocation(column - 1, row + 1),
                    new PieceLocation(column, row + 1),
                    new PieceLocation(column + 1, row + 1),
                    // Middle row: x   x
                    new PieceLocation(column - 1, row),
                    new PieceLocation(column + 1, row),
                    // Bottom row: x x x
                    new PieceLocation(column - 1, row - 1),
                    new PieceLocation(column, row - 1),
                    new PieceLocation(column + 1, row - 1),
                };
                return locations;
            }
            case "knight":
            {
                var locations = new List<PieceLocation>()
                {
                    new PieceLocation(column + 1, row + 2),
                    new PieceLocation(column + 2, row + 1),
                    new PieceLocation(column + 2, row - 1),
                    new PieceLocation(column + 1, row - 2),
                    new PieceLocation(column - 1, row - 2),
                    new PieceLocation(column - 2, row - 1),
                    new PieceLocation(column - 2, row + 1),
                    new PieceLocation(column - 1, row + 2)
                };
                return locations;
            }
            case "queen":
            {
                var locations = new List<PieceLocation>();
                locations.AddRange(FindAllRookMoves(column, row));
                locations.AddRange(FindAllBishopMoves(column, row));
                return locations;
            }
            case "rook":
            {
                return FindAllRookMoves(column, row);
            }
        }

        return new List<PieceLocation>();
    }

    /// <summary>
    /// Gets a list of all pieces currently putting the king in check,
    /// assuming the king at it's current location (cooluumn, row) were
    /// moved to a specified location (withColuumn, withRow).
    /// </summary>
    private List<PieceInfo> GetKingCheckers(int kingColumn, int kingRow, int withColumn, int withRow)
    {
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);
        var checkers = new List<PieceInfo>();

        // Copy over the board to WithBoard to ensure that pieces will see the king with the
        // correct location given in the arguments when checking for possible moves
        var withLocation = new PieceLocation(kingColumn, kingRow);
        var withBoard = new Piece?[columns, rows];
        Array.Copy(board, withBoard, withBoard.Length);
        var kingPiece = withBoard[withColumn, withRow] = withBoard[kingColumn, kingRow];
        withBoard[kingColumn, kingRow] = null;
        ArgumentNullException.ThrowIfNull(kingPiece, nameof(kingPiece));

        // Get all pieces that would put king in check if king were at specified location
        for (var ac = 0; ac < columns; ac++)
        {
            for (var ar = 0; ar < rows; ar++)
            {
                if (ac != kingColumn && ar != kingRow && withBoard[ac, ar] is Piece attackingPiece
                    && attackingPiece.Colour != kingPiece.Colour && attackingPiece.Type != "king")
                {
                    var attackerLocation = new PieceLocation(ac, ar);
                    var attackerMoves = FindAllPieceMoves(ac, ar, attackingPiece);
                    attackerMoves = RemoveInvalidPieceMoves(ac, ar, attackingPiece, attackerMoves, withBoard);

                    // This piece could possibly move to take the king at this location
                    if (attackerMoves.Contains(withLocation))
                    {
                        checkers.Add(new PieceInfo(new PieceLocation(ac, ar), attackingPiece, attackerMoves));
                    }
                }
            }
        }

        return checkers;
    }

    /// <summary>
    /// Based on absolutely everything going on around the piece on the board,
    /// this method will eliminate invalid moves for that piece. For example, removing
    /// moves that would land upon pieces of the same colour, etc.
    /// </summary>
    private List<PieceLocation> RemoveInvalidPieceMoves(int column, int row,
        Piece piece, List<PieceLocation> locations, Piece?[,]? checkingBoard = null)
    {
        checkingBoard ??= board;
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);

        // Remove locations outside of board and all locations
        // that fall upon a piece of the same colour (can not take own piece)
        for (var i = locations.Count - 1; i >= 0; i--)
        {
            var location = locations[i];
            if (location.Column < 0 || location.Column >= columns
                || location.Row < 0 || location.Row >= rows
                || checkingBoard[location.Column, location.Row]?.Colour == piece.Colour)
            {
                locations.RemoveAt(i);
            }
        }

        // Remove invalid locations depending on piece
        if (piece.Type == "pawn")
        {
            for (var i = locations.Count - 1; i >= 0; i--)
            {
                var location = locations[i];
                if (location.Column != column && checkingBoard[location.Column, location.Row] is null)
                {
                    locations.RemoveAt(i);
                }
                else if (piece.Disturbed)
                {
                    if ((piece.Colour == "black" && location.Row == row + 2) 
                        || (piece.Colour == "white" && location.Row == row - 2))
                    {
                        locations.RemoveAt(i);
                    }
                }
            }
        }
        else if (piece.Type == "king")
        {
            for (var i = locations.Count - 1; i >= 0; i--)
            {
                // Any move that will put king in check is invalid
                var kingMove = locations[i];
                var checkers = GetKingCheckers(column, row, kingMove.Column, kingMove.Row);
                if (checkers.Count != 0)
                {
                    locations.RemoveAt(i);
                }
            }
        }

        return locations;
    }

    private List<PieceLocation> GetPieceLocations(string type, string colour)
    {
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);
        var locations = new List<PieceLocation>();
        for (var column = 0; column < columns; column++)
        {
            for (var row = 0; row < rows; row++)
            {
                if (board[column, row]?.Type == type && board[column, row]?.Colour == colour)
                {
                    locations.Add(new PieceLocation(column, row));
                }
            }
        }

        return locations;
    }

    private bool AllKingsInCheck(string colour)
    {
        var kingLocations = GetPieceLocations("king", colour);
        foreach (var kingLocation in kingLocations)
        {
            var checkers = GetKingCheckers(kingLocation.Column, kingLocation.Row,
                kingLocation.Column, kingLocation.Row);
            if (checkers.Count != 0)
            {
                return true;
            }
        }

        return false;
    }

    private void HandlePieceMoves(ClientData fromClient, ref ReadablePacket packet)
    {
        var column = (int) packet.ReadByte();
        var row = (int) packet.ReadByte();
        // Client has sent some confusing data to trip up the server, ignore their request
        if (column < 0 || column > board.GetLength(0) || row < 0
            || row > board.GetLength(1) || fromClient != players[currentTurn])
        {
            return;
        }

        var piece = board[column, row];
        if (piece is null || piece.Colour != fromClient.Colour)
        {
            return;
        }

        var pieceMoves = FindAllPieceMoves(column, row, piece);
        pieceMoves = RemoveInvalidPieceMoves(column, row, piece, pieceMoves);
        // If a king for this colour is in check, then this non king piece is not allowed to move
        if (piece.Type != "king" && AllKingsInCheck(piece.Colour))
        {
            pieceMoves.Clear();
        }

        var movesPacket = new WriteablePacket();
        movesPacket.WriteByte(OutgoingCodes.PieceMoves);
        movesPacket.WriteUShort((ushort) pieceMoves.Count);
        foreach (var move in pieceMoves)
        {
            movesPacket.WriteByte((byte) move.Column);
            movesPacket.WriteByte((byte) move.Row);
        }
        _ = fromClient.SendAsync(movesPacket);
    }

    private void HandleMove(ClientData fromClient, ref ReadablePacket packet)
    {
        if (fromClient != players[currentTurn])
        {
            return;
        }
        var column = packet.ReadByte();
        var row = packet.ReadByte();
        var toColumn = packet.ReadByte();
        var toRow = packet.ReadByte();

        // Verify client is referincing an existing piece on the board
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);
        var piece = board[column, row];
        if (piece is null)
        {
            return;
        }

        // Check if attempted move was a valid chess move for that piece
        var validMoves = FindAllPieceMoves(column, row, piece);
        validMoves = RemoveInvalidPieceMoves(column, row, piece, validMoves);
        if (!validMoves.Any(location => location.Column == toColumn && location.Row == toRow))
        {
            return;
        }

        // Handle if another piece is already at destination (take)
        var destinationPiece = board[toColumn, toRow];
        if (destinationPiece is not null)
        {
            // Can't take piece if colour is same
            if (destinationPiece.Colour == fromClient.Colour || destinationPiece.Type == "king")
            {
                return;
            }
            
            var takePacket = new WriteablePacket();
            takePacket.WriteByte(OutgoingCodes.TakePiece);
            takePacket.WriteByte(toColumn);
            takePacket.WriteByte(toRow);
            takePacket.WriteByte((byte) currentTurn);
            SendPacketToAll(ref takePacket);
            fromClient.TakenPieces.Add(destinationPiece);
        }
        board[toColumn, toRow] = board[column, row];
        board[column, row] = null;
        piece.Disturbed = true;

        var movePacket = new WriteablePacket();
        movePacket.WriteByte(OutgoingCodes.MovePiece);
        movePacket.WriteByte(column);
        movePacket.WriteByte(row);
        movePacket.WriteByte(toColumn);
        movePacket.WriteByte(toRow);
        SendPacketToAll(ref movePacket);
        
        // Pawn promotion
        if (piece is { Type: "pawn", Colour: "white" } && toRow == 0
            || (piece is { Type: "pawn", Colour: "black" } && toRow == rows - 1))
        {
            piece.Promotable = true;

            var promotionPacket = new WriteablePacket();
            promotionPacket.WriteByte(OutgoingCodes.AvailablePromotion);
            promotionPacket.WriteByte(toColumn);
            promotionPacket.WriteByte(toRow);
            _ = fromClient.SendAsync(promotionPacket);
        }
        else
        {
            ProceedNextTurn();
        }
    }

    private void HandlePromote(ClientData fromClient, ref ReadablePacket packet)
    {
        if (fromClient != players[currentTurn])
        {
            return;
        }
        var column = packet.ReadByte();
        var row = packet.ReadByte();
        var toType = packet.ReadString();

        var piece = board[column, row];
        if (piece is null || piece.Colour != fromClient.Colour
            || !piece.Promotable || !validPromotions.Contains(toType))
        {
            return;
        }
        piece.Promotable = false;
        piece.Type = toType;
        var promotePacket = new WriteablePacket();
        promotePacket.WriteByte(OutgoingCodes.Promote);
        promotePacket.WriteByte(column);
        promotePacket.WriteByte(row);
        promotePacket.WriteString(toType);
        SendPacketToAll(ref promotePacket);
        ProceedNextTurn();
    }
}