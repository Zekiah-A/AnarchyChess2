using AnarchyServer.DataModel;
using Microsoft.EntityFrameworkCore;

namespace AnarchyServer;

public class DatabaseContext : DbContext
{
    public DbSet<Account> Accounts;
    
    public DatabaseContext()
    {
    }
    
    public DatabaseContext(DbContextOptions<DatabaseContext> options) : base(options)
    {
    }
}