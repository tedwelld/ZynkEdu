namespace ZynkEdu.Application.Contracts;

public sealed record AuditLogResponse(
    int Id,
    int? SchoolId,
    int? ActorUserId,
    string ActorRole,
    string ActorName,
    string Action,
    string EntityType,
    string EntityId,
    string Summary,
    string? OldValue,
    string? NewValue,
    DateTime CreatedAt);
