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
using System.Buffers.Text;
using Microsoft.Extensions.FileProviders;

// Reset DB: dotnet ef database update 0
// Reset DB: dotnet ef migrations add InitialCreate
// Reset DB: dotnet ef database update

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    ApplicationName = typeof(Program).Assembly.FullName,
    ContentRootPath = Path.GetFullPath(Directory.GetCurrentDirectory()),
    WebRootPath = "/",
    Args = args
});

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
    options.UseSqlite("Data Source=Server.db");
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
app.UseStaticFiles();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var currentDirectory = Directory.GetCurrentDirectory();
var pfpDirectory = Path.Combine(currentDirectory, "Data", "ProfilePictures");
Directory.CreateDirectory(pfpDirectory);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(pfpDirectory),
    RequestPath = "/Profiles/Images"
});

var authEndpoints = new[] { "/Users", "/Matches" };
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
        if (!match.Started && match.AdvertisePublic)
        {
            var matchInfo = new MatchInfo(matchPair.Key, match.HostId, match.Name, match.Capacity,
                playerCount, match.RulesetId, match.ArrangementId);
            found.Add(matchInfo);
        }
    }

    return Results.Ok(new { Matches = found });
});

app.MapPost("/Matches", ([FromBody] MatchCreateInfo info, HttpContext context) =>
{
    if (context.Items["AccountId"] is not int userId)
    {
        return Results.Unauthorized();
    }
    if (info.MatchName.Length > 64)
    {
        return Results.BadRequest(new { Message = "Provided lobby name was longer than maximum allowed length (64)" });
    }
    if (info.Capacity is < 2 or > 2) // TODO: Allow larger matches
    {
        return Results.BadRequest(new { Message = "Provided lobby capacity was outside of allowed range (2-2)" });
    }
    var newId = ++topMatchId;
    var match = new AnarchyServer.Match(userId, info.MatchName, info.Capacity, info.RulesetId, info.ArrangementId, info.AdvertisePublic);
    matches.Add(newId, match);

    // TODO: Query DB for arrangement and ruleset ID to collect them. Cache both of these in an arrangement/ruleset pool.
    // TODO: Pass in host ID.
    return Results.Ok(new { MatchId = newId });
});

app.MapGet("/Matches/{matchId}", async (int matchId, HttpContext context, DatabaseContext dbContext) =>
{
    if (context.Items["AccountId"] is not int requesterId
        || await dbContext.Accounts.FindAsync(requesterId) is not Account account)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    if (!matches.TryGetValue(matchId, out var match))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsJsonAsync(new { Message = "Specified match does not exist" });
        return;
    }
    if (match.Started || match.Players.Count >= match.Capacity)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { Message = "Specified match is full or has already started" });
        return;
    }
    if (context.Connection.RemoteIpAddress is null)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
        return;
    }

    using var websocket = await context.WebSockets.AcceptWebSocketAsync();
    var clientCancelToken = new CancellationToken();
    var client = new ClientData(context.Connection.RemoteIpAddress, context.Connection.RemotePort, websocket, account, clientCancelToken);
    socketClients.Add(client);
    
    // Add them to match and hook their messages up to the match message handlers
    match.AddPlayer(client);
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

    var newAccount = new Account(request.Username, request.Email, token);
    dbContext.Accounts.Add(newAccount);
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
            account.Id,
            account.Username,
            account.Biography,
            account.ProfileImageUri,
            account.ProfileBackground,
            account.Gender,
            account.Location,
            // TODO: Implement these properties
            GamesPlayed = 0,  
            MatchesWon = 0,
            PlayTime = 0
        };
        return Results.Ok(profile);
    }
    else
    {
        return Results.NotFound(new { Message = "Specified profile does not exist" });
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

var validProfileBackgrounds = new string[]
{
    "red",
    "orange",
    "green",
    "cyan"
};

var validProfileGenders = new string[]
{
    "unknown",
    "male",
    "female",
    "other"
};

app.MapPost("/Users/{id}", async (int id, [FromBody] Account updatedProfile, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to access their own account
    var user = await dbContext.Accounts.FindAsync(id);
    if (context.Items["AccountId"] is not int requesterId || requesterId != id || user is null)
    {
        return Results.Unauthorized();
    }

    // If nothing is changed, then they tried to set an invalid property, like matches won, or no valid property at all
    var userChanged = false;
    // Apply all valid new profile fields which are not NULL (unchanged)
    if (updatedProfile.Biography is not null)
    {
        if (updatedProfile.Biography.Length <= 96)
        {
            user.Biography = updatedProfile.Biography;
            userChanged = true;
        }
        else
        {
            return Results.BadRequest(new { Message = "Specified profile biography is longer than maximum allowed length (96)" });
        }
    }
    if (updatedProfile.ProfileBackground is not null)
    {
        if (validProfileBackgrounds.Contains(updatedProfile.ProfileBackground))
        {
            user.ProfileBackground = updatedProfile.ProfileBackground;
            userChanged = true;
        }
        else
        {
            return Results.BadRequest(new { Message = "Specified profile background is not valid" });
        }
    }
    if (updatedProfile.Gender is not null)
    {
        if (validProfileGenders.Contains(updatedProfile.Gender))
        {
            user.Gender = updatedProfile.Gender;
            userChanged = true;
        }
        else
        {
            return Results.BadRequest(new { Message = "Specified profile gender is not valid" });
        }
    }
    if (updatedProfile.Location is not null)
    {
        if (updatedProfile.Location.Length <= 16)
        {
            user.Location = updatedProfile.Location;
            userChanged = true;
        }
        else
        {
            return Results.BadRequest(new { Message = "Specified profile location is longer than maximum allowed length (16)" });
        }
    }
    if (!userChanged)
    {
        return Results.BadRequest(new { Message = "Specified update property either could not be found, or does not exist" });
    }

    await dbContext.SaveChangesAsync();
    return Results.Ok();
});


var allowedPfpMimes = new Dictionary<string, string>
{
    { "image/png",  ".png" },
    { "image/jpg", ".jpg" },
    { "image/webp", ".webp" },
    { "image/gif", ".gif" }
};

app.MapPost("/Users/{id}/ProfileImage", async (int id, [FromBody] ProfilePictureRequest pictureRequest, HttpContext context, DatabaseContext dbContext) =>
{
    // Only allow user to access their own account
    var user = await dbContext.Accounts.FindAsync(id);
    if (context.Items["AccountId"] is not int requesterId || requesterId != id || user is null)
    {
        return Results.Unauthorized();
    }

    if (!allowedPfpMimes.TryGetValue(pictureRequest.MimeType, out string? fileExtension))
    {
        return Results.BadRequest(new { Message = "Supplied image was not of a valid format" });
    }
    var fileName = id + fileExtension;
    var savePath = Path.Combine(pfpDirectory, fileName);
    var fileData = Convert.FromBase64String(pictureRequest.Data);
    if (fileData.Length > 25e5)
    {
        return Results.BadRequest(new { Message = "Supplied image can not be more than 2.5MB" });
    }

    if (user.ProfileImageUri is not null)
    {
        var previousFile = Path.Combine(pfpDirectory, user.ProfileImageUri.Split("/").Last());
        File.Delete(previousFile);
    }

    await File.WriteAllBytesAsync(savePath, fileData);
    user.ProfileImageUri = $"Profiles/Images/{fileName}";
    await dbContext.SaveChangesAsync();
    return Results.Ok();
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
        if (DateTime.Now - matchPair.Value.CreatedDate > TimeSpan.FromMinutes(1) && matchPair.Value.Players.Count == 0)
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
