using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class StudentProgressionRun : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string AcademicYearLabel { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CommittedAt { get; set; }
    public ICollection<StudentMovement> Movements { get; set; } = new List<StudentMovement>();
}
