using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record StudentMovementRequest(
    [Required] int StudentId,
    [Required, MinLength(2)] string Action,
    int? TargetSchoolId,
    string? TargetClass,
    string? TargetLevel,
    string? Reason,
    string? Notes,
    DateTime EffectiveDate,
    bool CopySubjects = true);

public sealed record StudentMovementResponse(
    int MovementId,
    int SchoolId,
    int SourceStudentId,
    int? DestinationStudentId,
    string ProfileKey,
    string Action,
    string SourceClass,
    string SourceLevel,
    string? DestinationClass,
    string? DestinationLevel,
    int? SourceSchoolId,
    int? DestinationSchoolId,
    string? Reason,
    string? Notes,
    DateTime EffectiveDate,
    DateTime CreatedAt);

public sealed record StudentPromotionRunRequest(
    [Required, MinLength(2)] string AcademicYearLabel,
    string? Notes,
    [Required] IReadOnlyList<StudentMovementRequest> Items);

public sealed record StudentPromotionRunResponse(
    int RunId,
    int SchoolId,
    string AcademicYearLabel,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime? CommittedAt,
    IReadOnlyList<StudentMovementResponse> Movements);
