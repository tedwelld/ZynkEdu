using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class TeacherAssignment : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TeacherId { get; set; }
    public AppUser Teacher { get; set; } = default!;
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = default!;
    public string Class { get; set; } = string.Empty;
}
