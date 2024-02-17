namespace AnarchyServer.DataModel;

public class Arrangement
{
    public int Id { get; set; }
    public int CreatorId { get; set; }
    public int Rows { get; set; }
    public int Columns { get; set; }
    // PieceData[][] string JSON data
    public string Data { get; set; }

    //  Navigation property to Account
    public Account Creator { get; set; } = null!;

    public Arrangement(int creatorId, int rows, int columns, string data)
    {
        CreatorId = creatorId;
        Rows = rows;
        Columns = columns;
        Data = data;
    }
}