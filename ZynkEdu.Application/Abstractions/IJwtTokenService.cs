using ZynkEdu.Domain.Entities;

namespace ZynkEdu.Application.Abstractions;

public interface IJwtTokenService
{
    string CreateToken(AppUser user);
    string CreateParentToken(string? phone, string? email);
}
