using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

/// <summary>
/// Defines the component weights (test, CA, exam) for a given school level and optionally a specific subject.
/// When <see cref="SubjectId"/> is null the weights apply to all subjects at the specified level.
/// </summary>
public sealed class AssessmentStructure : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    /// <summary>Level this structure applies to, e.g. "Primary", "Secondary".</summary>
    public string Level { get; set; } = string.Empty;
    /// <summary>Null means applies to all subjects at the level.</summary>
    public int? SubjectId { get; set; }
    public Subject? Subject { get; set; }
    /// <summary>Weight (0–100) of the test component.</summary>
    public decimal TestWeight { get; set; } = 30m;
    /// <summary>Weight (0–100) of the continuous assessment component.</summary>
    public decimal AssignmentWeight { get; set; } = 20m;
    /// <summary>Weight (0–100) of the final exam component.</summary>
    public decimal ExamWeight { get; set; } = 50m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
