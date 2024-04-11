using System.Net;
using System.Net.WebSockets;
using AnarchyServer.DataModel;

namespace AnarchyServer;

public class ClientData
{
    public IPAddress Ip { get; init; }
    public int Port { get; init; }
    public WebSocket Socket { get; init; }
    public CancellationToken CancellationToken { get; init; }
    public Account Account { get; init; }
    public string Colour { get; set; }
    public List<Piece> TakenPieces { get; set; }

    public ClientData(IPAddress ip, int port, WebSocket socket, Account account, CancellationToken cancellationToken)
    {
        Ip = ip;
        Port = port;
        Socket = socket;
        CancellationToken = cancellationToken;
        Account = account;
        TakenPieces = new List<Piece>();
    }

    public async Task SendAsync(byte[] data, WebSocketMessageType type = WebSocketMessageType.Binary, CancellationToken? cancelToken = null)
    {
        cancelToken ??= CancellationToken.None;
        await Socket.SendAsync(data, type, true, cancelToken.Value);
    }

    public async Task CloseAsync(WebSocketCloseStatus closeStatus, string? closeReason, CancellationToken? cancelToken = null)
    {
        cancelToken ??= CancellationToken.None;
        if (Socket.State is not WebSocketState.Closed or WebSocketState.CloseReceived)
        {
            await Socket.CloseAsync(closeStatus, closeReason, cancelToken.Value);
        }
    }
}