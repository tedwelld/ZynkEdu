using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record GuardianRequest(
    [Required, MinLength(2)] string DisplayName,
    [Required, MinLength(2)] string Relationship,
    [Required, MinLength(7)] string Phone,
    [Required, EmailAddress] string Email,
    string? Address,
    string? IdentityDocumentType,
    string? IdentityDocumentNumber,
    string? BirthCertificateNumber,
    bool IsPrimary);

public sealed record GuardianResponse(
    int Id,
    int StudentId,
    string DisplayName,
    string Relationship,
    string Phone,
    string Email,
    string? Address,
    string? IdentityDocumentType,
    string? IdentityDocumentNumber,
    string? BirthCertificateNumber,
    bool IsPrimary,
    bool IsActive,
    DateTime CreatedAt);

public sealed record CreateStudentRequest(
    [Required, MinLength(2)] string FullName,
    [Required, MinLength(1)] string Class,
    [Required, MinLength(2)] string Level,
    [Required] int EnrollmentYear,
    [Required] int[] SubjectIds,
    [Required] IReadOnlyList<GuardianRequest> Guardians);

public sealed record UpdateStudentRequest(
    [Required, MinLength(2)] string FullName,
    [Required, MinLength(1)] string Class,
    [Required, MinLength(2)] string Level,
    [Required] int EnrollmentYear,
    [Required] int[] SubjectIds,
    [Required] IReadOnlyList<GuardianRequest> Guardians);

public sealed record UpdateStudentStatusRequest(
    [Required, MinLength(2)] string Status);

public sealed record StudentResponse(
    int Id,
    int SchoolId,
    string ProfileKey,
    string StudentNumber,
    string FullName,
    string Class,
    string Level,
    string Status,
    int EnrollmentYear,
    IReadOnlyList<int> SubjectIds,
    IReadOnlyList<string> Subjects,
    IReadOnlyList<GuardianResponse> Guardians,
    string ParentEmail,
    string ParentPhone,
    DateTime CreatedAt);

public sealed record BulkStudentSubjectEnrollmentResponse(
    int SchoolCount,
    int StudentCount,
    int SubjectCount,
    int EnrollmentCount);

public sealed record StudentCommentResponse(
    int ResultId,
    int SubjectId,
    string SubjectName,
    decimal Score,
    string Grade,
    string Term,
    string? Comment,
    DateTime CreatedAt);

public sealed record ParentReportSubjectResponse(
    int SubjectId,
    string SubjectName,
    decimal AverageMark,
    decimal? ActualMark,
    string? Grade,
    string? TeacherName,
    string? TeacherComment,
    string? Term,
    DateTime? CreatedAt);

public sealed record ParentPreviewReportResponse(
    int StudentId,
    string StudentName,
    string StudentNumber,
    string Class,
    string Level,
    int EnrollmentYear,
    string SchoolName,
    decimal OverallAverageMark,
    IReadOnlyList<ParentReportSubjectResponse> Subjects);
