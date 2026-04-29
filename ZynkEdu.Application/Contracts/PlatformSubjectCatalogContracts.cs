using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record PlatformSubjectCatalogResponse(
    int Id,
    string Code,
    string Name,
    string GradeLevel,
    int WeeklyLoad,
    bool IsPractical,
    int? SourceSchoolId,
    string? SourceSchoolName);

public sealed record ImportSchoolSubjectsRequest(
    [Required] int SourceSchoolId,
    [Required, MinLength(1)] IReadOnlyList<int> SubjectIds);

public sealed record ImportSubjectsResultResponse(
    int ImportedCount,
    int SkippedCount);
