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
        // Explicit header takes precedent over cookie, cookie used for tokenLogin to disocurage local saving of
        // token in localStorage. Use header auth when client has already logged in and received their token for the session
        var token = context.Request.Headers.Authorization.FirstOrDefault() ?? context.Request.Cookies["Authorization"];
        var accountId = await ValidateToken(token, dbContext);

        if (accountId is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
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