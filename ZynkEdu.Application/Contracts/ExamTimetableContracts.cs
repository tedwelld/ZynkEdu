using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record ExamTimetableEntryResponse(
    int Id,
    int SchoolId,
    string Term,
    string Class,
    int SubjectId,
    string SubjectName,
    string ExamDate,
    string StartTime,
    string EndTime,
    string? Venue,
    string? Notes,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateExamTimetableEntryRequest(
    [Required, MinLength(1)] string Term,
    [Required, MinLength(1)] string Class,
    [Required] int SubjectId,
    [Required] string ExamDate,
    [Required] string StartTime,
    [Required] string EndTime,
    string? Venue,
    string? Notes);

public sealed record UpdateExamTimetableEntryRequest(
    [Required, MinLength(1)] string Term,
    [Required, MinLength(1)] string Class,
    [Required] int SubjectId,
    [Required] string ExamDate,
    [Required] string StartTime,
    [Required] string EndTime,
    string? Venue,
    string? Notes);

public sealed record PublishExamTimetableRequest(
    [Required, MinLength(1)] string Term,
    string? Class);

public sealed record BulkCreateExamTimetableRequest(
    [Required, MinLength(1)] string Term,
    [Required] IReadOnlyList<CreateExamTimetableEntryRequest> Entries);
