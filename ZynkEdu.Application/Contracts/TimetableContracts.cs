using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record GenerateTimetableRequest(
    [Required, MinLength(2)] string Term);

public sealed record PublishTimetableRequest(
    [Required, MinLength(2)] string Term);

public sealed record UpsertTimetableSlotRequest(
    [Required] int TeacherId,
    [Required] int SubjectId,
    [Required, MinLength(1)] string Class,
    [Required, MinLength(2)] string Term,
    [Required, MinLength(3)] string DayOfWeek,
    [Required] string StartTime,
    [Required] string EndTime);

public sealed record TimetableResponse(
    int Id,
    int SchoolId,
    int TeacherId,
    string TeacherName,
    int SubjectId,
    string SubjectName,
    string Class,
    string GradeLevel,
    string Term,
    string DayOfWeek,
    string StartTime,
    string EndTime);

public sealed record TimetablePublicationResponse(
    int SchoolId,
    string Term,
    DateTime PublishedAt,
    DateTime? DispatchedAt);
