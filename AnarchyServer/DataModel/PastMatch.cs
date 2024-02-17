namespace AnarchyServer.DataModel;

public class PastMatch
{
    public int Id { get; set; }
    public int RulesetId { get; set; }
    public int ArrangementId { get; set; }
    public bool WasPublic { get; set; }
    public string Name { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    
    // Account ID
    public int WinnerId { get; set; }

    // Navigation property to involved accounts
    public List<Account> Players { get; } = [];
    // Linker navigation between account past match and account
    public List<AccountPastMatch> AccountPastMatch { get; } = [];

    // Navigation property to ruleset
    public Ruleset Ruleset { get; set; } = null!;
    // navigation property to arrangement
    public Arrangement Arrangement { get; set; } = null!;

    public PastMatch(int rulesetId, int arrangementId, bool wasPublic, string name, DateTime startDate, DateTime endDate)
    {
        RulesetId = rulesetId;
        ArrangementId = arrangementId;
        WasPublic = wasPublic;
        Name = name;
        StartDate = startDate;
        EndDate = endDate;
    }
}