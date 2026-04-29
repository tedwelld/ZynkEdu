using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateSubjectRequest(
    [Required, MinLength(2)] string Name,
    string? Code = null,
    string? GradeLevel = null,
    [Range(1, 9)] int WeeklyLoad = 1,
    bool IsPractical = false);

public sealed record UpdateSubjectRequest(
    [Required, MinLength(2)] string Name,
    string? Code = null,
    string? GradeLevel = null,
    [Range(1, 9)] int WeeklyLoad = 1,
    bool IsPractical = false);

public sealed record SubjectResponse(
    int Id,
    int SchoolId,
    string Code,
    string Name,
    string GradeLevel,
    int WeeklyLoad,
    bool IsPractical);
