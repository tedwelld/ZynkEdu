using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface ISchoolClassService
{
    Task<IReadOnlyList<SchoolClassResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SchoolClassResponse> CreateAsync(CreateSchoolClassRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SchoolClassResponse> UpdateAsync(int id, UpdateSchoolClassRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SchoolClassResponse> AssignSubjectsAsync(int id, AssignClassSubjectsRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}
