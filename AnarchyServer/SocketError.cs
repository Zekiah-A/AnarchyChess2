namespace AnarchyServer;

public struct SocketError : IReceiveResult
{
    public Exception? Exception;
    
    public SocketError(Exception? exception)
    {
        Exception = exception;
    }
}