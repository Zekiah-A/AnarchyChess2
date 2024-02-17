namespace AnarchyServer.DataModel;

// Bloblular data
public class Ruleset
{
    public int Id { get; set; }
    public int CreatorId { get; set; }
    // Rule[] string JSON data
    public string Data { get; set; } = null!;

    // Navigation property to creator
    public Account Creator { get; set; } = null!;

    public Ruleset(int creatorId, string data)
    {
        CreatorId = creatorId;
        Data = data;
    }
}