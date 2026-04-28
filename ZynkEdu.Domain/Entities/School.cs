using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class School : EntityBase
{
    public string SchoolCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? AdminContactEmail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
