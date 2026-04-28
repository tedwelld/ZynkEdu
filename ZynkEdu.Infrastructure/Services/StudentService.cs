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
    private readonly IAuditLogService _auditLogService;

    public StudentService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IStudentNumberGenerator studentNumberGenerator,
        IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _studentNumberGenerator = studentNumberGenerator;
        _auditLogService = auditLogService;
    }

    public async Task<StudentResponse> CreateAsync(CreateStudentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        await ValidateLevelAndClassAsync(resolvedSchoolId, request.Level, request.Class, cancellationToken);
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
                Status = "Active",
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
            await _auditLogService.LogAsync(resolvedSchoolId, "Created", "Student", student.Id.ToString(), $"Created student {student.FullName} ({student.StudentNumber}).", cancellationToken);
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

        HashSet<string>? assignedClasses = null;
        if (_currentUserContext.Role == UserRole.Teacher)
        {
            assignedClasses = await ResolveTeacherAssignedClassesAsync(resolvedSchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required."), cancellationToken);
            if (assignedClasses.Count == 0)
            {
                return Array.Empty<StudentResponse>();
            }

            query = query.Where(x => assignedClasses.Contains(x.Class));
        }

        if (!string.IsNullOrWhiteSpace(classFilter))
        {
            var trimmedClass = classFilter.Trim();
            if (assignedClasses is not null && !assignedClasses.Contains(trimmedClass))
            {
                return Array.Empty<StudentResponse>();
            }

            query = query.Where(x => x.Class == trimmedClass);
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

        if (_currentUserContext.Role == UserRole.Teacher)
        {
            var assignedClasses = await ResolveTeacherAssignedClassesAsync(resolvedSchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required."), cancellationToken);
            if (assignedClasses.Count == 0)
            {
                return null;
            }

            query = query.Where(x => assignedClasses.Contains(x.Class));
        }

        var student = await query
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return student is null ? null : Map(student);
    }

    public async Task<StudentResponse> UpdateAsync(int id, UpdateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = RequireSchoolId();
        await ValidateLevelAndClassAsync(resolvedSchoolId, request.Level, request.Class, cancellationToken);
        var subjectIds = request.SubjectIds.Distinct().ToArray();
        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("At least one subject must be selected.");
        }

        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Students
            : _dbContext.Students.Where(x => x.SchoolId == resolvedSchoolId);

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
            await _auditLogService.LogAsync(student.SchoolId, "Updated", "Student", student.Id.ToString(), $"Updated student {student.FullName}.", cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await MapAsync(student.Id, cancellationToken);
        });
    }

    public async Task<StudentResponse> UpdateStatusAsync(int id, UpdateStudentStatusRequest request, CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Students
            : _dbContext.Students.Where(x => x.SchoolId == RequireSchoolId());

        var student = await query.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        student.Status = NormalizeStatus(request.Status);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(student.SchoolId, "Updated status", "Student", student.Id.ToString(), $"{student.FullName} is now {student.Status}.", cancellationToken);
        return await MapAsync(student.Id, cancellationToken);
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
        await _auditLogService.LogAsync(student.SchoolId, "Deleted", "Student", student.Id.ToString(), $"Deleted student {student.FullName}.", cancellationToken);
    }

    public async Task<BulkStudentSubjectEnrollmentResponse> EnrollAllSubjectsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var scopeSchoolIds = await ResolveSchoolScopeAsync(schoolId, cancellationToken);
        if (scopeSchoolIds.Count == 0)
        {
            return new BulkStudentSubjectEnrollmentResponse(0, 0, 0, 0);
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var schoolCount = 0;
            var studentCount = 0;
            var subjectCount = 0;
            var enrollmentCount = 0;

            foreach (var targetSchoolId in scopeSchoolIds)
            {
                var subjectIds = await _dbContext.Subjects.AsNoTracking()
                    .Where(x => x.SchoolId == targetSchoolId)
                    .OrderBy(x => x.Name)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);

                var studentIds = await _dbContext.Students.AsNoTracking()
                    .Where(x => x.SchoolId == targetSchoolId)
                    .OrderBy(x => x.Id)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);

                if (subjectIds.Count == 0 || studentIds.Count == 0)
                {
                    continue;
                }

                var existingEnrollments = await _dbContext.StudentSubjectEnrollments
                    .Where(x => x.SchoolId == targetSchoolId && studentIds.Contains(x.StudentId))
                    .ToListAsync(cancellationToken);

                if (existingEnrollments.Count > 0)
                {
                    _dbContext.StudentSubjectEnrollments.RemoveRange(existingEnrollments);
                    await _dbContext.SaveChangesAsync(cancellationToken);
                }

                var enrollments = new List<StudentSubjectEnrollment>(studentIds.Count * subjectIds.Count);
                foreach (var studentId in studentIds)
                {
                    foreach (var subjectId in subjectIds)
                    {
                        enrollments.Add(new StudentSubjectEnrollment
                        {
                            SchoolId = targetSchoolId,
                            StudentId = studentId,
                            SubjectId = subjectId
                        });
                    }
                }

                _dbContext.StudentSubjectEnrollments.AddRange(enrollments);
                await _dbContext.SaveChangesAsync(cancellationToken);

                schoolCount++;
                studentCount += studentIds.Count;
                subjectCount += subjectIds.Count;
                enrollmentCount += enrollments.Count;
            }

            await _auditLogService.LogAsync(
                scopeSchoolIds.Count == 1 ? scopeSchoolIds[0] : null,
                "Bulk enrolled subjects",
                "StudentSubjectEnrollment",
                scopeSchoolIds.Count == 1 ? scopeSchoolIds[0].ToString() : "all-schools",
                $"Enrolled {studentCount} student(s) in {subjectCount} subject(s) across {schoolCount} school(s).",
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return new BulkStudentSubjectEnrollmentResponse(schoolCount, studentCount, subjectCount, enrollmentCount);
        });
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

    private async Task<IReadOnlyList<int>> ResolveSchoolScopeAsync(int? schoolId, CancellationToken cancellationToken)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            if (schoolId.HasValue)
            {
                return [schoolId.Value];
            }

            return await _dbContext.Schools.AsNoTracking()
                .OrderBy(x => x.Id)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        return [RequireSchoolId()];
    }

    private async Task<HashSet<string>> ResolveTeacherAssignedClassesAsync(int schoolId, CancellationToken cancellationToken)
    {
        if (_currentUserContext.Role != UserRole.Teacher)
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        if (_currentUserContext.UserId is not int teacherId)
        {
            throw new UnauthorizedAccessException("Teacher identity is missing.");
        }

        var classes = await _dbContext.TeacherAssignments.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.TeacherId == teacherId)
            .Select(x => x.Class)
            .Distinct()
            .ToListAsync(cancellationToken);

        return new HashSet<string>(classes, StringComparer.OrdinalIgnoreCase);
    }

    private async Task ValidateLevelAndClassAsync(int schoolId, string level, string className, CancellationToken cancellationToken)
    {
        var normalizedLevel = NormalizeLevel(level);
        var trimmedClass = className.Trim();

        var schoolClass = await _dbContext.SchoolClasses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Name == trimmedClass, cancellationToken);

        if (schoolClass is null)
        {
            throw new InvalidOperationException("Create the class before adding students.");
        }

        if (!schoolClass.IsActive)
        {
            throw new InvalidOperationException("The selected class is not active.");
        }

        if (!string.Equals(SchoolLevelCatalog.NormalizeLevel(schoolClass.GradeLevel), normalizedLevel, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The selected class does not match the selected level.");
        }
    }

    private static string NormalizeLevel(string level)
    {
        var normalized = SchoolLevelCatalog.NormalizeLevel(level);
        if (!SchoolLevelCatalog.IsKnownLevel(normalized) || normalized == SchoolLevelCatalog.General)
        {
            throw new InvalidOperationException("The selected level is not supported.");
        }

        return normalized;
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
            student.Status,
            student.EnrollmentYear,
            subjectIds,
            subjects,
            student.ParentEmail,
            student.ParentPhone,
            student.CreatedAt);
    }

    private static string NormalizeStatus(string status)
    {
        var value = status.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return "Active";
        }

        if (value.Equals("Active", StringComparison.OrdinalIgnoreCase))
        {
            return "Active";
        }

        if (value.Equals("Suspended", StringComparison.OrdinalIgnoreCase))
        {
            return "Suspended";
        }

        if (value.Equals("Archived", StringComparison.OrdinalIgnoreCase))
        {
            return "Archived";
        }

        throw new InvalidOperationException("The selected status is not supported.");
    }
}
