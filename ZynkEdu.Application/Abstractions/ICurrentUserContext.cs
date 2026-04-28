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
    UserRole? Role { get; }
    string? ParentPhone { get; }
    string? ParentEmail { get; }
}
