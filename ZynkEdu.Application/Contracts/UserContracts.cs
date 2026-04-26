using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateSchoolUserRequest(
    [Required, MinLength(3)] string Username,
    [Required, MinLength(2)] string DisplayName,
    [Required, MinLength(8)] string Password);

public sealed record CreateTeacherWithAssignmentRequest(
    [Required, MinLength(3)] string Username,
    [Required, MinLength(2)] string DisplayName,
    [Required, MinLength(8)] string Password,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class);

public sealed record UpdateSchoolUserRequest(
    [Required, MinLength(2)] string DisplayName,
    string? Password,
    bool IsActive);

public sealed record UserResponse(
    int Id,
    string Username,
    string DisplayName,
    string Role,
    int SchoolId,
    DateTime CreatedAt,
    bool IsActive);
