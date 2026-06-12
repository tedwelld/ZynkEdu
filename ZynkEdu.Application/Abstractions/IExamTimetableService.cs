using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IExamTimetableService
{
    Task<IReadOnlyList<ExamTimetableEntryResponse>> GetAllAsync(int? schoolId = null, string? term = null, string? @class = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamTimetableEntryResponse>> GetMyAsync(string? term = null, CancellationToken cancellationToken = default);
    Task<ExamTimetableEntryResponse> CreateAsync(CreateExamTimetableEntryRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<ExamTimetableEntryResponse> UpdateAsync(int id, UpdateExamTimetableEntryRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamTimetableEntryResponse>> PublishAsync(PublishExamTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamTimetableEntryResponse>> BulkCreateAsync(BulkCreateExamTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
}
