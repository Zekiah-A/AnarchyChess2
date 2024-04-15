namespace AnarchyServer;

public struct SocketCancellation
{
    public Exception? Exception;

    public SocketCancellation(Exception? exception)
    {
        Exception = exception;
    }
}