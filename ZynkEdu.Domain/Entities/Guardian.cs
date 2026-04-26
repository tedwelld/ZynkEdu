using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Guardian : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int? StudentId { get; set; }
    public Student? Student { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string ParentEmail { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
