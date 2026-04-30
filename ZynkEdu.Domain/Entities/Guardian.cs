using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class Guardian : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public Student? Student { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string ParentEmail { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string IdentityDocumentType { get; set; } = string.Empty;
    public string IdentityDocumentNumber { get; set; } = string.Empty;
    public string BirthCertificateNumber { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
