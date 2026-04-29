using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Subject : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GradeLevel { get; set; } = string.Empty;
    public int WeeklyLoad { get; set; } = 1;
    public bool IsPractical { get; set; }
    public ICollection<TeacherAssignment> TeacherAssignments { get; set; } = new List<TeacherAssignment>();
}
