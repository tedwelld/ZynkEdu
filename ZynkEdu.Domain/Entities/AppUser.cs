using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class AppUser : EntityBase, ISchoolScoped
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public int SchoolId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
}
