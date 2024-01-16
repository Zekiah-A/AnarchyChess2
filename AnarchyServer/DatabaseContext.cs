using AnarchyServer.DataModel;
using Microsoft.EntityFrameworkCore;

namespace AnarchyServer;

public class DatabaseContext : DbContext
{
    public DbSet<Account> Accounts { get; set; }
    public DbSet<Settings> Settings { get; set; }
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
            
        // Primary key and foreign key for Settings
        modelBuilder.Entity<Settings>()
            .HasKey(settings => settings.AccountId);
        modelBuilder.Entity<Settings>()
            .ToTable("Settings");

        // One to one settings, account
        modelBuilder.Entity<Account>()
            .HasOne(account => account.Settings)
            .WithOne(settings => settings.Account)
            .HasForeignKey<Settings>(settings => settings.AccountId);

        // Unique username
        modelBuilder.Entity<Account>()
            .HasIndex(account => account.Username)
            .IsUnique();

        // Unique username
        modelBuilder.Entity<Account>()
            .HasIndex(account => account.Token)
            .IsUnique();

        base.OnModelCreating(modelBuilder);
    }
}