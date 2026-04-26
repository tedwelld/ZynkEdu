using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class AttendanceRegister : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TeacherId { get; set; }
    public AppUser Teacher { get; set; } = default!;
    public int AcademicTermId { get; set; }
    public AcademicTerm AcademicTerm { get; set; } = default!;
    public string Class { get; set; } = string.Empty;
    public DateTime AttendanceDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DispatchedAt { get; set; }
    public ICollection<AttendanceRegisterEntry> Entries { get; set; } = new List<AttendanceRegisterEntry>();
}
