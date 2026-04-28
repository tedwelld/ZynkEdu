using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Student : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string StudentNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Class { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public int EnrollmentYear { get; set; }
    public int? GuardianId { get; set; }
    public Guardian? Guardian { get; set; }
    public string ParentEmail { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string ParentPasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Result> Results { get; set; } = new List<Result>();
    public ICollection<StudentSubjectEnrollment> SubjectEnrollments { get; set; } = new List<StudentSubjectEnrollment>();
}
