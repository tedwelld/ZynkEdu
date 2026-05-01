using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class FeeStructure : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string GradeLevel { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
