namespace AnarchyServer;

public struct SocketCancellation : IReceiveResult
{
    public TaskCanceledException? Exception;
    
    public SocketCancellation(TaskCanceledException? exception)
    {
        Exception = exception;
    }
}