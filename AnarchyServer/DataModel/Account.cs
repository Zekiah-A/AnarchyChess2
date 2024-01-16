using System.Text.Json.Serialization;
using Microsoft.AspNetCore.SignalR;

namespace AnarchyServer.DataModel;

public class Account
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string? Biography { get; set; }
    public string? ProfileImageUri { get; set; }
    public string Email { get; set; }
    public string Token { get; set; }

    public int GamesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int PlayTime { get; set; }

    // Navigation property one to one
    [JsonIgnore]
    public Settings Settings { get; set; }
}