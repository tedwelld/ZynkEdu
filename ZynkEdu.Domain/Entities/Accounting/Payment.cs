using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities.Accounting;

public sealed class Payment : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public int StudentAccountId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public int CapturedByUserId { get; set; }
    public int? AccountingTransactionId { get; set; }
}
