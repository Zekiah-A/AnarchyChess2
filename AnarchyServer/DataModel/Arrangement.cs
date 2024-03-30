using System.Text.Json.Serialization;

namespace AnarchyServer.DataModel;

public class Arrangement
{
    public int Id { get; set; }
    public int? CreatorId { get; set; }
    public string Name { get; set; }
    public int Rows { get; set; }
    public int Columns { get; set; }
    // PieceData[][] string JSON data
    public string Data { get; set; }

    //  Navigation property to Account
    [JsonIgnore]
    public Account? Creator { get; set; } = null!;

    public Arrangement(int creatorId, string name, int rows, int columns, string data)
    {
        CreatorId = creatorId;
        Name = name;
        Rows = rows;
        Columns = columns;
        Data = data;
    }

    // EFCore
    public Arrangement() {}
}