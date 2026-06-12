using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class SchoolExpense : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int CategoryId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime ExpenseDate { get; set; }
    public string? Reference { get; set; }
    public string? Description { get; set; }
    public int RecordedByUserId { get; set; }
    public int? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ExpenseCategory Category { get; set; } = null!;
    public AppUser RecordedBy { get; set; } = null!;
}
