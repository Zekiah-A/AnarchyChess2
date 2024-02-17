using System.Text.Json.Nodes;

namespace AnarchyServer;

public record RulesetRequest(string Name, string Rules);