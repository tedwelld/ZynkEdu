using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IAssessmentStructureService
{
    Task<IReadOnlyList<AssessmentStructureResponse>> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AssessmentStructureResponse> GetForLevelAsync(string level, int? subjectId = null, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AssessmentStructureResponse> SaveAsync(SaveAssessmentStructureRequest request, int? id = null, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}
