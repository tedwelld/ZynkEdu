using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AuthService : IAuthService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthService(
        ZynkEduDbContext dbContext,
        IPasswordHasher<AppUser> passwordHasher,
        IJwtTokenService jwtTokenService)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var schoolName = request.SchoolName?.Trim();

        var platformAdmin = await _dbContext.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Username == username && x.Role == UserRole.PlatformAdmin && x.IsActive, cancellationToken);
        if (platformAdmin is not null &&
            _passwordHasher.VerifyHashedPassword(platformAdmin, platformAdmin.PasswordHash, request.Password) != PasswordVerificationResult.Failed)
        {
            return new LoginResponse(
                _jwtTokenService.CreateToken(platformAdmin),
                platformAdmin.Role.ToString(),
                null,
                platformAdmin.Id,
                platformAdmin.DisplayName);
        }

        var query = _dbContext.Users.AsNoTracking()
            .Where(x => x.Username == username && x.IsActive && x.Role != UserRole.PlatformAdmin);

        if (!string.IsNullOrWhiteSpace(schoolName))
        {
            var normalizedSchoolName = schoolName.ToLowerInvariant();
            var schoolId = await _dbContext.Schools.AsNoTracking()
                .Where(x => x.Name.ToLower() == normalizedSchoolName)
                .Select(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (schoolId == 0)
            {
                throw new UnauthorizedAccessException("School was not found.");
            }

            query = query.Where(x => x.SchoolId == schoolId);
        }

        var candidates = await query.OrderBy(x => x.Id).ToListAsync(cancellationToken);
        if (candidates.Count == 0)
        {
            throw new UnauthorizedAccessException("Invalid credentials.");
        }

        if (candidates.Count > 1 && string.IsNullOrWhiteSpace(schoolName))
        {
            throw new UnauthorizedAccessException("Please select your school to continue.");
        }

        var user = candidates.FirstOrDefault(candidate =>
            _passwordHasher.VerifyHashedPassword(candidate, candidate.PasswordHash, request.Password) != PasswordVerificationResult.Failed);

        if (user is null)
        {
            throw new UnauthorizedAccessException("Invalid credentials.");
        }

        return new LoginResponse(
            _jwtTokenService.CreateToken(user),
            user.Role.ToString(),
            user.Role == UserRole.PlatformAdmin ? null : user.SchoolId,
            user.Id,
            user.DisplayName);
    }

    public async Task<IReadOnlyList<SchoolResponse>> GetPublicSchoolsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Schools.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new SchoolResponse(x.Id, x.SchoolCode ?? string.Empty, x.Name, x.Address, x.AdminContactEmail, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
