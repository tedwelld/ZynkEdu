using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class ExamTimetableEntry : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Term { get; set; } = string.Empty;
    public string Class { get; set; } = string.Empty;
    public int SubjectId { get; set; }
    public DateOnly ExamDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public string? Venue { get; set; }
    public string? Notes { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Subject Subject { get; set; } = null!;
}
