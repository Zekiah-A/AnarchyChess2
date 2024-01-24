using System.Text.Json;
using AnarchyServer;
using AnarchyServer.DataModel;
using Microsoft.EntityFrameworkCore;

public class TokenAuthMiddleware
{
    private readonly RequestDelegate downstreamHandler;

    public TokenAuthMiddleware(RequestDelegate next)
    {
        downstreamHandler = next;
    }

    public async Task Invoke(HttpContext context, DatabaseContext dbContext)
    {
        // Extract token from request header or query parameter, depending on your setup
        var token = context.Request.Headers.Authorization.FirstOrDefault();
        var accountId = await ValidateToken(token, dbContext);

        if (accountId is null)
        {
            context.Response.StatusCode = 401; // Unauthorised
            await context.Response.WriteAsJsonAsync(new { Message = "Invalid token provided in auth header" });
            return;
        }

        context.Items["AccountId"] = accountId;
        await downstreamHandler(context);
    }

    private static async Task<int?> ValidateToken(string? token, DatabaseContext dbContext)
    {
        var account = await dbContext.Accounts.FirstOrDefaultAsync(account => account.Token == token);
        return account?.Id;
    }
}