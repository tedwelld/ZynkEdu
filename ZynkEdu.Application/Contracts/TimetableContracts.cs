using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record GenerateTimetableRequest(
    [Required, MinLength(2)] string Term);

public sealed record TimetableResponse(
    int Id,
    int SchoolId,
    int TeacherId,
    string TeacherName,
    int SubjectId,
    string SubjectName,
    string Class,
    string Term,
    string DayOfWeek,
    string StartTime,
    string EndTime);
