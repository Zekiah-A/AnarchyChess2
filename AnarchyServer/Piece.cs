namespace AnarchyServer;

public record Piece(string Type, string Colour)
{
    public string Type { get; set; } = Type;
    public string Colour { get; set; } = Colour;
    public bool Promotable { get; set; } = false;
    public bool Disturbed { get; set; } = false;
}