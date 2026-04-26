using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Contracts;

public sealed record SendNotificationRequest(
    string Title,
    string Message,
    NotificationType Type,
    IReadOnlyList<int>? StudentIds = null);

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
