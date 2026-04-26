using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class AcademicTerm : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TermNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SchoolCalendarEvent> Events { get; set; } = new List<SchoolCalendarEvent>();
}
