using System.Net.WebSockets;
using System.Runtime.CompilerServices;
using System.Text;
using AnarchyServer;
using System.Text.Json;
using CommunityToolkit.HighPerformance.Buffers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using AnarchyServer.DataModel;

// dotnet ef migrations add InitialCreate
// dotnet ef database update
// dotnet ef migrations remove

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
builder.Services.AddCors((cors) =>
{
    // https://stackoverflow.com/questions/59325994/content-type-is-not-allowed-by-access-control-allow-headers-in-preflight-respons
    cors.AddDefaultPolicy((policy) =>
    {
        policy.AllowAnyOrigin();
        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
    });
});
builder.Services.AddDbContext<DatabaseContext>(options =>
{
    options.UseSqlite("Data Source=server.db");
});

var app = builder.Build();
var socketClients = new List<ClientData>();
var matches = new Dictionary<int, AnarchyServer.Match>();
var topMatchId = 0;

// app.UseHttpsRedirection();
var webSocketOptions = new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(2)
};
app.UseWebSockets(webSocketOptions);
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var authEndpoints = new[] { "/Users" };
foreach (var endpoint in authEndpoints)
{
    app.UseWhen
    (
        context => context.Request.Path.StartsWithSegments(endpoint),
        appBuilder =>
        {
            appBuilder.UseMiddleware<TokenAuthMiddleware>();
        }
    );
}

async IAsyncEnumerable<IReceiveResult> ReceiveDataAsync(ClientData client, [EnumeratorCancellation] CancellationToken token)
{
    // Receive in chunks
    using var resultStream = new MemoryStream();
    var transportCompleted = false;
    while (true)
    {
        IReceiveResult readLoopResult = null!;
        try
        {
            if (token.IsCancellationRequested)
            {
                app.Logger.LogInformation(
                    "Terminating connection with websocket client {Ip} as per cancellation token request", client.Ip);
                readLoopResult = new SocketCancellation(null);
                await client.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                transportCompleted = true;
            }
            else
            {
                using var buffer = MemoryOwner<byte>.Allocate(65536);
                var result = await client.Socket.ReceiveAsync(buffer.Memory, token);
                
                if (result.Count > 0)
                {
                    resultStream.Write(buffer.Span[..result.Count]);
                }
                
                if (result.EndOfMessage)
                {
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        resultStream.Flush();
                        app.Logger.LogTrace("Close received from websocket client {Ip}. Code {Code}, reason: {Reason}",
                            client.Ip, client.Socket.CloseStatus, client.Socket.CloseStatusDescription);
                        await client.Socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                        readLoopResult = new SocketClosure(client.Socket.CloseStatus, client.Socket.CloseStatusDescription);
                        transportCompleted = true;
                    }
                    else
                    {
                        resultStream.Flush();
                        var message = new ReceivedMessage(resultStream.ToArray(), result.MessageType);
                        resultStream.SetLength(0);
                        readLoopResult = message;
                    }
                }
            }
        }
        catch (TaskCanceledException cancelException)
        {
            app.Logger.LogError("Task cancelled connection with client {Ip}", client.Ip);
            readLoopResult = new SocketCancellation(cancelException);
            await client.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
            transportCompleted = true;
        }
        catch (OperationCanceledException cancelException)
        {
            app.Logger.LogError("Task cancelled connection with client {Ip}", client.Ip);
            readLoopResult = new SocketCancellation(cancelException);
            await client.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
            transportCompleted = true;
        }
        catch (Exception exception)
        {
            app.Logger.LogError("Unexpected error in websocket connection with {Ip}: {Exception}", client.Ip, exception);
            await client.Socket.CloseOutputAsync(WebSocketCloseStatus.InternalServerError, "", CancellationToken.None);
            readLoopResult = new SocketError(exception);
            transportCompleted = true;
        }

        yield return readLoopResult;
        if (transportCompleted)
        {
            yield break;
        }
    }
}

app.MapGet("/Matches", (HttpContext context) =>
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

app.MapPost("/Matches", ([FromBody] MatchCreateInfo info, HttpContext context) =>
{
    var newId = ++topMatchId;
    var match = new AnarchyServer.Match(0, info.MatchName, info.AdvertisePublic);
    matches.Add(newId, match);
    // TODO: Query DB for arrangement and ruleset ID to collect them. Cache both of these in an arrangement/ruleset pool.
    // TODO: Pass in host ID.
    return Results.Json(newId);
});

app.MapGet("/Matches/{matchId}", async (int matchId, HttpContext context) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
        return;
    }
    if (context.Connection.RemoteIpAddress is null)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    if (!matches.TryGetValue(matchId, out var match))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    
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
});

app.MapGet("/GlobalStats", () =>
{
    var stats = new GlobalStats(socketClients.Count, matches.Count);
    return Results.Ok(stats);
});

void AppendAuthCookie(string token, HttpContext context, IConfiguration config)
{
    var domain = config.GetSection("AnarchyServer").GetValue<string?>("Origin");
    var secureCookies = config.GetSection("AnarchyServer").GetValue<bool>("SecureCookies");
    var cookieOptions = new CookieOptions
    {
        Expires = DateTime.Now.AddDays(30),
        HttpOnly = secureCookies,
        Secure = secureCookies,
        SameSite = secureCookies ? SameSiteMode.Strict : SameSiteMode.Lax,
        Domain = domain,
    };
    context.Response.Cookies.Append("Authorization", token, cookieOptions);
}

