using AnarchyServer.DataModel;

namespace AnarchyServer;

// https://learn.microsoft.com/en-us/ef/core/modeling/relationships/many-to-many
// Linker table schema of many to many accounnt to past match
public class AccountPastMatch
{
    public int AccountId { get; set; }
    // Navigation property for account
    public Account Account { get; set; } = null!;
    
    public int PastMatchId { get; set; }
    // Navigation property for past match
    public PastMatch PastMatch { get; set; } = null!;
}