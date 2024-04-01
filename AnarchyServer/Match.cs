using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net.WebSockets;
using System.Text;
using AnarchyServer.DataModel;
using DataProto;

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

    private readonly Random random;
    private readonly Piece[,] board;
    private readonly JsonArray rulesJsonArray;
    //private readonly 
    private readonly List<ClientData> players;
    private readonly JsonSerializerOptions jsonOptions;
    private delegate void BinaryPacketHandler(ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;

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
            { 0, HandleMove }
        };

        board = new Piece[arrangement.Columns,arrangement.Rows];
        random = new Random();
        
        var ruleData = JsonNode.Parse(Ruleset.Data)!;
        if (ruleData is not JsonArray ruleArray)
        {
            throw new InvalidDataException("Couldn't parse rules data");
        }
        rulesJsonArray = ruleArray;
    }

    public void AddPlayer(ClientData player)
    {
        players.Add(player);
        if (players.Count == Capacity)
        {
            StartMatch();
        }
    }

    public void StartMatch()
    {
        // Start match
        Started = true;
        // Send match info
        var matchInfo = new WriteablePacket();
        matchInfo.WriteByte(OutgoingCodes.MatchInfo);
        matchInfo.WriteByte((byte) Players.Count);
        foreach (var client in players.ToList())
        {
            matchInfo.WriteInt(client.Account.Id);
        }
        matchInfo.WriteByte((byte) Arrangement.Columns);
        matchInfo.WriteByte((byte) Arrangement.Rows);
        matchInfo.WriteInt(Ruleset.Id);
        matchInfo.WriteInt(Arrangement.Id);

        foreach (var client in players.ToList())
        {
            _ = client.SendAsync(matchInfo, WebSocketMessageType.Binary);
        }

        // Setup and send player info
        var startingColour = "white";
        foreach (var ruleJson in rulesJsonArray)
        {
            if (ruleJson is null || ruleJson["condition"]?.GetValue<string>() != "matchStart")
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
        var colours = new List<string>() { "white", "black" };
        colours.Remove(startingColour);

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

        foreach (var client in Players.ToList())
        {
            _ = client.SendAsync(playerInfo, WebSocketMessageType.Binary);
        }

        // Send current turn and time remaining before skip turn
        var turnPacket = new WriteablePacket();
        turnPacket.WriteByte(OutgoingCodes.CurrentTurn);
        turnPacket.WriteByte((byte) currentTurn);
    }

    public async Task RemovePlayer(ClientData player)
    {
        players.Remove(player);
        if (Started)
        {
            // Stop match 
            foreach (var client in players.ToList())
            {
                await client.CloseAsync(WebSocketCloseStatus.NormalClosure,
                    "Match ended - Other player disconnecteed");
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
            handler(ref packet);
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
        var formatted = JsonSerializer.Serialize(new { UserId = fromClient.Account.Id, Message = truncated }, jsonOptions);
        var encoded = Encoding.UTF8.GetBytes(formatted);

        // Iterate and send chat message to all other connected clients
        foreach (var client in Players.ToList())
        {
            _ = client.SendAsync(encoded, WebSocketMessageType.Text);
        }
    }

    private void HandleMove(ref ReadablePacket packet)
    {

    }
}