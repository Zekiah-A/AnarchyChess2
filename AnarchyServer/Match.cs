using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using DataProto;

namespace AnarchyServer;

public class Match
{
    public DateTime CreatedDate;
    public int Capacity;
    public string Name;
    public bool Started;
    public int HostId;
    public List<ClientData> Players;
    public bool AdvertisePublic;
    public int RulesetId;
    public int ArrangementId;

    private readonly JsonSerializerOptions jsonOptions;
    private delegate void BinaryPacketHandler(ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;

    public Match(int hostId, string name, int capacity, int rulesetId, int arrangementId, bool advertisePublic)
    {
        CreatedDate = DateTime.Now;
        Name = name;
        Capacity = capacity;
        RulesetId = rulesetId;
        ArrangementId = arrangementId;
        HostId = hostId;
        Players = new List<ClientData>();
        AdvertisePublic = advertisePublic;

        jsonOptions = new JsonSerializerOptions()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        binaryPacketHandlers = new Dictionary<int, BinaryPacketHandler>()
        {
            { 0, HandleMove }
        };
    }

    public void AddPlayer(ClientData player)
    {
        Players.Add(player);
        if (Players.Count == Capacity)
        {
            // Start match
            Started = true;
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