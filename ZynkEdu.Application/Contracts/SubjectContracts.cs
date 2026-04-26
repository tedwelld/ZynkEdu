using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateSubjectRequest(
    [Required, MinLength(2)] string Name);

public sealed record UpdateSubjectRequest(
    [Required, MinLength(2)] string Name);

public sealed record SubjectResponse(
    int Id,
    int SchoolId,
    string Name);
