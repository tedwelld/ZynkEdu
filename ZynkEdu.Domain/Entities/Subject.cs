using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Subject : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<TeacherAssignment> TeacherAssignments { get; set; } = new List<TeacherAssignment>();
}
