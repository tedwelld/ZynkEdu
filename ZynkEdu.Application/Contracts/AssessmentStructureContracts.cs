using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record AssessmentStructureResponse(
    int Id,
    int SchoolId,
    string Level,
    int? SubjectId,
    string? SubjectName,
    decimal TestWeight,
    decimal AssignmentWeight,
    decimal ExamWeight,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SaveAssessmentStructureRequest(
    [Required, MinLength(1)] string Level,
    int? SubjectId,
    [Range(0, 100)] decimal TestWeight,
    [Range(0, 100)] decimal AssignmentWeight,
    [Range(0, 100)] decimal ExamWeight);
