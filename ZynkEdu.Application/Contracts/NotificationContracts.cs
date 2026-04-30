using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Contracts;

public enum NotificationAudience
{
    All = 0,
    Individual = 1,
    Class = 2,
    Teachers = 3,
    Admins = 4,
    PlatformAdmins = 5,
    Guardians = 6
}

public sealed record SendNotificationRequest(
    string Title,
    string Message,
    NotificationType Type,
    IReadOnlyList<int>? StudentIds = null,
    NotificationAudience Audience = NotificationAudience.All,
    int? SchoolId = null,
    string? ClassName = null,
    IReadOnlyList<int>? StaffIds = null);

public sealed record NotificationRecipientResponse(
    int? StudentId,
    string RecipientName,
    string Destination,
    string Status,
    int Attempts,
    string? LastError,
    string RecipientType);

public sealed record NotificationResponse(
    int Id,
    int SchoolId,
    string Title,
    string Message,
    NotificationType Type,
    int CreatedBy,
    DateTime CreatedAt,
    IReadOnlyList<NotificationRecipientResponse> Recipients);
