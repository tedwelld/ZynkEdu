using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IStudentDocumentService
{
    Task<IReadOnlyList<StudentDocumentResponse>> GetByStudentAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<StudentDocumentResponse> UploadAsync(UploadStudentDocumentRequest request, Stream fileStream, string originalFileName, string contentType, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}
