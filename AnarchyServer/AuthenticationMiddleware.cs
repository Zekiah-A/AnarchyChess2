using Microsoft.EntityFrameworkCore;

namespace AnarchyServer;

public class AuthenticationMiddleware
{
    private readonly RequestDelegate nextRequest;
    private readonly DatabaseContext databaseContext;

    public AuthenticationMiddleware(RequestDelegate nextReq, DatabaseContext db)
    {
        nextRequest = nextReq;
        databaseContext = db;
    }

    public async Task Invoke(HttpContext context)
    {
        var accountToken = context.Request.Cookies["Token"];

        if (accountToken != null)
        {
            var account = await databaseContext.Accounts
                .SingleOrDefaultAsync(account => account.Token == accountToken);
            context.Items["Account"] = account;
        }

        await nextRequest(context);
    }

}