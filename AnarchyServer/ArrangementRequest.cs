namespace AnarchyServer;

public record ArrangementRequest(int Rows, int Columns, PieceData[][] Data);

public record PieceData(string Type, string Colour);