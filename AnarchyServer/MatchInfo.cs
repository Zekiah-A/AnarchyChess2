namespace AnarchyServer;

public record MatchInfo(int MatchId, int CreatorId, string Name, int Capacity, int PlayerCount, int RulesetId, int ArrangementId);