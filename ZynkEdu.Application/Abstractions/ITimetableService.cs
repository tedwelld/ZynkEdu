using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface ITimetableService
{
    Task<IReadOnlyList<TimetableResponse>> GetMyTimetableAsync(string? term = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TimetableResponse>> GenerateAsync(GenerateTimetableRequest request, CancellationToken cancellationToken = default);
}
