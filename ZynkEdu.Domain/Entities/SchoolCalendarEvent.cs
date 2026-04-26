using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class SchoolCalendarEvent : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int AcademicTermId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly EventDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AcademicTerm AcademicTerm { get; set; } = null!;
}
