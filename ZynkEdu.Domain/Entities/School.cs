using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class School : EntityBase
{
    public string SchoolCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? AdminContactEmail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Amount charged per overdue day when a library loan is returned late.
    /// Null means no automatic fine is applied.
    /// </summary>
    public decimal? LibraryOverdueFineRatePerDay { get; set; }
}
