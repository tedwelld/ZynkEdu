using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class PlatformSubjectCatalog : EntityBase
{
    public string? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GradeLevel { get; set; } = string.Empty;
    public int? SourceSchoolId { get; set; }
    public int? SourceSubjectId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
