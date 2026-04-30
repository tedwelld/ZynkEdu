using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Infrastructure.Services;

public sealed class CurrentUserContext : ICurrentUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public bool IsPlatformAdmin => Role == UserRole.PlatformAdmin;

    public bool HasSchoolScope => Role is UserRole.Admin or UserRole.Teacher;

    public int? UserId => int.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public int? SchoolId => int.TryParse(User?.FindFirstValue("school_id"), out var schoolId) ? schoolId : null;

    public string? UserName => User?.FindFirstValue(ClaimTypes.Name);

    public UserRole? Role
    {
        get
        {
            var roleValue = User?.FindFirstValue(ClaimTypes.Role);
            return Enum.TryParse<UserRole>(roleValue, out var role) ? role : null;
        }
    }
}
