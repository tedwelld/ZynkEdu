using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class TimetableDispatchLog : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TeacherId { get; set; }
    public string Term { get; set; } = string.Empty;
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DispatchedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
