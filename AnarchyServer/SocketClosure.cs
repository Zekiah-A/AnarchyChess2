using System.Net.WebSockets;

namespace AnarchyServer;

public struct SocketClosure
{
    public WebSocketCloseStatus? CloseStatus;
    public string? Reason;

    public SocketClosure(WebSocketCloseStatus? closeStatus, string? reason)
    {
        CloseStatus = closeStatus;
        Reason = reason;
    }
}