using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class Notification : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<NotificationRecipient> Recipients { get; set; } = new List<NotificationRecipient>();
}
