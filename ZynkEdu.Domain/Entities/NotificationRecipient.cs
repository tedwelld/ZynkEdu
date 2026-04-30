using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class NotificationRecipient : EntityBase
{
    public int NotificationId { get; set; }
    public Notification Notification { get; set; } = default!;
    public int? StudentId { get; set; }
    public Student? Student { get; set; }
    public int? StaffUserId { get; set; }
    public AppUser? StaffUser { get; set; }
    public string RecipientType { get; set; } = string.Empty;
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public int Attempts { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string? LastError { get; set; }
    public string? Destination { get; set; }
}
