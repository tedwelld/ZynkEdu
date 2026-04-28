using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateSchoolClassRequest(
    [Required, MinLength(2)] string ClassName,
    [Required] string GradeLevel);

public sealed record UpdateSchoolClassRequest(
    [Required, MinLength(2)] string ClassName,
    [Required] string GradeLevel,
    bool IsActive);

public sealed record AssignClassSubjectsRequest(
    IReadOnlyList<int> SubjectIds);

public sealed record SchoolClassResponse(
    int Id,
    int SchoolId,
    string ClassName,
    string GradeLevel,
    bool IsActive,
    bool IsReadyForTeaching,
    IReadOnlyList<int> SubjectIds,
    IReadOnlyList<string> SubjectNames,
    DateTime CreatedAt);
