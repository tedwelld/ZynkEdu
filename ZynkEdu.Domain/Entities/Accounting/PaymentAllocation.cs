using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities.Accounting;

/// <summary>
/// Records how much of a specific Payment is allocated to a specific Invoice.
/// Multiple allocations per payment support partial payment tracking across invoices.
/// </summary>
public sealed class PaymentAllocation : ISchoolScoped
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public int PaymentId { get; set; }
    public Payment Payment { get; set; } = default!;
    public int InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = default!;
    public decimal AllocatedAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
