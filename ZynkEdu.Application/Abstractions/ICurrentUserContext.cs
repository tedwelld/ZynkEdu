using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Abstractions;

public interface ICurrentUserContext
{
    bool IsAuthenticated { get; }
    bool HasSchoolScope { get; }
    bool IsPlatformAdmin { get; }
    int? UserId { get; }
    int? SchoolId { get; }
    string? UserName { get; }
    string? DisplayName { get; }
    UserRole? Role { get; }
}
