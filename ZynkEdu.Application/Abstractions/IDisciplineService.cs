using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IDisciplineService
{
    Task<IReadOnlyList<DisciplineIncidentResponse>> GetAllAsync(int? schoolId = null, int? studentId = null, bool? isResolved = null, CancellationToken cancellationToken = default);
    Task<DisciplineIncidentResponse> CreateAsync(CreateDisciplineIncidentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<DisciplineIncidentResponse> UpdateAsync(int id, UpdateDisciplineIncidentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}
