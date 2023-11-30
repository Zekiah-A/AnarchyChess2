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
}