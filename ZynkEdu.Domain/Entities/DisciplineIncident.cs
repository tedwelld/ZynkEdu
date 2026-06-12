using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class DisciplineIncident : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public string IncidentType { get; set; } = string.Empty;
    public string Severity { get; set; } = "Minor";
    public DateTime IncidentDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ActionTaken { get; set; }
    public int RecordedByUserId { get; set; }
    public bool IsResolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Student Student { get; set; } = null!;
}
