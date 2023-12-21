using System.Net;
using System.Net.WebSockets;

namespace AnarchyServer;

public class ClientData
{
    public IPAddress Ip { get; init; }
    public int Port { get; init; }
    public WebSocket Socket { get; init; }
    public CancellationToken CancellationToken { get; init; }
    public int Id { get; init; }

    public ClientData(IPAddress ip, int port, WebSocket socket, CancellationToken cancellationToken)
    {
        Ip = ip;
        Port = port;
        Socket = socket;
        CancellationToken = cancellationToken;
    }

    public async Task SendAsync(byte[] data, WebSocketMessageType type = WebSocketMessageType.Binary, CancellationToken? cancelToken = null)
    {
        cancelToken ??= CancellationToken.None;
        await Socket.SendAsync(data, type, true, cancelToken.Value);
    }

    public async Task CloseAsync(WebSocketCloseStatus closeStatus, string? closeReason, CancellationToken? cancelToken = null)
    {
        cancelToken ??= CancellationToken.None;
        await Socket.CloseAsync(closeStatus, closeReason, cancelToken.Value);
    }
}