using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class ParentOtpChallenge : EntityBase
{
    public string Destination { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
}
