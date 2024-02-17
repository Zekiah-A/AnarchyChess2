namespace AnarchyServer;

public record RulesetRequest(string Name, Dictionary<string, Dictionary<string, object>>[] Rules);