app.MapPost("/Login", async (HttpContext context, [FromBody] LoginRequest? request, DatabaseContext dbContext, IConfiguration config) =>
{    
    var token = context.Request.Headers.Authorization.FirstOrDefault();
    Account? account = null;
    if (token != null)
    {
        account = await dbContext.Accounts.FirstOrDefaultAsync(account => account.Token == token);
        if (account == null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { Message = "Invalid token" });
            return;
        }
    }
    else if (request != null)
    {
        account ??= await dbContext.Accounts
            .FirstOrDefaultAsync(account => account.Username == request.Username && account.Email == request.Email);
        if (account == null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { Message = "Invalid username or email" });
            return;
        }
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { Message = "Login credentials not provided" });
        return;
    }

    AppendAuthCookie(account.Token, context, config);
    context.Response.StatusCode = StatusCodes.Status200OK;
    await context.Response.WriteAsJsonAsync(new { Message = "Login successful", Token = account.Token, Id = account.Id });
});

app.MapPost("/Signup", async (HttpContext context, [FromBody] SignupRequest request, DatabaseContext dbContext, IConfiguration config) =>
{
    // Validate email
    if (!EmailRegex().IsMatch(request.Email))
    {
        return Results.BadRequest(new { Message = "Invalid email format" });
    }
    // Validate username
    if (!UsernameRegex().IsMatch(request.Username))
    {
        return Results.BadRequest(new { Message = "Invalid username format" });
    }
    // Check if the username is already taken
    if (await dbContext.Accounts.AnyAsync(account => account.Username == request.Username))
    {
        return Results.BadRequest(new { Message = "Username is already taken" });
    }
    // Check if the email is already used
    if (await dbContext.Accounts.AnyAsync(account => account.Email == request.Email))
    {
        return Results.BadRequest(new { Message = "Email is already used" });
    }

    string token;
    do
    {
        token = Guid.NewGuid().ToString("N");
    } while (dbContext.Accounts.Any(account => account.Token == token));

    var newAccount = new Account
    {
        Username = request.Username,
        Email = request.Email,
        Token = token
    };

    dbContext.Accounts.Add(newAccount);
    await dbContext.SaveChangesAsync();

    var newSettings = new Settings
    {
        AccountId = newAccount.Id,
        Theme = BoardTheme.Classic,
        SoundEnabled = true
    };

    dbContext.Settings.Add(newSettings);
    await dbContext.SaveChangesAsync();

    AppendAuthCookie(newAccount.Token, context, config);
    return Results.Ok(new { Message = "Signup successful", Token = newAccount.Token, Id = newAccount.Id });
});

app.MapGet("/Profiles/{id}", async (int id, DatabaseContext dbContext) =>
{
    var account = await dbContext.Accounts.FindAsync(id);
    if (account != null)
    {
        // Sanitised public facing account profile
        var profile = new
        {
            Id = account.Id,
            Username = account.Username,
            Biography = account.Biography,
            ProfileImageUri = account.ProfileImageUri,
        };

        return Results.Ok(profile);
    }
    else
    {
        return Results.NotFound();
    }
});

app.MapGet("/Users/{id}", async (int id, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to access their own account
    if (context.Items["AccountId"] is not int requesterId || requesterId != id)
    {
        return Results.Unauthorized();
    }

    var user = await dbContext.Accounts.FindAsync(id);

    if (user != null)
    {
        return Results.Ok(user);
    }
    else
    {
        return Results.NotFound();
    }
});

app.MapDelete("/Users/{id}", async (int id, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to delete their own account
    if (context.Items["AccountId"] is not int requesterId || requesterId != id)
    {
        return Results.Unauthorized();
    }

    var user = await dbContext.Accounts.FindAsync(id);

    if (user != null)
    {
        dbContext.Accounts.Remove(user);
        await dbContext.SaveChangesAsync();
        return Results.Ok(new { Message = "All account data deleted sucessfully" });
    }
    else
    {
        return Results.NotFound(new { Message = "Specified account does not exist" });
    }
});

app.MapGet("/Users/{id}/Settings", async (int id, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to access their own settings
    if (context.Items["AccountId"] is not int requesterId || requesterId != id)
    {
        return Results.Unauthorized();
    }

    var settings = await dbContext.Settings
        .SingleOrDefaultAsync(settings => settings.AccountId == id);

    if (settings != null)
    {
        return Results.Ok(settings);
    }
    else
    {
        return Results.NotFound(new { Message = "Settings for specified account could not be found" });
    }
});

app.MapPost("/Users/{id}/Settings", async (int id, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to access their own settings
    if (context.Items["AccountId"] is not int requesterId || requesterId != id)
    {
        return Results.Unauthorized();
    }

    var settings = await dbContext.Settings
        .FirstOrDefaultAsync(a => a.AccountId == id);

    if (settings != null)
    {
        await dbContext.SaveChangesAsync();
        return Results.Ok(settings);
    }
    else
    {
        return Results.NotFound();
    }
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

partial class Program
{
    [GeneratedRegex(@"^\w{4,16}$")]
    private static partial Regex UsernameRegex();

    // Wikipedia 
    [GeneratedRegex(@"^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$")]
    private static partial Regex EmailRegex();
}
