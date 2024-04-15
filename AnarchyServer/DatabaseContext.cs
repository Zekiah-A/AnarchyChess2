using AnarchyServer.DataModel;
using Microsoft.EntityFrameworkCore;

namespace AnarchyServer;

public class DatabaseContext : DbContext
{
    public DbSet<Account> Accounts { get; set; }
    public DbSet<Arrangement> Arrangements { get; set; }
    public DbSet<Ruleset> Rulesets { get; set; }

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

        // Primary key for Arrangement
        modelBuilder.Entity<Arrangement>()
            .HasKey(arrangement => arrangement.Id);
        // Many to one ruleset : Account
        modelBuilder.Entity<Arrangement>()
            .HasOne(arrangement => arrangement.Creator)
            .WithMany(account => account.Arrangements)
            .HasForeignKey(arrangement => arrangement.CreatorId);

        // Primary key for ruleset
        modelBuilder.Entity<Ruleset>()
            .HasKey(ruleset => ruleset.Id);
        // Many to one ruleset : Account
        modelBuilder.Entity<Ruleset>()
            .HasOne(ruleset => ruleset.Creator)
            .WithMany(account => account.Rulesets)
            .HasForeignKey(ruleset => ruleset.CreatorId);

        base.OnModelCreating(modelBuilder);
    }
}