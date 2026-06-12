using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record StudentDocumentResponse(
    int Id,
    int SchoolId,
    int StudentId,
    string StudentName,
    string DocumentType,
    string OriginalFileName,
    long FileSizeBytes,
    string ContentType,
    string? Notes,
    string UploadedByName,
    DateTime CreatedAt);

public sealed record UploadStudentDocumentRequest(
    [Required] int StudentId,
    [Required, MinLength(1)] string DocumentType,
    string? Notes);
