using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class StudentDocumentService : IStudentDocumentService
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    };

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;
    private readonly FileStoreOptions _options;

    public StudentDocumentService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IAuditLogService auditLogService,
        IOptions<FileStoreOptions> options)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
        _options = options.Value;
    }

    public async Task<IReadOnlyList<StudentDocumentResponse>> GetByStudentAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        var docs = await _dbContext.StudentDocuments.AsNoTracking()
            .Include(d => d.Student)
            .Where(d => d.StudentId == studentId && d.SchoolId == resolvedSchoolId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

        var uploaderIds = docs.Select(d => d.UploadedByUserId).Distinct().ToList();
        var uploaders = await _dbContext.Users.AsNoTracking()
            .Where(u => uploaderIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        return docs.Select(d =>
        {
            uploaders.TryGetValue(d.UploadedByUserId, out var uploaderName);
            return new StudentDocumentResponse(
                d.Id, d.SchoolId, d.StudentId, d.Student.FullName,
                d.DocumentType, d.OriginalFileName, d.FileSizeBytes,
                d.ContentType, d.Notes, uploaderName ?? "Unknown", d.CreatedAt);
        }).ToList();
    }

    public async Task<StudentDocumentResponse> UploadAsync(
        UploadStudentDocumentRequest request,
        Stream fileStream,
        string originalFileName,
        string contentType,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var userId = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("User context required.");

        if (!AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("Only JPEG, PNG, WebP images and PDF files are allowed.");

        if (fileStream.Length > _options.MaxFileSizeBytes)
            throw new InvalidOperationException($"File exceeds the maximum allowed size of {_options.MaxFileSizeBytes / (1024 * 1024)} MB.");

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == request.StudentId && s.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Student not found in this school.");

        var extension = Path.GetExtension(originalFileName).ToLowerInvariant();
        var storedFileName = $"{Guid.NewGuid()}{extension}";
        var schoolDir = Path.Combine(_options.BasePath, "student-documents", resolvedSchoolId.ToString());
        Directory.CreateDirectory(schoolDir);
        var filePath = Path.Combine(schoolDir, storedFileName);

        await using (var fs = File.Create(filePath))
        {
            fileStream.Position = 0;
            await fileStream.CopyToAsync(fs, cancellationToken);
        }

        var document = new StudentDocument
        {
            SchoolId = resolvedSchoolId,
            StudentId = request.StudentId,
            DocumentType = request.DocumentType.Trim(),
            OriginalFileName = Path.GetFileName(originalFileName),
            StoredFileName = storedFileName,
            FileSizeBytes = fileStream.Length,
            ContentType = contentType,
            Notes = request.Notes?.Trim(),
            UploadedByUserId = userId
        };

        _dbContext.StudentDocuments.Add(document);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Uploaded", "StudentDocument", document.Id.ToString(),
            $"Document '{document.OriginalFileName}' ({document.DocumentType}) uploaded for student {student.FullName}.", cancellationToken);

        var uploaderName = await _dbContext.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

        return new StudentDocumentResponse(
            document.Id, document.SchoolId, document.StudentId, student.FullName,
            document.DocumentType, document.OriginalFileName, document.FileSizeBytes,
            document.ContentType, document.Notes, uploaderName, document.CreatedAt);
    }

    public async Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        var document = await _dbContext.StudentDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Document not found.");

        var filePath = Path.Combine(_options.BasePath, "student-documents", resolvedSchoolId.ToString(), document.StoredFileName);
        if (!File.Exists(filePath))
            throw new InvalidOperationException("The document file could not be found on the server.");

        return (File.OpenRead(filePath), document.ContentType, document.OriginalFileName);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var document = await _dbContext.StudentDocuments.FirstOrDefaultAsync(d => d.Id == id && d.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Document not found.");

        var filePath = Path.Combine(_options.BasePath, "student-documents", resolvedSchoolId.ToString(), document.StoredFileName);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        _dbContext.StudentDocuments.Remove(document);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Deleted", "StudentDocument", id.ToString(),
            $"Document {id} deleted.", cancellationToken);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        return _currentUserContext.SchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private int ResolveEditableSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        if (_currentUserContext.SchoolId is not int resolvedSchoolId ||
            _currentUserContext.Role is not (UserRole.Admin or UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior))
            throw new UnauthorizedAccessException("Only admins and accountants can manage student documents.");

        return resolvedSchoolId;
    }
}
