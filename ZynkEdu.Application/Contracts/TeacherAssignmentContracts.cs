using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateTeacherAssignmentRequest(
    [Required] int TeacherId,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class);

public sealed record UpdateTeacherAssignmentRequest(
    [Required] int TeacherId,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class);

public sealed record TeacherAssignmentResponse(
    int Id,
    int SchoolId,
    int TeacherId,
    string TeacherName,
    int SubjectId,
    string SubjectName,
    string Class);
