using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record LoginRequest(
    [Required, MinLength(3)] string Username,
    [Required, MinLength(6)] string Password,
    string? SchoolName);

public sealed record LoginResponse(
    string AccessToken,
    string Role,
    int? SchoolId,
    int? UserId,
    string DisplayName);

public sealed record SchoolCreateRequest(
    [Required, MinLength(2)] string Name,
    [Required, MinLength(3)] string Address,
    [Required, EmailAddress] string AdminContactEmail);

public sealed record SchoolCreateWithAdminRequest(
    [Required, MinLength(2)] string Name,
    [Required, MinLength(3)] string Address,
    [Required, EmailAddress] string AdminContactEmail,
    [Required, MinLength(3)] string AdminUsername,
    [Required, MinLength(2)] string AdminDisplayName,
    [Required, MinLength(6)] string AdminPassword,
    bool AdminIsActive);

public sealed record UpdateSchoolRequest(
    [Required, MinLength(2)] string Name,
    [Required, MinLength(3)] string Address,
    [Required, EmailAddress] string AdminContactEmail);

public sealed record SchoolResponse(
    int Id,
    string SchoolCode,
    string Name,
    string Address,
    string? AdminContactEmail,
    DateTime CreatedAt);
