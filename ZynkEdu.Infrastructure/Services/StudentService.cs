using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class StudentService : IStudentService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IStudentNumberGenerator _studentNumberGenerator;

    public StudentService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IStudentNumberGenerator studentNumberGenerator)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _studentNumberGenerator = studentNumberGenerator;
    }

    public async Task<StudentResponse> CreateAsync(CreateStudentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        ValidateLevelAndClass(request.Level, request.Class);
        var subjectIds = request.SubjectIds.Distinct().ToArray();
        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("At least one subject must be selected.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var parentEmail = request.ParentEmail.Trim().ToLowerInvariant();
            var parentPhone = request.ParentPhone.Trim();

            if (await _dbContext.Students.AnyAsync(x => x.ParentEmail == parentEmail, cancellationToken))
            {
                throw new InvalidOperationException("Parent email already exists.");
            }

            if (await _dbContext.Students.AnyAsync(x => x.ParentPhone == parentPhone, cancellationToken))
            {
                throw new InvalidOperationException("Parent phone already exists.");
            }

            if (await _dbContext.Guardians.AnyAsync(x => x.ParentEmail == parentEmail, cancellationToken))
            {
                throw new InvalidOperationException("Parent email already exists.");
            }

            if (await _dbContext.Guardians.AnyAsync(x => x.ParentPhone == parentPhone, cancellationToken))
            {
                throw new InvalidOperationException("Parent phone already exists.");
            }

            var subjects = await _dbContext.Subjects
                .Where(x => x.SchoolId == resolvedSchoolId && subjectIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

            if (subjects.Count != subjectIds.Length)
            {
                throw new InvalidOperationException("One or more subjects were not found in this school.");
            }

            var student = new Student
            {
                SchoolId = resolvedSchoolId,
                StudentNumber = await _studentNumberGenerator.GenerateAsync(resolvedSchoolId, cancellationToken),
                FullName = request.FullName.Trim(),
                Class = request.Class.Trim(),
                Level = NormalizeLevel(request.Level),
                EnrollmentYear = request.EnrollmentYear,
                ParentEmail = parentEmail,
                ParentPhone = parentPhone,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Students.Add(student);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var guardian = new Guardian
            {
                SchoolId = resolvedSchoolId,
                StudentId = student.Id,
                DisplayName = student.FullName,
                ParentEmail = parentEmail,
                ParentPhone = parentPhone,
                PasswordHash = student.ParentPasswordHash,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Guardians.Add(guardian);
            await _dbContext.SaveChangesAsync(cancellationToken);

            student.GuardianId = guardian.Id;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.StudentSubjectEnrollments.AddRange(subjects.Select(subject => new StudentSubjectEnrollment
            {
                SchoolId = resolvedSchoolId,
                StudentId = student.Id,
                SubjectId = subject.Id
            }));

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await MapAsync(student.Id, cancellationToken);
        });
    }

    public async Task<IReadOnlyList<StudentResponse>> GetAllAsync(string? classFilter = null, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.Students.AsNoTracking()
            : _dbContext.Students.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);
        if (!string.IsNullOrWhiteSpace(classFilter))
        {
            query = query.Where(x => x.Class == classFilter.Trim());
        }

        var students = await query
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return students.Select(Map).ToList();
    }

    public async Task<StudentResponse?> GetByIdAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.Students.AsNoTracking()
            : _dbContext.Students.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        var student = await query
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return student is null ? null : Map(student);
    }

    public async Task<StudentResponse> UpdateAsync(int id, UpdateStudentRequest request, CancellationToken cancellationToken = default)
    {
        ValidateLevelAndClass(request.Level, request.Class);
        var subjectIds = request.SubjectIds.Distinct().ToArray();
        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("At least one subject must be selected.");
        }

        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Students
            : _dbContext.Students.Where(x => x.SchoolId == RequireSchoolId());

        var student = await query
            .Include(x => x.SubjectEnrollments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var parentEmail = request.ParentEmail.Trim().ToLowerInvariant();
            var parentPhone = request.ParentPhone.Trim();

            if (await _dbContext.Students.AnyAsync(x => x.Id != id && x.ParentEmail == parentEmail, cancellationToken))
            {
                throw new InvalidOperationException("Parent email already exists.");
            }

            if (await _dbContext.Students.AnyAsync(x => x.Id != id && x.ParentPhone == parentPhone, cancellationToken))
            {
                throw new InvalidOperationException("Parent phone already exists.");
            }

            if (await _dbContext.Guardians.AnyAsync(x => x.StudentId != id && x.ParentEmail == parentEmail, cancellationToken))
            {
                throw new InvalidOperationException("Parent email already exists.");
            }

            if (await _dbContext.Guardians.AnyAsync(x => x.StudentId != id && x.ParentPhone == parentPhone, cancellationToken))
            {
                throw new InvalidOperationException("Parent phone already exists.");
            }

            var subjects = await _dbContext.Subjects
                .Where(x => x.SchoolId == student.SchoolId && subjectIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

            if (subjects.Count != subjectIds.Length)
            {
                throw new InvalidOperationException("One or more subjects were not found in this school.");
            }

            student.FullName = request.FullName.Trim();
            student.Class = request.Class.Trim();
            student.Level = NormalizeLevel(request.Level);
            student.EnrollmentYear = request.EnrollmentYear;
            student.ParentEmail = parentEmail;
            student.ParentPhone = parentPhone;

            var guardian = await _dbContext.Guardians.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
            if (guardian is null)
            {
                guardian = new Guardian
                {
                    SchoolId = student.SchoolId,
                    StudentId = student.Id,
                    DisplayName = student.FullName,
                    ParentEmail = parentEmail,
                    ParentPhone = parentPhone,
                    PasswordHash = student.ParentPasswordHash,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.Guardians.Add(guardian);
            }
            else
            {
                guardian.DisplayName = student.FullName;
                guardian.ParentEmail = parentEmail;
                guardian.ParentPhone = parentPhone;
                guardian.IsActive = true;
                guardian.SchoolId = student.SchoolId;
                guardian.PasswordHash = student.ParentPasswordHash;
            }

            _dbContext.StudentSubjectEnrollments.RemoveRange(student.SubjectEnrollments);
            await _dbContext.SaveChangesAsync(cancellationToken);

            student.GuardianId = guardian.Id;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.StudentSubjectEnrollments.AddRange(subjects.Select(subject => new StudentSubjectEnrollment
            {
                SchoolId = student.SchoolId,
                StudentId = student.Id,
                SubjectId = subject.Id
            }));

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await MapAsync(student.Id, cancellationToken);
        });
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Students
            : _dbContext.Students.Where(x => x.SchoolId == RequireSchoolId());

        var student = await query.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        var guardian = await _dbContext.Guardians.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (guardian is not null)
        {
            _dbContext.Guardians.Remove(guardian);
        }

        _dbContext.Students.Remove(student);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<StudentResponse> MapAsync(int id, CancellationToken cancellationToken)
    {
        var query = _dbContext.Students.AsNoTracking()
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject);

        var student = await query.FirstAsync(x => x.Id == id, cancellationToken);
        return Map(student);
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return schoolId;
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before creating a student.");
        }

        return RequireSchoolId();
    }

    private static void ValidateLevelAndClass(string level, string className)
    {
        var normalizedLevel = NormalizeLevel(level);
        var allowedClasses = normalizedLevel switch
        {
            "ZGC Level" => new[] { "Form 1A", "Form 1B", "Form 1C", "Form 2A", "Form 2B", "Form 2C" },
            "O'Level" => new[] { "Form 3A Sciences", "Form 3B Commercials", "Form 3C Arts", "Form 4A Sciences", "Form 4B Commercials", "Form 4C Arts" },
            "A'Level" => new[] { "Form 5 Arts", "Form 5 Commercials", "Form 5 Sciences", "Form 6 Arts", "Form 6 Commercials", "Form 6 Sciences" },
            _ => Array.Empty<string>()
        };

        if (!allowedClasses.Contains(className.Trim()))
        {
            throw new InvalidOperationException("The selected class does not match the selected level.");
        }
    }

    private static string NormalizeLevel(string level)
    {
        var value = level.Trim();
        if (value.Equals("ZGC", StringComparison.OrdinalIgnoreCase) || value.Equals("ZGC Level", StringComparison.OrdinalIgnoreCase))
        {
            return "ZGC Level";
        }

        if (value.Equals("OLevel", StringComparison.OrdinalIgnoreCase) || value.Equals("O'Level", StringComparison.OrdinalIgnoreCase) || value.Equals("O Level", StringComparison.OrdinalIgnoreCase))
        {
            return "O'Level";
        }

        if (value.Equals("ALevel", StringComparison.OrdinalIgnoreCase) || value.Equals("A'Level", StringComparison.OrdinalIgnoreCase) || value.Equals("A Level", StringComparison.OrdinalIgnoreCase))
        {
            return "A'Level";
        }

        throw new InvalidOperationException("The selected level is not supported.");
    }

    private static StudentResponse Map(Student student)
    {
        var subjectIds = student.SubjectEnrollments
            .Select(x => x.SubjectId)
            .Distinct()
            .OrderBy(x => x)
            .ToArray();

        var subjects = student.SubjectEnrollments
            .Select(x => x.Subject.Name)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct()
            .OrderBy(x => x)
            .ToArray();

        return new StudentResponse(
            student.Id,
            student.SchoolId,
            student.StudentNumber,
            student.FullName,
            student.Class,
            student.Level,
            student.EnrollmentYear,
            subjectIds,
            subjects,
            student.ParentEmail,
            student.ParentPhone,
            student.CreatedAt);
    }
}
