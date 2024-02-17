namespace AnarchyServer;

public record ArrangementRequest(string Name, int Rows, int Columns, Piece[][] Pieces);