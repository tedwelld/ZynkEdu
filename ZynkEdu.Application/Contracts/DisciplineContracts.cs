using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record DisciplineIncidentResponse(
    int Id,
    int SchoolId,
    int StudentId,
    string StudentName,
    string StudentClass,
    string IncidentType,
    string Severity,
    DateTime IncidentDate,
    string Description,
    string? ActionTaken,
    string RecordedByName,
    bool IsResolved,
    DateTime? ResolvedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateDisciplineIncidentRequest(
    [Required] int StudentId,
    [Required, MinLength(1), MaxLength(200)] string IncidentType,
    [Required] string Severity,
    [Required] DateTime IncidentDate,
    [Required, MinLength(1)] string Description,
    string? ActionTaken);

public sealed record UpdateDisciplineIncidentRequest(
    [Required, MinLength(1), MaxLength(200)] string IncidentType,
    [Required] string Severity,
    [Required] DateTime IncidentDate,
    [Required, MinLength(1)] string Description,
    string? ActionTaken,
    bool IsResolved);
