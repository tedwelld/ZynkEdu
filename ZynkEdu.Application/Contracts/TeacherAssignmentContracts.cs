using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateTeacherAssignmentRequest(
    [Required] int TeacherId,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class);

public sealed record CreateTeacherAssignmentsBatchRequest(
    [Required] int TeacherId,
    [Required, MinLength(1)] int[] SubjectIds,
    [Required, MinLength(1)] string[] Classes);

public sealed record UpdateTeacherAssignmentRequest(
    [Required] int TeacherId,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class);

public sealed record TeacherAssignmentBatchResponse(
    int SchoolId,
    int TeacherId,
    string TeacherName,
    int RequestedCount,
    int CreatedCount,
    int SkippedCount,
    IReadOnlyList<TeacherAssignmentResponse> Assignments);

public sealed record TeacherAssignmentResponse(
    int Id,
    int SchoolId,
    int TeacherId,
    string TeacherName,
    int SubjectId,
    string SubjectName,
    string GradeLevel,
    string Class);
