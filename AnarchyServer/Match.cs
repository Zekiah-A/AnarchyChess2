using System.Timers;
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
    private readonly Piece[,] board;
    private readonly JsonArray rulesJsonArray;
    private readonly List<ClientData> players;
    private readonly JsonSerializerOptions jsonOptions;
    private delegate void BinaryPacketHandler(ClientData fromClient, ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;
    private readonly List<string> colours = [ "white", "black" ];
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
            { 1, HandleMove }
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
        
        turnDuration = TimeSpan.FromSeconds(15);
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
        var turnInfo = new WriteablePacket();
        turnInfo.WriteByte(OutgoingCodes.CurrentTurn);
        turnInfo.WriteByte((byte) currentTurn);
        turnDuration = TimeSpan.FromSeconds(15);
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

    private List<PieceLocation> RemoveInvalidLocations(List<PieceLocation> locations)
    {
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);
        foreach (var location in locations.ToList())
        {
            if (location.Column >= 0 && location.Column < columns
                && location.Row >= 0 && location.Row < rows)
            {
                locations.Remove(location);
            }
        }
        return locations;
    }

    private List<PieceLocation> RemoveInvalidLocations(PieceLocation[] locationsArray)
    {
        var locations = new List<PieceLocation>();
        var columns = board.GetLength(0);
        var rows = board.GetLength(1);
        foreach (var location in locationsArray)
        {
            if (location.Column >= 0 && location.Column < columns
                && location.Row >= 0 && location.Row < rows)
            {
                locations.Add(location);
            }
        }
        return locations;
    }

    private List<PieceLocation> FindAllPieceMoves(int column, int row, string type, string colour)
    {
        switch (type)
        {
            case "pawn":
            {
                var locations = new PieceLocation[2];
                if (colour == "white")
                {
                    locations[0] = new PieceLocation(column, row - 1);
                    locations[1] = new PieceLocation(column, row - 2);
                }
                else if (colour == "black")
                {
                    locations[0] = new PieceLocation(column, row + 1);
                    locations[1] = new PieceLocation(column, row + 2);
                }
                return RemoveInvalidLocations(locations);
            }
            case "bishop":
            {
                return RemoveInvalidLocations(FindAllBishopMoves(column, row));
            }
            case "king":
            {
                var locations = new PieceLocation[]
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
                return RemoveInvalidLocations(locations);
            }
            case "knight":
            {
                var locations = new PieceLocation[]
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
                return RemoveInvalidLocations(locations);
            }
            case "queen":
            {
                var locations = new List<PieceLocation>();
                locations.AddRange(FindAllRookMoves(column, row));
                locations.AddRange(FindAllBishopMoves(column, row));
                return RemoveInvalidLocations(locations);
            }
            case "rook":
            {
                return RemoveInvalidLocations(FindAllRookMoves(column, row));
            }
        }

        return new List<PieceLocation>();
    }

    private void HandlePieceMoves(ClientData fromClient, ref ReadablePacket packet)
    {
        var column = (int) packet.ReadByte();
        var row = (int) packet.ReadByte();
        // Client has sent some confusing data to trip up the server, ignore their request
        if (column < 0 || column > board.GetLength(0) || row < 0 || row > board.GetLength(1))
        {
            return;
        }

        var piece = board[column, row];
        if (piece is null || piece.Colour != fromClient.Colour)
        {
            return;
        }
        var pieceMoves = FindAllPieceMoves(column, row, piece.Type, piece.Colour);
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
        ProceedNextTurn();
    }
}