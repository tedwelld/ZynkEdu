using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class Invoice : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public int StudentAccountId { get; set; }
    public string Term { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public InvoiceStatus Status { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueAt { get; set; }
    public int CreatedByUserId { get; set; }
    public int? AccountingTransactionId { get; set; }
}
