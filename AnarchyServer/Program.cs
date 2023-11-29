using System.Net.WebSockets;
using System.Runtime.CompilerServices;
using AnarchyServer;
using DataProto;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
var socketClients = new List<ClientData>();
var matches = new Dictionary<int, Match>();
var topMatchId = 0;

// app.UseHttpsRedirection();
var webSocketOptions = new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(2)
};
app.UseWebSockets(webSocketOptions);
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

async IAsyncEnumerable<IReceiveResult> ReceiveDataAsync(ClientData client, [EnumeratorCancellation] CancellationToken token)
{
    // Receive in chunks
    var resultStream = new MemoryStream();
    var transportCompleted = false;
    while (true)
    {
        IReceiveResult readLoopResult = null!;
        if (token.IsCancellationRequested)
        {
            app.Logger.LogInformation("Terminating connection with websocket client {Ip} as per cancellation token request", client.Ip);
            await client.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
            yield return new SocketCancellation(null);
            transportCompleted = true;
        }
        try
        {
            var buffer = new byte[65536];
            var result = await client.Socket.ReceiveAsync(buffer, token);

            if (result.CloseStatus != null)
            {
                app.Logger.LogTrace("Close received from websocket client {Ip}. Reason {Reason}",
                    client.Ip, result.CloseStatusDescription);
                await client.Socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                readLoopResult =  new SocketClosure(result.CloseStatus, result.CloseStatusDescription);
                transportCompleted = true;

            }
            
            if (result.Count > 0)
            {
                resultStream.Write(buffer, 0, result.Count);
            }
            
            if (result.EndOfMessage)
            {
                resultStream.Flush();
                var message = new ReceivedMessage(resultStream.ToArray(), result.MessageType);
                resultStream.SetLength(0);
                readLoopResult =  message;
            }
        }
        catch (TaskCanceledException cancelException)
        {
            app.Logger.LogError("Terminated connection with client {Ip}", client.Ip);
            readLoopResult = new SocketCancellation(cancelException);
        }
        catch (Exception exception)
        {
            app.Logger.LogError("Unexpected error in websocket connection with {Ip}: {Exception}", client.Ip, exception);
            await client.Socket.CloseOutputAsync(WebSocketCloseStatus.InternalServerError, "", CancellationToken.None);
            readLoopResult = new SocketError(exception);
        }

        yield return readLoopResult;
        
        if (transportCompleted)
        {
            yield break;
        }
    }
}

app.MapGet("/Matches/Find", (HttpContext context) =>
{
    var found = new List<MatchInfo>();
    
    foreach (var matchPair in matches)
    {
        var match = matchPair.Value;
        var playerCount = match.Players.Count;
        if (!match.Started && match.Players.Count < match.Capacity && match.AdvertisePublic)
        {
            var matchInfo = new MatchInfo(matchPair.Key, match.HostId, match.Name, match.Capacity, playerCount, 0, 0);
            found.Add(matchInfo);
        }
    }

    return Results.Json(found);
});

app.MapPost("/Matches/Create", ([FromBody] MatchCreateInfo info, HttpContext context) =>
{
    var newId = ++topMatchId;
    var match = new Match(0, info.MatchName, info.AdvertisePublic);
    matches.Add(newId, match);
    // TODO: Query DB for arrangement and ruleset ID to collect them. Cache both of these in an arrangement/ruleset pool.
    // TODO: Pass in host ID.
    return Results.Unauthorized();
});

app.MapGet("/Matches/Play/{matchId}", (int matchId, HttpContext context) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        return Results.StatusCode(405);
    }
    if (context.Connection.RemoteIpAddress is null)
    {
        return Results.Unauthorized();
    }
    if (!matches.TryGetValue(matchId, out var match))
    {
        return Results.NotFound();
    }
    
    Task.Run(async Task?() => 
    {
        using var websocket = await context.WebSockets.AcceptWebSocketAsync();
        var clientCancelToken = new CancellationToken();
        var client = new ClientData(context.Connection.RemoteIpAddress, context.Connection.RemotePort, websocket, clientCancelToken);
        socketClients.Add(client);
        
        await foreach (var receiveResult in ReceiveDataAsync(client, clientCancelToken))
        {
            if (receiveResult is SocketClosure or SocketCancellation or SocketError)
            {
                break;
            }
            
            if (receiveResult is ReceivedMessage message)
            {
                match.CallHandlerDelegate(client, message);
            }
        }
    }).ConfigureAwait(false);
    
    return Results.Ok();
});

// Will collect/destroy all matches that have been open for more than 5 minutes without any player joining, including host
var matchDestructTimer = new System.Timers.Timer(TimeSpan.FromMinutes(5))
{
    AutoReset = true,
};
matchDestructTimer.Elapsed += (_, _) =>
{
    var toDelete = new List<int>();
    foreach (var matchPair in matches)
    {
        if (DateTime.Now - matchPair.Value.CreatedDate > TimeSpan.FromMinutes(5) && matchPair.Value.Players.Count == 0)
        {
            toDelete.Add(matchPair.Key);
        }
    }
    foreach (var match in toDelete)
    {
        matches.Remove(match);
    }
};
matchDestructTimer.Start();

app.Logger.LogInformation("Anarchy server started!");
app.Run();
