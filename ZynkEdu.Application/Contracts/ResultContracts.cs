using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateResultRequest(
    [Required] int StudentId,
    [Required] int SubjectId,
    [Range(0, 100)] decimal Score,
    [Required, MinLength(1)] string Term,
    string? Comment);

public sealed record ResultResponse(
    int Id,
    int SchoolId,
    int StudentId,
    string StudentName,
    string StudentNumber,
    int SubjectId,
    string SubjectName,
    int TeacherId,
    string TeacherName,
    decimal Score,
    string Grade,
    string Term,
    string? Comment,
    DateTime CreatedAt);
