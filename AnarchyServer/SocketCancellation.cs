namespace AnarchyServer;

public struct SocketCancellation : IReceiveResult
{
    public Exception? Exception;

    public SocketCancellation(Exception? exception)
    {
        Exception = exception;
    }
}