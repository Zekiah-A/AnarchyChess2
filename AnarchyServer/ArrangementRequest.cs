namespace AnarchyServer;

public record ArrangementRequest
(
    string Name,
    int Rows,
    int Columns,
    // JSON string representing a Piece[][]
    string Pieces
); 