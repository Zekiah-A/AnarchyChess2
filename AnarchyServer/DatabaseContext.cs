using AnarchyServer.DataModel;
using Microsoft.EntityFrameworkCore;

namespace AnarchyServer;

public class DatabaseContext : DbContext
{
    public DbSet<Account> Accounts { get; set; }
    public DbSet<PastMatch> Matches { get; set; }

    public DatabaseContext() { }
    public DatabaseContext(DbContextOptions<DatabaseContext> options) : base(options) { }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlite("Data Source=Server.db");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Primary key for Account
        modelBuilder.Entity<Account>()
            .HasKey(account => account.Id);
        modelBuilder.Entity<Account>()
            .ToTable("Accounts");

        // Unique username
        modelBuilder.Entity<Account>()
            .HasIndex(account => account.Username)
            .IsUnique();

        // Unique token
        modelBuilder.Entity<Account>()
            .HasIndex(account => account.Token)
            .IsUnique();

        base.OnModelCreating(modelBuilder);
    }
}