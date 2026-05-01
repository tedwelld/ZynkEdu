using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class StudentAccount : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public decimal Balance { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
