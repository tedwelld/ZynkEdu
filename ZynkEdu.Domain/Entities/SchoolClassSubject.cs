using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class SchoolClassSubject : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int SchoolClassId { get; set; }
    public SchoolClass SchoolClass { get; set; } = default!;
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
