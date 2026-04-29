using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface ITimetableService
{
    Task<IReadOnlyList<TimetableResponse>> GetMyTimetableAsync(string? term = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TimetableResponse>> GetAllAsync(int? schoolId = null, string? term = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TimetableResponse>> GenerateAsync(GenerateTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<TimetableResponse> CreateAsync(UpsertTimetableSlotRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<TimetableResponse> UpdateAsync(int id, UpsertTimetableSlotRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<TimetablePublicationResponse> PublishAsync(PublishTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
}
