using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record AcademicTermResponse(
    int Id,
    int SchoolId,
    int TermNumber,
    string Name,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt);

public sealed record UpsertAcademicTermRequest(
    [Required, MinLength(2)] string Name,
    DateOnly? StartDate,
    DateOnly? EndDate);

public sealed record SchoolCalendarEventResponse(
    int Id,
    int SchoolId,
    int AcademicTermId,
    string TermName,
    string Title,
    string? Description,
    DateOnly EventDate,
    DateTime CreatedAt);

public sealed record CreateSchoolCalendarEventRequest(
    [Required] int AcademicTermId,
    [Required, MinLength(2)] string Title,
    string? Description,
    [Required] DateOnly EventDate);
