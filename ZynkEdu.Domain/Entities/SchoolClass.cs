using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class SchoolClass : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GradeLevel { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SchoolClassSubject> Subjects { get; set; } = new List<SchoolClassSubject>();
}
