using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class StudentMovement : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string ProfileKey { get; set; } = string.Empty;
    public int SourceStudentId { get; set; }
    public Student SourceStudent { get; set; } = default!;
    public int? DestinationStudentId { get; set; }
    public Student? DestinationStudent { get; set; }
    public int? SourceSchoolId { get; set; }
    public int? DestinationSchoolId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string SourceClass { get; set; } = string.Empty;
    public string SourceLevel { get; set; } = string.Empty;
    public string? DestinationClass { get; set; }
    public string? DestinationLevel { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public DateTime EffectiveDate { get; set; }
    public int? PromotionRunId { get; set; }
    public StudentProgressionRun? PromotionRun { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
