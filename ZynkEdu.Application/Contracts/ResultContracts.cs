using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record ComponentScoreRequest(
    [Required, MaxLength(50)] string Component,
    [Range(0, 100)] decimal Score,
    [Range(0, 100)] decimal Weight);

public sealed record ComponentScoreResponse(
    string Component,
    decimal Score,
    decimal Weight);

public sealed record CreateResultRequest(
    [Required] int StudentId,
    [Required] int SubjectId,
    [Range(0, 100)] decimal Score,
    [Required, MinLength(1)] string Term,
    string? Comment,
    IReadOnlyList<ComponentScoreRequest>? ComponentScores = null);

public sealed record SendResultSlipRequest(
    bool SendEmail = true,
    bool SendSms = true);

public sealed record ResultSlipSendResponse(
    int StudentId,
    string StudentName,
    string ParentEmail,
    string ParentPhone,
    IReadOnlyList<string> GuardianEmails,
    IReadOnlyList<string> GuardianPhones,
    bool EmailSent,
    bool SmsSent);

public sealed record BulkSlipSendResponse(
    int SentCount,
    int FailedCount,
    IReadOnlyList<string> Failures);

public sealed record ReportCardSubjectRow(
    int SubjectId,
    string SubjectName,
    decimal Score,
    string Grade,
    string? Comment,
    string TeacherName,
    IReadOnlyList<ComponentScoreResponse>? ComponentScores = null);

public sealed record ReportCardResponse(
    int StudentId,
    string StudentName,
    string StudentNumber,
    string StudentClass,
    string Term,
    int ResultYear,
    string SchoolName,
    IReadOnlyList<ReportCardSubjectRow> Subjects,
    decimal AverageScore,
    string OverallGrade,
    int Rank,
    int TotalStudents,
    DateTime GeneratedAt);

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
    int ResultYear,
    IReadOnlyList<ComponentScoreResponse>? ComponentScores = null);
