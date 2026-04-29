using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class TimetablePublication : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Term { get; set; } = string.Empty;
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DispatchedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
