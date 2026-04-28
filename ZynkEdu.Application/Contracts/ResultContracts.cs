using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateResultRequest(
    [Required] int StudentId,
    [Required] int SubjectId,
    [Range(0, 100)] decimal Score,
    [Required, MinLength(1)] string Term,
    string? Comment);

public sealed record SendResultSlipRequest(
    bool SendEmail = true,
    bool SendSms = true);

public sealed record ResultSlipSendResponse(
    int StudentId,
    string StudentName,
    string ParentEmail,
    string ParentPhone,
    bool EmailSent,
    bool SmsSent);

public sealed record ResultResponse(
    int Id,
    int SchoolId,
    int StudentId,
    string StudentName,
    string StudentNumber,
    string StudentClass,
    int SubjectId,
    string SubjectName,
    int TeacherId,
    string TeacherName,
    decimal Score,
    string Grade,
    string Term,
    string? Comment,
    string ApprovalStatus,
    bool IsLocked,
    DateTime CreatedAt,
    int ResultYear);
