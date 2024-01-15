namespace AnarchyServer.DataModel;

public class PastMatch
{
    public int Id { get; set; }
    public int RulesetId { get; set; }
    public int ArrangementId { get; set; }
    public string Moves { get; set; }
    public bool WasPublic { get; set; }
    public string Name { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime FinishDate { get; set; }
}