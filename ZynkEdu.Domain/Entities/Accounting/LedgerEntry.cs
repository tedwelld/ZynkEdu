using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class LedgerEntry : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int TransactionId { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
