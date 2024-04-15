using System.Net.WebSockets;

namespace AnarchyServer;

public struct ReceivedMessage
{
    public byte[] Data;
    public WebSocketMessageType MessageType;

    public ReceivedMessage(byte[] data, WebSocketMessageType messageType)
    {
        Data = data;
        MessageType = messageType;
    }
}
