using System.Text.Json.Serialization;

namespace AnarchyServer.DataModel;

public class Settings
{
    [JsonIgnore]
    public int AccountId { get; set; }
    public BoardTheme Theme { get; set; }
    public bool SoundEnabled { get; set; }

    // Navigation property one-to-one
    [JsonIgnore]
    public Account Account { get; set; }
}