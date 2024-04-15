namespace AnarchyServer;

public record MatchCreateInfo
(
    int RulesetId,
    int ArrangementId,
    string MatchName,
    int Capacity,
    bool AdvertisePublic
);