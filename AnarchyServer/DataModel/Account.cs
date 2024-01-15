namespace AnarchyServer.DataModel;

public class Account
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string? Biography { get; set; }
    public string? ProfileImageUri { get; set; }
    public string Email { get; set; }
    public string Token { get; set; }

    // Navigation property one to one
    public Settings Settings { get; set; }
}