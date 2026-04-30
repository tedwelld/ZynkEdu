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

        var guardians = NormalizeGuardians(request.Guardians);
        if (guardians.Count == 0)
        {
            throw new InvalidOperationException("At least one guardian must be selected.");
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

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
                ProfileKey = Guid.NewGuid().ToString("N"),
                StudentNumber = await _studentNumberGenerator.GenerateAsync(resolvedSchoolId, cancellationToken),
                FullName = request.FullName.Trim(),
                Class = request.Class.Trim(),
                Level = NormalizeLevel(request.Level),
                Status = "Active",
                EnrollmentYear = request.EnrollmentYear,
                ParentEmail = guardians[0].Email,
                ParentPhone = guardians[0].Phone,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Students.Add(student);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await UpsertGuardiansAsync(student, guardians, cancellationToken);

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

    public async Task<IReadOnlyList<StudentResponse>> GetAllAsync(string? classFilter = null, int? schoolId = null, bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.Students.AsNoTracking()
            : _dbContext.Students.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        if (!includeInactive)
        {
            query = query.Where(x => x.Status == "Active" || x.Status == "Suspended");
        }

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
            .Include(x => x.Guardians)
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
            .Include(x => x.Guardians)
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

        var guardians = NormalizeGuardians(request.Guardians);
        if (guardians.Count == 0)
        {
            throw new InvalidOperationException("At least one guardian must be selected.");
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
            student.ParentEmail = guardians[0].Email;
            student.ParentPhone = guardians[0].Phone;

            _dbContext.StudentSubjectEnrollments.RemoveRange(student.SubjectEnrollments);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await UpsertGuardiansAsync(student, guardians, cancellationToken);

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

        var guardians = await _dbContext.Guardians.Where(x => x.StudentId == student.Id).ToListAsync(cancellationToken);
        if (guardians.Count > 0)
        {
            _dbContext.Guardians.RemoveRange(guardians);
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
                .ThenInclude(x => x.Subject)
            .Include(x => x.Guardians);

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

        var guardians = student.Guardians
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.DisplayName)
            .Select(x => new GuardianResponse(
                x.Id,
                x.StudentId,
                x.DisplayName,
                x.Relationship,
                x.ParentPhone,
                x.ParentEmail,
                x.Address,
                x.IdentityDocumentType,
                x.IdentityDocumentNumber,
                x.BirthCertificateNumber,
                x.IsPrimary,
                x.IsActive,
                x.CreatedAt))
            .ToArray();

        var primaryGuardian = student.Guardians.OrderByDescending(x => x.IsPrimary).ThenBy(x => x.Id).FirstOrDefault();

        return new StudentResponse(
            student.Id,
            student.SchoolId,
            student.ProfileKey,
            student.StudentNumber,
            student.FullName,
            student.Class,
            student.Level,
            student.Status,
            student.EnrollmentYear,
            subjectIds,
            subjects,
            guardians,
            primaryGuardian?.ParentEmail ?? student.ParentEmail,
            primaryGuardian?.ParentPhone ?? student.ParentPhone,
            student.CreatedAt);
    }

    private async Task UpsertGuardiansAsync(Student student, IReadOnlyList<GuardianRequest> guardians, CancellationToken cancellationToken)
    {
        var existingGuardians = await _dbContext.Guardians.Where(x => x.StudentId == student.Id).ToListAsync(cancellationToken);
        if (existingGuardians.Count > 0)
        {
            _dbContext.Guardians.RemoveRange(existingGuardians);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var normalized = guardians.Select((guardian, index) => new Guardian
        {
            SchoolId = student.SchoolId,
            StudentId = student.Id,
            DisplayName = guardian.DisplayName.Trim(),
            Relationship = guardian.Relationship.Trim(),
            ParentPhone = guardian.Phone.Trim(),
            ParentEmail = guardian.Email.Trim().ToLowerInvariant(),
            Address = guardian.Address?.Trim() ?? string.Empty,
            IdentityDocumentType = guardian.IdentityDocumentType?.Trim() ?? string.Empty,
            IdentityDocumentNumber = guardian.IdentityDocumentNumber?.Trim() ?? string.Empty,
            BirthCertificateNumber = guardian.BirthCertificateNumber?.Trim() ?? string.Empty,
            IsPrimary = index == 0 || guardian.IsPrimary,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        if (normalized.Count > 0 && !normalized.Any(x => x.IsPrimary))
        {
            normalized[0].IsPrimary = true;
        }

        _dbContext.Guardians.AddRange(normalized);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var primaryGuardian = normalized.FirstOrDefault(x => x.IsPrimary) ?? normalized[0];
        student.GuardianId = primaryGuardian.Id;
        student.ParentEmail = primaryGuardian.ParentEmail;
        student.ParentPhone = primaryGuardian.ParentPhone;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static IReadOnlyList<GuardianRequest> NormalizeGuardians(IReadOnlyList<GuardianRequest> guardians)
    {
        var normalized = guardians
            .Where(x => !string.IsNullOrWhiteSpace(x.DisplayName) && !string.IsNullOrWhiteSpace(x.Email) && !string.IsNullOrWhiteSpace(x.Phone))
            .Select(x => new GuardianRequest(
                x.DisplayName.Trim(),
                x.Relationship.Trim(),
                x.Phone.Trim(),
                x.Email.Trim().ToLowerInvariant(),
                x.Address?.Trim(),
                x.IdentityDocumentType?.Trim(),
                x.IdentityDocumentNumber?.Trim(),
                x.BirthCertificateNumber?.Trim(),
                x.IsPrimary))
            .ToList();

        if (normalized.Count > 0 && !normalized.Any(x => x.IsPrimary))
        {
            normalized[0] = normalized[0] with { IsPrimary = true };
        }

        return normalized;
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

        if (value.Equals("TransferredOut", StringComparison.OrdinalIgnoreCase))
        {
            return "TransferredOut";
        }

        if (value.Equals("Exited", StringComparison.OrdinalIgnoreCase))
        {
            return "Exited";
        }

        if (value.Equals("Graduated", StringComparison.OrdinalIgnoreCase))
        {
            return "Graduated";
        }

        if (value.Equals("Promoted", StringComparison.OrdinalIgnoreCase))
        {
            return "Promoted";
        }

        if (value.Equals("Reshuffled", StringComparison.OrdinalIgnoreCase))
        {
            return "Reshuffled";
        }

        throw new InvalidOperationException("The selected status is not supported.");
    }
}
