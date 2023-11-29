using System.Net.WebSockets;
using System.Text;
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

    private delegate void BinaryPacketHandler(ref ReadablePacket data);
    private readonly Dictionary<int, BinaryPacketHandler> binaryPacketHandlers;
    
    public Match(int hostId, string name, bool advertisePublic)
    {
        binaryPacketHandlers = new Dictionary<int, BinaryPacketHandler>()
        {
            { 0, HandleMove }
        };
        CreatedDate = DateTime.Now;
    }

    public void CallHandlerDelegate(ClientData fromClient, ReceivedMessage message)
    {
        if (message.MessageType == WebSocketMessageType.Text)
        {
            var stringMessage = Encoding.UTF8.GetString(message.Data);
            HandleChatMessage(fromClient, stringMessage);
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
        
    }

    private void HandleMove(ref ReadablePacket packet)
    {
        
    }
}