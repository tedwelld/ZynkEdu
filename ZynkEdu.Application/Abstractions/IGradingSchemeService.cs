using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IGradingSchemeService
{
    Task<GradingSchemeResponse> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<GradingSchemeResponse> SaveAsync(SaveGradingSchemeRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<string> ResolveGradeAsync(int schoolId, string level, decimal score, CancellationToken cancellationToken = default);
    Task EnsureDefaultsAsync(int schoolId, CancellationToken cancellationToken = default);
}
