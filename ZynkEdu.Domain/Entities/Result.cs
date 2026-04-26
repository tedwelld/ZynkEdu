using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Result : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = default!;
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = default!;
    public int TeacherId { get; set; }
    public AppUser Teacher { get; set; } = default!;
    public decimal Score { get; set; }
    public string Grade { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
