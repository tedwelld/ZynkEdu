using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class TimetableSlot : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TeacherId { get; set; }
    public int SubjectId { get; set; }
    public string Class { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public string DayOfWeek { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public AppUser Teacher { get; set; } = null!;
    public Subject Subject { get; set; } = null!;
}
