using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Contracts;

public enum NotificationAudience
{
    All = 0,
    Individual = 1,
    Class = 2
}

public sealed record SendNotificationRequest(
    string Title,
    string Message,
    NotificationType Type,
    IReadOnlyList<int>? StudentIds = null,
    NotificationAudience Audience = NotificationAudience.All,
    int? SchoolId = null,
    string? ClassName = null);

public sealed record NotificationRecipientResponse(
    int StudentId,
    string StudentName,
    string Destination,
    string Status,
    int Attempts,
    string? LastError);

public sealed record NotificationResponse(
    int Id,
    int SchoolId,
    string Title,
    string Message,
    NotificationType Type,
    int CreatedBy,
    DateTime CreatedAt,
    IReadOnlyList<NotificationRecipientResponse> Recipients);
