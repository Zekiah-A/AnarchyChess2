using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using AnarchyServer.DataModel;
using DataProto;

namespace AnarchyServer;

public class Match
{
    public DateTime CreatedDate;
    public int Capacity;
    public string Name;
    public bool Started;
    public int HostId;
    public IReadOnlyList<ClientData> Players { get => players; }
    public bool AdvertisePublic;
    public Ruleset Ruleset;
    public Arrangement Arrangement;

    private readonly Piece[,] board;
    private readonly List<ClientData> players;
    private readonly JsonSerializerOptions jsonOptions;
    private delegate void BinaryPacketHandler(ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;

    public Match(int hostId, string name, int capacity, Ruleset ruleset, Arrangement arrangement, bool advertisePublic)
    {
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
    }

    public void AddPlayer(ClientData player)
    {
        players.Add(player);
        if (players.Count == Capacity)
        {
            // Start match
            Started = true;
            // Send match info
            var matchInfo = new WriteablePacket();
            matchInfo.WriteByte(0);
            matchInfo.WriteByte((byte) Players.Count);
            foreach (var client in players)
            {
                matchInfo.WriteInt(client.Account.Id);
            }
            matchInfo.WriteByte((byte) Arrangement.Columns);
            matchInfo.WriteByte((byte) Arrangement.Rows);
            matchInfo.WriteInt(Ruleset.Id);
            matchInfo.WriteInt(Arrangement.Id);

            foreach (var client in players)
            {
                _ = client.SendAsync(matchInfo, WebSocketMessageType.Binary);
            }
        }
    }

    public void FindMovess(intint column, int row)
    {
        var board =
    }

    public async Task RemovePlayer(ClientData player)
    {
        players.Remove(player);
        if (Started)
        {
            // Stop match
            foreach (var client in players)
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
        foreach (var client in Players)
        {
            _ = client.SendAsync(encoded, WebSocketMessageType.Text);
        }
    }

    private void HandleMove(ref ReadablePacket packet)
    {

    }
}