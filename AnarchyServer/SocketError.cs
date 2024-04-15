namespace AnarchyServer;

public struct SocketError
{
    public Exception? Exception;

    public SocketError(Exception? exception)
    {
        Exception = exception;
    }
}