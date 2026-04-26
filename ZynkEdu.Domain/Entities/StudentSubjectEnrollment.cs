using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class StudentSubjectEnrollment : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public int SubjectId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Student Student { get; set; } = null!;
    public Subject Subject { get; set; } = null!;
}
