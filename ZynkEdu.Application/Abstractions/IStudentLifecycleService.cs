using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IStudentLifecycleService
{
    Task<StudentMovementResponse> MoveAsync(StudentMovementRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<StudentPromotionRunResponse> CommitPromotionRunAsync(StudentPromotionRunRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
}
