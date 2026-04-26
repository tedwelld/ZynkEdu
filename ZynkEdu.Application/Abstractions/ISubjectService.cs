using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface ISubjectService
{
    Task<SubjectResponse> CreateAsync(CreateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SubjectResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SubjectResponse> UpdateAsync(int id, UpdateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}
