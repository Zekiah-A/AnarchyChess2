namespace AnarchyServer.DataModel;

public class Settings
{
    public int AccountId { get; set; }
    public BoardTheme Theme { get; set; }
    public bool SoundEnabled { get; set; }

    // Navigation property one-to-one
    public Account Account { get; set; }
}