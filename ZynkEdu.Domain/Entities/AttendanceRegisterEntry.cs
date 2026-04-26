using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class AttendanceRegisterEntry : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int AttendanceRegisterId { get; set; }
    public AttendanceRegister AttendanceRegister { get; set; } = default!;
    public int StudentId { get; set; }
    public Student Student { get; set; } = default!;
    public AttendanceStatus Status { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
