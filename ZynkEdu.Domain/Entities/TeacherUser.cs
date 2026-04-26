using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class TeacherUser : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public AppUser Account { get; set; } = default!;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
