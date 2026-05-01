using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class AuditLog : EntityBase
{
    public int? SchoolId { get; set; }
    public int? ActorUserId { get; set; }
    public string ActorRole { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public DateTime CreatedAt { get; set; }
}
