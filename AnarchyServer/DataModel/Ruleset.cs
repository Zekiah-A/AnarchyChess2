using System.Text.Json.Serialization;

namespace AnarchyServer.DataModel;

// Bloblular data
public class Ruleset
{
    public int Id { get; set; }
    public int? CreatorId { get; set; }
    public string Name { get; set; }
    // Rule[] string JSON data
    public string Data { get; set; } = null!;

    // Navigation property to creator
    [JsonIgnore]
    public Account? Creator { get; set; } = null!;

    public Ruleset(int creatorId, string name, string data)
    {
        CreatorId = creatorId;
        Name = name;
        Data = data;
    }

    // EFCore
    public Ruleset() {}
}