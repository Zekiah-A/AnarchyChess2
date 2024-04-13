namespace AnarchyServer;

public record struct PieceInfo(PieceLocation Location, Piece Piece, List<PieceLocation> Moves);