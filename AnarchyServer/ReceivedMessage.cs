using System.Net.WebSockets;
using DataProto;

namespace AnarchyServer;

public struct ReceivedMessage : IReceiveResult
{
    public byte[] Data;
    public WebSocketMessageType MessageType;

    public ReceivedMessage(byte[] data, WebSocketMessageType messageType)
    {
        Data = data;
        MessageType = messageType;
    }
}
