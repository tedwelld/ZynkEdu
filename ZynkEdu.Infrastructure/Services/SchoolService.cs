using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class SchoolService : ISchoolService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IPasswordHasher<AppUser> _passwordHasher;

    public SchoolService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IPasswordHasher<AppUser> passwordHasher)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<SchoolResponse> CreateAsync(SchoolCreateRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != Domain.Enums.UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can create schools.");
        }

        var school = new School
        {
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            AdminContactEmail = NormalizeEmail(request.AdminContactEmail),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Schools.Add(school);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SchoolResponse(school.Id, school.Name, school.Address, school.AdminContactEmail, school.CreatedAt);
    }

    public async Task<SchoolResponse> CreateWithAdminAsync(SchoolCreateWithAdminRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can create schools.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var school = new School
            {
                Name = request.Name.Trim(),
                Address = request.Address.Trim(),
                AdminContactEmail = NormalizeEmail(request.AdminContactEmail),
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Schools.Add(school);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var username = request.AdminUsername.Trim().ToLowerInvariant();
            if (await _dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
            {
                throw new InvalidOperationException("Admin username already exists.");
            }

            var admin = new AppUser
            {
                Username = username,
                Role = UserRole.Admin,
                SchoolId = school.Id,
                DisplayName = request.AdminDisplayName.Trim(),
                CreatedAt = DateTime.UtcNow,
                IsActive = request.AdminIsActive
            };
            admin.PasswordHash = _passwordHasher.HashPassword(admin, request.AdminPassword);

            _dbContext.Users.Add(admin);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.StaffAdmins.Add(new StaffAdmin
            {
                Id = admin.Id,
                SchoolId = school.Id,
                DisplayName = admin.DisplayName,
                IsActive = admin.IsActive,
                CreatedAt = admin.CreatedAt
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new SchoolResponse(school.Id, school.Name, school.Address, school.AdminContactEmail, school.CreatedAt);
        });
    }

    public async Task<IReadOnlyList<SchoolResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == Domain.Enums.UserRole.PlatformAdmin
            ? _dbContext.Schools.AsNoTracking()
            : _dbContext.Schools.AsNoTracking().Where(x => x.Id == _currentUserContext.SchoolId);

        return await query
            .OrderBy(x => x.Name)
            .Select(x => new SchoolResponse(x.Id, x.Name, x.Address, x.AdminContactEmail, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SchoolResponse> UpdateAsync(int id, UpdateSchoolRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != Domain.Enums.UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can edit schools.");
        }

        var school = await _dbContext.Schools.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("School was not found.");

        school.Name = request.Name.Trim();
        school.Address = request.Address.Trim();
        school.AdminContactEmail = NormalizeEmail(request.AdminContactEmail);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new SchoolResponse(school.Id, school.Name, school.Address, school.AdminContactEmail, school.CreatedAt);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != Domain.Enums.UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can delete schools.");
        }

        var school = await _dbContext.Schools.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("School was not found.");

        _dbContext.Schools.Remove(school);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string? NormalizeEmail(string email)
        => string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
}
