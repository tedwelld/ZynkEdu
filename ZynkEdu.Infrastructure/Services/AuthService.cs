using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Options;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AuthService : IAuthService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;
    private readonly ParentOtpOptions _otpOptions;

    public AuthService(
        ZynkEduDbContext dbContext,
        IPasswordHasher<AppUser> passwordHasher,
        IJwtTokenService jwtTokenService,
        IEmailSender emailSender,
        ISmsSender smsSender,
        IOptions<ParentOtpOptions> otpOptions)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _emailSender = emailSender;
        _smsSender = smsSender;
        _otpOptions = otpOptions.Value;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var parentIdentifier = request.Username.Trim();
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
            var parentGuardian = await _dbContext.Guardians.AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    (x.ParentPhone == parentIdentifier || x.ParentEmail == username) &&
                    x.IsActive,
                    cancellationToken);

            if (parentGuardian is null)
            {
                var legacyStudent = await _dbContext.Students.AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        (x.ParentPhone == parentIdentifier || x.ParentEmail == username) &&
                        !string.IsNullOrWhiteSpace(x.ParentPasswordHash),
                        cancellationToken);

                if (legacyStudent is null ||
                    _passwordHasher.VerifyHashedPassword(
                        new AppUser { Username = legacyStudent.ParentEmail, SchoolId = legacyStudent.SchoolId },
                        legacyStudent.ParentPasswordHash,
                        request.Password) == PasswordVerificationResult.Failed)
                {
                    throw new UnauthorizedAccessException("Invalid credentials.");
                }

                return new LoginResponse(
                    _jwtTokenService.CreateParentToken(legacyStudent.ParentPhone, legacyStudent.ParentEmail),
                    UserRole.Parent.ToString(),
                    legacyStudent.SchoolId,
                    null,
                    legacyStudent.FullName);
            }

            if (_passwordHasher.VerifyHashedPassword(
                    new AppUser { Username = parentGuardian.ParentEmail, SchoolId = parentGuardian.SchoolId },
                    parentGuardian.PasswordHash,
                    request.Password) == PasswordVerificationResult.Failed)
            {
                throw new UnauthorizedAccessException("Invalid credentials.");
            }

            return new LoginResponse(
                _jwtTokenService.CreateParentToken(parentGuardian.ParentPhone, parentGuardian.ParentEmail),
                UserRole.Parent.ToString(),
                parentGuardian.SchoolId,
                null,
                parentGuardian.DisplayName);
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

    public async Task<ParentOtpResponse> RequestParentOtpAsync(ParentOtpRequest request, CancellationToken cancellationToken = default)
    {
        var destination = NormalizeDestination(request);
        var guardian = await FindGuardianByParentDestinationAsync(destination, cancellationToken);
        var legacyStudent = guardian is null ? await FindStudentByParentDestinationAsync(destination, cancellationToken) : null;
        if (guardian is null && legacyStudent is null)
        {
            throw new InvalidOperationException("No student matches that parent contact.");
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var challenge = new ParentOtpChallenge
        {
            Destination = destination,
            CodeHash = HashCode(destination, code),
            Attempts = 0,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_otpOptions.ExpirationMinutes)
        };

        _dbContext.ParentOtpChallenges.Add(challenge);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var message = $"Your ZynkEdu OTP is {code}. It expires in {_otpOptions.ExpirationMinutes} minutes.";
        if (destination.Contains('@'))
        {
            await _emailSender.SendAsync(destination, "ZynkEdu OTP", message, cancellationToken);
        }
        else
        {
            await _smsSender.SendAsync(destination, message, cancellationToken);
        }

        return new ParentOtpResponse(challenge.Id, destination, challenge.ExpiresAt);
    }

    public async Task<LoginResponse> VerifyParentOtpAsync(VerifyParentOtpRequest request, CancellationToken cancellationToken = default)
    {
        var challenge = await _dbContext.ParentOtpChallenges.FirstOrDefaultAsync(x => x.Id == request.ChallengeId, cancellationToken);
        if (challenge is null)
        {
            throw new UnauthorizedAccessException("OTP challenge was not found.");
        }

        if (challenge.UsedAt is not null)
        {
            throw new UnauthorizedAccessException("OTP challenge has already been used.");
        }

        if (challenge.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("OTP challenge has expired.");
        }

        if (challenge.Attempts >= _otpOptions.MaxAttempts)
        {
            throw new UnauthorizedAccessException("OTP challenge has been locked.");
        }

        if (!string.Equals(challenge.CodeHash, HashCode(challenge.Destination, request.Code.Trim()), StringComparison.Ordinal))
        {
            challenge.Attempts++;
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedAccessException("Invalid OTP code.");
        }

        challenge.UsedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        var guardian = await FindGuardianByParentDestinationAsync(challenge.Destination, cancellationToken);
        if (guardian is null)
        {
            var legacyStudent = await FindStudentByParentDestinationAsync(challenge.Destination, cancellationToken);
            if (legacyStudent is not null)
            {
                return new LoginResponse(
                    _jwtTokenService.CreateParentToken(legacyStudent.ParentPhone, legacyStudent.ParentEmail),
                    UserRole.Parent.ToString(),
                    legacyStudent.SchoolId,
                    null,
                    legacyStudent.FullName);
            }

            throw new UnauthorizedAccessException("Parent contact is not linked to a student.");
        }

        return new LoginResponse(
            _jwtTokenService.CreateParentToken(guardian.ParentPhone, guardian.ParentEmail),
            UserRole.Parent.ToString(),
            guardian.SchoolId,
            null,
            guardian.DisplayName);
    }

    private async Task<Guardian?> FindGuardianByParentDestinationAsync(string destination, CancellationToken cancellationToken)
    {
        return await _dbContext.Guardians.FirstOrDefaultAsync(
            x => x.ParentPhone == destination || x.ParentEmail == destination,
            cancellationToken);
    }

    private async Task<Student?> FindStudentByParentDestinationAsync(string destination, CancellationToken cancellationToken)
    {
        return await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(
            x => x.ParentPhone == destination || x.ParentEmail == destination,
            cancellationToken);
    }

    private static string NormalizeDestination(ParentOtpRequest request)
    {
        var phone = request.Phone?.Trim();
        var email = request.Email?.Trim().ToLowerInvariant();

        if (!string.IsNullOrWhiteSpace(phone))
        {
            return phone;
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            return email;
        }

        throw new InvalidOperationException("A phone or email address is required.");
    }

    private static string HashCode(string destination, string code)
    {
        var bytes = Encoding.UTF8.GetBytes($"{destination}:{code}");
        return Convert.ToHexString(SHA256.HashData(bytes));
    }
}
