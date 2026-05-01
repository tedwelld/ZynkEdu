using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class UserManagementService : IUserManagementService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly ITeacherAssignmentService _teacherAssignmentService;

    public UserManagementService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IPasswordHasher<AppUser> passwordHasher,
        ITeacherAssignmentService teacherAssignmentService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _passwordHasher = passwordHasher;
        _teacherAssignmentService = teacherAssignmentService;
    }

    public Task<UserResponse> CreateTeacherAsync(CreateSchoolUserRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
        => CreateUserAsync(UserRole.Teacher, ResolveSchoolId(schoolId), request, cancellationToken);

    public async Task<UserResponse> CreateTeacherWithAssignmentAsync(CreateTeacherWithAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var strategy = _dbContext.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var username = request.Username.Trim().ToLowerInvariant();
            if (await _dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
            {
                throw new InvalidOperationException("Username already exists.");
            }

            var user = new AppUser
            {
                Username = username,
                Role = UserRole.Teacher,
                SchoolId = resolvedSchoolId,
                DisplayName = request.DisplayName.Trim(),
                ContactEmail = request.ContactEmail?.Trim().ToLowerInvariant(),
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.TeacherUsers.Add(new TeacherUser
            {
                Id = user.Id,
                SchoolId = resolvedSchoolId,
                DisplayName = user.DisplayName,
                IsActive = true,
                CreatedAt = user.CreatedAt
            });
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _teacherAssignmentService.CreateBatchAsync(
                new CreateTeacherAssignmentsBatchRequest(user.Id, request.SubjectIds, request.Classes),
                resolvedSchoolId,
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new UserResponse(user.Id, user.Username, user.DisplayName, user.Role.ToString(), user.SchoolId, user.CreatedAt, user.IsActive, user.ContactEmail);
        });
    }

    public async Task<UserResponse> CreateAdminAsync(int schoolId, CreateSchoolUserRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can create school admins.");
        }

        return await CreateUserAsync(UserRole.Admin, schoolId, request, cancellationToken);
    }

    public async Task<UserResponse> CreateLibraryAdminAsync(int schoolId, CreateSchoolUserRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can create library admins.");
        }

        return await CreateUserAsync(UserRole.LibraryAdmin, schoolId, request, cancellationToken);
    }

    public async Task<UserResponse> CreateAccountantAsync(CreateAccountantRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can create accountants.");
        }

        var resolvedSchoolId = ResolveAccountingSchoolId(schoolId, allowPlatformDefault: false);
        var role = request.Role switch
        {
            UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior => request.Role,
            _ => throw new InvalidOperationException("Choose a valid accountant role.")
        };

        return await CreateUserAsync(role, resolvedSchoolId, new CreateSchoolUserRequest(
            request.Username,
            string.IsNullOrWhiteSpace(request.DisplayName) ? request.Username.Trim() : request.DisplayName,
            request.Password,
            request.ContactEmail), cancellationToken);
    }

    public async Task<IReadOnlyList<UserResponse>> GetAccountantsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can view accountants.");
        }

        var query = _dbContext.AccountantUsers.AsNoTracking().Include(x => x.Account).AsQueryable();
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            if (schoolId is not null)
            {
                query = query.Where(x => x.SchoolId == schoolId);
            }
        }
        else
        {
            query = query.Where(x => x.SchoolId == RequireSchoolId());
        }

        return await query
            .OrderBy(x => x.DisplayName)
            .Select(x => new UserResponse(x.Id, x.Account.Username, x.DisplayName, x.Account.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.Account.ContactEmail))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserResponse>> GetTeachersAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        return await GetUsersByRoleAsync(UserRole.Teacher, schoolId, cancellationToken);
    }

    public async Task<IReadOnlyList<UserResponse>> GetAdminsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can view school admins.");
        }

        return await GetUsersByRoleAsync(UserRole.Admin, schoolId, cancellationToken);
    }

    public async Task<IReadOnlyList<UserResponse>> GetLibraryAdminsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin or UserRole.LibraryAdmin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can view library admins.");
        }

        return await GetUsersByRoleAsync(UserRole.LibraryAdmin, schoolId, cancellationToken);
    }

    public async Task<UserResponse> UpdateTeacherAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(id, UserRole.Teacher, cancellationToken);
        return await UpdateUserAsync(user, request, cancellationToken);
    }

    public async Task DeleteTeacherAsync(int id, CancellationToken cancellationToken = default)
    {
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var user = await RequireUserAsync(id, UserRole.Teacher, cancellationToken);

            var attendanceRegisters = await _dbContext.AttendanceRegisters
                .Where(x => x.TeacherId == user.Id)
                .ToListAsync(cancellationToken);
            if (attendanceRegisters.Count > 0)
            {
                _dbContext.AttendanceRegisters.RemoveRange(attendanceRegisters);
            }

            var results = await _dbContext.Results
                .Where(x => x.TeacherId == user.Id)
                .ToListAsync(cancellationToken);
            if (results.Count > 0)
            {
                _dbContext.Results.RemoveRange(results);
            }

            var timetableSlots = await _dbContext.TimetableSlots
                .Where(x => x.TeacherId == user.Id)
                .ToListAsync(cancellationToken);
            if (timetableSlots.Count > 0)
            {
                _dbContext.TimetableSlots.RemoveRange(timetableSlots);
            }

            var assignments = await _dbContext.TeacherAssignments
                .Where(x => x.TeacherId == user.Id)
                .ToListAsync(cancellationToken);
            if (assignments.Count > 0)
            {
                _dbContext.TeacherAssignments.RemoveRange(assignments);
            }

            var dispatchLogs = await _dbContext.TimetableDispatchLogs
                .Where(x => x.TeacherId == user.Id)
                .ToListAsync(cancellationToken);
            if (dispatchLogs.Count > 0)
            {
                _dbContext.TimetableDispatchLogs.RemoveRange(dispatchLogs);
            }

            var profile = await _dbContext.TeacherUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is not null)
            {
                _dbContext.TeacherUsers.Remove(profile);
            }

            _dbContext.Users.Remove(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });
    }

    public async Task<UserResponse> UpdateAdminAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can edit school admins.");
        }

        var user = await RequireUserAsync(id, UserRole.Admin, cancellationToken);
        return await UpdateUserAsync(user, request, cancellationToken);
    }

    public async Task DeleteAdminAsync(int id, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            throw new UnauthorizedAccessException("Only the platform admin can delete school admins.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var user = await RequireUserAsync(id, UserRole.Admin, cancellationToken);
            var profile = await _dbContext.StaffAdmins.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is not null)
            {
                _dbContext.StaffAdmins.Remove(profile);
            }

            _dbContext.Users.Remove(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });
    }

    public async Task<UserResponse> UpdateLibraryAdminAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin or UserRole.LibraryAdmin))
        {
            throw new UnauthorizedAccessException("Only school, library, and platform admins can edit library admins.");
        }

        if (_currentUserContext.Role == UserRole.LibraryAdmin && _currentUserContext.UserId != id)
        {
            throw new UnauthorizedAccessException("Library admins can only edit their own profile.");
        }

        var user = await RequireUserAsync(id, UserRole.LibraryAdmin, cancellationToken);
        return await UpdateUserAsync(user, request, cancellationToken);
    }

    public async Task DeleteLibraryAdminAsync(int id, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.PlatformAdmin or UserRole.Admin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can delete library admins.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var user = await RequireUserAsync(id, UserRole.LibraryAdmin, cancellationToken);
            var profile = await _dbContext.LibraryAdminUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is not null)
            {
                _dbContext.LibraryAdminUsers.Remove(profile);
            }

            _dbContext.Users.Remove(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });
    }

    private async Task<UserResponse> CreateUserAsync(UserRole role, int schoolId, CreateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        if (await _dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
        {
            throw new InvalidOperationException("Username already exists.");
        }

        var user = new AppUser
        {
            Username = username,
            Role = role,
            SchoolId = schoolId,
            DisplayName = request.DisplayName.Trim(),
            ContactEmail = request.ContactEmail?.Trim().ToLowerInvariant(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (role == UserRole.Admin)
        {
            _dbContext.StaffAdmins.Add(new StaffAdmin
            {
                Id = user.Id,
                SchoolId = schoolId,
                DisplayName = user.DisplayName,
                IsActive = true,
                CreatedAt = user.CreatedAt
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (role == UserRole.Teacher)
        {
            _dbContext.TeacherUsers.Add(new TeacherUser
            {
                Id = user.Id,
                SchoolId = schoolId,
                DisplayName = user.DisplayName,
                IsActive = true,
                CreatedAt = user.CreatedAt
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (role == UserRole.LibraryAdmin)
        {
            _dbContext.LibraryAdminUsers.Add(new LibraryAdminUser
            {
                Id = user.Id,
                SchoolId = schoolId,
                DisplayName = user.DisplayName,
                IsActive = true,
                CreatedAt = user.CreatedAt
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (role is UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior)
        {
            _dbContext.AccountantUsers.Add(new AccountantUser
            {
                Id = user.Id,
                SchoolId = schoolId,
                DisplayName = user.DisplayName,
                IsActive = true,
                CreatedAt = user.CreatedAt
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return new UserResponse(user.Id, user.Username, user.DisplayName, user.Role.ToString(), user.SchoolId, user.CreatedAt, user.IsActive, user.ContactEmail);
    }

    private async Task<UserResponse> UpdateUserAsync(AppUser user, UpdateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        user.DisplayName = request.DisplayName.Trim();
        user.IsActive = request.IsActive;
        user.ContactEmail = request.ContactEmail?.Trim().ToLowerInvariant();

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        if (user.Role == UserRole.Admin)
        {
            var profile = await _dbContext.StaffAdmins.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.StaffAdmins.Add(new StaffAdmin
                {
                    Id = user.Id,
                    SchoolId = user.SchoolId,
                    DisplayName = user.DisplayName,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.DisplayName = user.DisplayName;
                profile.IsActive = user.IsActive;
                profile.SchoolId = user.SchoolId;
            }
        }
        else if (user.Role == UserRole.Teacher)
        {
            var profile = await _dbContext.TeacherUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.TeacherUsers.Add(new TeacherUser
                {
                    Id = user.Id,
                    SchoolId = user.SchoolId,
                    DisplayName = user.DisplayName,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.DisplayName = user.DisplayName;
                profile.IsActive = user.IsActive;
                profile.SchoolId = user.SchoolId;
            }
        }
        else if (user.Role == UserRole.LibraryAdmin)
        {
            var profile = await _dbContext.LibraryAdminUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.LibraryAdminUsers.Add(new LibraryAdminUser
                {
                    Id = user.Id,
                    SchoolId = user.SchoolId,
                    DisplayName = user.DisplayName,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.DisplayName = user.DisplayName;
                profile.IsActive = user.IsActive;
                profile.SchoolId = user.SchoolId;
            }
        }
        else if (user.Role is UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior)
        {
            var profile = await _dbContext.AccountantUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.AccountantUsers.Add(new AccountantUser
                {
                    Id = user.Id,
                    SchoolId = user.SchoolId,
                    DisplayName = user.DisplayName,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.DisplayName = user.DisplayName;
                profile.IsActive = user.IsActive;
                profile.SchoolId = user.SchoolId;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new UserResponse(user.Id, user.Username, user.DisplayName, user.Role.ToString(), user.SchoolId, user.CreatedAt, user.IsActive, user.ContactEmail);
    }

    private async Task<IReadOnlyList<UserResponse>> GetUsersByRoleAsync(UserRole role, int? schoolId, CancellationToken cancellationToken)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        if (role == UserRole.Admin)
        {
            var staffAdminQuery = _dbContext.StaffAdmins.AsNoTracking().Include(x => x.Account).AsQueryable();
            if (_currentUserContext.Role != UserRole.PlatformAdmin || resolvedSchoolId is not null)
            {
                staffAdminQuery = staffAdminQuery.Where(x => x.SchoolId == resolvedSchoolId);
            }

            return await staffAdminQuery
                .OrderBy(x => x.DisplayName)
                .Select(x => new UserResponse(x.Id, x.Account.Username, x.DisplayName, x.Account.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.Account.ContactEmail))
                .ToListAsync(cancellationToken);
        }

        if (role == UserRole.Teacher)
        {
            var teacherUserQuery = _dbContext.TeacherUsers.AsNoTracking().Include(x => x.Account).AsQueryable();
            if (_currentUserContext.Role != UserRole.PlatformAdmin || resolvedSchoolId is not null)
            {
                teacherUserQuery = teacherUserQuery.Where(x => x.SchoolId == resolvedSchoolId);
            }

            return await teacherUserQuery
                .OrderBy(x => x.DisplayName)
                .Select(x => new UserResponse(x.Id, x.Account.Username, x.DisplayName, x.Account.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.Account.ContactEmail))
                .ToListAsync(cancellationToken);
        }

        if (role == UserRole.LibraryAdmin)
        {
            var libraryAdminQuery = _dbContext.LibraryAdminUsers.AsNoTracking().Include(x => x.Account).AsQueryable();
            if (_currentUserContext.Role != UserRole.PlatformAdmin || resolvedSchoolId is not null)
            {
                libraryAdminQuery = libraryAdminQuery.Where(x => x.SchoolId == resolvedSchoolId);
            }

            return await libraryAdminQuery
                .OrderBy(x => x.DisplayName)
                .Select(x => new UserResponse(x.Id, x.Account.Username, x.DisplayName, x.Account.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.Account.ContactEmail))
                .ToListAsync(cancellationToken);
        }

        if (role is UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior)
        {
            var accountantQuery = _dbContext.AccountantUsers.AsNoTracking().Include(x => x.Account).AsQueryable();
            if (_currentUserContext.Role != UserRole.PlatformAdmin || resolvedSchoolId is not null)
            {
                accountantQuery = accountantQuery.Where(x => x.SchoolId == resolvedSchoolId);
            }

            return await accountantQuery
                .Where(x => x.Account.Role == role)
                .OrderBy(x => x.DisplayName)
                .Select(x => new UserResponse(x.Id, x.Account.Username, x.DisplayName, x.Account.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.Account.ContactEmail))
                .ToListAsync(cancellationToken);
        }

        var userQuery = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.Users.AsNoTracking()
            : _dbContext.Users.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await userQuery
            .Where(x => x.Role == role)
            .OrderBy(x => x.DisplayName)
            .Select(x => new UserResponse(x.Id, x.Username, x.DisplayName, x.Role.ToString(), x.SchoolId, x.CreatedAt, x.IsActive, x.ContactEmail))
            .ToListAsync(cancellationToken);
    }

    private async Task<AppUser> RequireUserAsync(int id, UserRole expectedRole, CancellationToken cancellationToken)
    {
        if (expectedRole == UserRole.Admin)
        {
            var profileQuery = _currentUserContext.Role == UserRole.PlatformAdmin
                ? _dbContext.StaffAdmins.Include(x => x.Account)
                : _dbContext.StaffAdmins.Include(x => x.Account).Where(x => x.SchoolId == RequireSchoolId());

            var profile = await profileQuery.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (profile is not null)
            {
                return profile.Account;
            }
        }

        if (expectedRole == UserRole.Teacher)
        {
            var profileQuery = _currentUserContext.Role == UserRole.PlatformAdmin
                ? _dbContext.TeacherUsers.Include(x => x.Account)
                : _dbContext.TeacherUsers.Include(x => x.Account).Where(x => x.SchoolId == RequireSchoolId());

            var profile = await profileQuery.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (profile is not null)
            {
                return profile.Account;
            }
        }

        if (expectedRole == UserRole.LibraryAdmin)
        {
            var profileQuery = _currentUserContext.Role == UserRole.PlatformAdmin
                ? _dbContext.LibraryAdminUsers.Include(x => x.Account)
                : _dbContext.LibraryAdminUsers.Include(x => x.Account).Where(x => x.SchoolId == RequireSchoolId());

            var profile = await profileQuery.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (profile is not null)
            {
                return profile.Account;
            }
        }

        if (expectedRole is UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior)
        {
            var profileQuery = _currentUserContext.Role == UserRole.PlatformAdmin
                ? _dbContext.AccountantUsers.Include(x => x.Account)
                : _dbContext.AccountantUsers.Include(x => x.Account).Where(x => x.SchoolId == RequireSchoolId());

            var profile = await profileQuery.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (profile is not null)
            {
                return profile.Account;
            }
        }

        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Users
            : _dbContext.Users.Where(x => x.SchoolId == RequireSchoolId());

        return await query.FirstOrDefaultAsync(x => x.Id == id && x.Role == expectedRole, cancellationToken)
            ?? throw new InvalidOperationException("User was not found.");
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? _currentUserContext.SchoolId ?? throw new InvalidOperationException("Choose a school before creating staff.");
        }

        return RequireSchoolId();
    }

    private int ResolveAccountingSchoolId(int? schoolId, bool allowPlatformDefault = true)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            if (schoolId is not null)
            {
                return schoolId.Value;
            }

            if (allowPlatformDefault && _currentUserContext.SchoolId is int platformSchoolId)
            {
                return platformSchoolId;
            }

            throw new InvalidOperationException("Choose a school before creating accountants.");
        }

        return RequireSchoolId();
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher or UserRole.PlatformAdmin or UserRole.LibraryAdmin or UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return schoolId;
    }
}
