using System.Text.Json.Serialization;
using Microsoft.AspNetCore.SignalR;

namespace AnarchyServer.DataModel;

public class Account
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string? Biography { get; set; }
    public string? ProfileImageUri { get; set; }
    public string? ProfileBackground { get; set; }
    public string? Gender { get; set;  }
    public string? Location { get; set; }
    public string Email { get; set; }
    public string Token { get; set; }

    public int GamesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int PlayTime { get; set; }

    public Account(string username, string email, string token)
    {
        Username = username;
        Email = email;
        Token = token;
    }
}