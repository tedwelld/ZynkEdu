using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AttendanceService : IAttendanceService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public AttendanceService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<AttendanceClassOptionResponse>> GetClassOptionsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var assignmentsQuery = _dbContext.TeacherAssignments.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Where(x => x.SchoolId == resolvedSchoolId);

        if (_currentUserContext.Role == UserRole.Teacher)
        {
            var assignedTeacherId = RequireTeacherId();
            assignmentsQuery = assignmentsQuery.Where(x => x.TeacherId == assignedTeacherId);
        }

        var assignments = await assignmentsQuery.ToListAsync(cancellationToken);
        var studentCounts = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .GroupBy(x => x.Class)
            .Select(group => new { ClassName = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.ClassName, x => x.Count, cancellationToken);

        var classes = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .Select(x => x.Class)
            .Distinct()
            .ToListAsync(cancellationToken);

        var classNames = classes
            .Union(assignments.Select(x => x.Class), StringComparer.OrdinalIgnoreCase)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .ToList();

        return classNames.Select(className =>
        {
            var classAssignments = assignments
                .Where(assignment => string.Equals(assignment.Class, className, StringComparison.OrdinalIgnoreCase))
                .ToList();

            return new AttendanceClassOptionResponse(
                className,
                classAssignments.Select(x => x.Teacher.DisplayName).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().OrderBy(x => x).ToList(),
                classAssignments.Select(x => x.Subject.Name).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().OrderBy(x => x).ToList(),
                SchoolLevelCatalog.TryGetClassLevel(className, out var level) ? level : string.Empty,
                studentCounts.TryGetValue(className, out var count) ? count : 0);
        }).ToList();
    }

    public async Task<AttendanceRegisterResponse?> GetRegisterAsync(string className, DateTime attendanceDate, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var normalizedClass = className.Trim();
        await EnsureDefaultTermsAsync(resolvedSchoolId, cancellationToken);

        if (_currentUserContext.Role == UserRole.Teacher)
        {
            var assignedTeacherId = RequireTeacherId();
            var isAuthorized = await _dbContext.TeacherAssignments.AnyAsync(x =>
                x.SchoolId == resolvedSchoolId &&
                x.TeacherId == assignedTeacherId &&
                x.Class == normalizedClass, cancellationToken);

            if (!isAuthorized)
            {
                throw new UnauthorizedAccessException("Teacher is not assigned to this class.");
            }
        }

        var school = await _dbContext.Schools.AsNoTracking()
            .FirstAsync(x => x.Id == resolvedSchoolId, cancellationToken);

        var roster = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && x.Class == normalizedClass)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        var register = await _dbContext.AttendanceRegisters.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.AcademicTerm)
            .Include(x => x.Entries)
                .ThenInclude(x => x.Student)
            .FirstOrDefaultAsync(x =>
                x.SchoolId == resolvedSchoolId &&
                x.Class == normalizedClass &&
                x.AttendanceDate == attendanceDate.Date, cancellationToken);

        var term = register?.AcademicTerm ?? await ResolveTermAsync(resolvedSchoolId, attendanceDate.Date, cancellationToken);
        var teacherUserId = register?.TeacherId ?? _currentUserContext.UserId ?? 0;
        var teacherName = register?.Teacher.DisplayName
            ?? (teacherUserId > 0
                ? await _dbContext.Users.AsNoTracking().Where(x => x.Id == teacherUserId).Select(x => x.DisplayName).FirstOrDefaultAsync(cancellationToken) ?? string.Empty
                : string.Empty);

        var entryMap = register?.Entries.ToDictionary(x => x.StudentId) ?? new Dictionary<int, AttendanceRegisterEntry>();
        var students = roster.Select(student =>
        {
            entryMap.TryGetValue(student.Id, out var entry);
            var status = entry?.Status.ToString() ?? AttendanceStatus.Present.ToString();
            return new AttendanceStudentRegisterResponse(
                student.Id,
                student.StudentNumber,
                student.FullName,
                student.Level,
                status,
                entry?.Note);
        }).ToList();

        var (present, absent, late, excused) = CountStatuses(students);

        return new AttendanceRegisterResponse(
            register?.Id,
            resolvedSchoolId,
            school.Name,
            teacherUserId,
            teacherName,
            normalizedClass,
            attendanceDate.Date,
            term.Name,
            register?.DispatchedAt is not null,
            register?.DispatchedAt,
            present,
            absent,
            late,
            excused,
            students);
    }

    public async Task<IReadOnlyList<AttendanceDailySummaryResponse>> GetDailySummariesAsync(DateTime attendanceDate, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin && schoolId is null)
        {
            await EnsureDefaultTermsForAllSchoolsAsync(cancellationToken);

            var schoolNames = await _dbContext.Schools.AsNoTracking()
                .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

            var registers = await _dbContext.AttendanceRegisters.AsNoTracking()
                .Include(x => x.Teacher)
                .Include(x => x.AcademicTerm)
                .Include(x => x.Entries)
                .Where(x => x.AttendanceDate == attendanceDate.Date)
                .OrderBy(x => x.SchoolId)
                .ThenBy(x => x.Class)
                .ToListAsync(cancellationToken);

            return registers.Select(register => BuildDailySummary(register, schoolNames.TryGetValue(register.SchoolId, out var schoolName) ? schoolName : $"School {register.SchoolId}")).ToList();
        }

        var resolvedSchoolId = ResolveSchoolId(schoolId);
        await EnsureDefaultTermsAsync(resolvedSchoolId, cancellationToken);

        var school = await _dbContext.Schools.AsNoTracking()
            .FirstAsync(x => x.Id == resolvedSchoolId, cancellationToken);

        var schoolRegisters = await _dbContext.AttendanceRegisters.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.AcademicTerm)
            .Include(x => x.Entries)
            .Where(x => x.SchoolId == resolvedSchoolId && x.AttendanceDate == attendanceDate.Date)
            .OrderBy(x => x.Class)
            .ToListAsync(cancellationToken);

        return schoolRegisters.Select(register => BuildDailySummary(register, school.Name)).ToList();
    }

    public async Task<AttendanceRegisterResponse> SaveAsync(SaveAttendanceRegisterRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.Teacher)
        {
            throw new UnauthorizedAccessException("Only teachers can mark attendance.");
        }

        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var currentTeacherId = RequireTeacherId();
        var attendanceDate = request.AttendanceDate.Date;
        var className = request.ClassName.Trim();
        var entryRequests = request.Students?.ToList() ?? [];

        if (string.IsNullOrWhiteSpace(className))
        {
            throw new InvalidOperationException("A class is required.");
        }

        if (entryRequests.Count == 0)
        {
            throw new InvalidOperationException("At least one student must be included in the register.");
        }

        var isAuthorized = await _dbContext.TeacherAssignments.AnyAsync(x =>
            x.SchoolId == resolvedSchoolId &&
            x.TeacherId == currentTeacherId &&
            x.Class == className, cancellationToken);

        if (!isAuthorized)
        {
            throw new UnauthorizedAccessException("Teacher is not assigned to this class.");
        }

        var roster = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && x.Class == className)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        if (roster.Count == 0)
        {
            throw new InvalidOperationException("The selected class has no students.");
        }

        var requestMap = entryRequests
            .GroupBy(x => x.StudentId)
            .ToDictionary(group => group.Key, group => group.Last());

        if (requestMap.Keys.Any(studentId => roster.All(student => student.Id != studentId)))
        {
            throw new InvalidOperationException("One or more students do not belong to the selected class.");
        }

        var term = await ResolveTermAsync(resolvedSchoolId, attendanceDate, cancellationToken);
        var strategy = _dbContext.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var register = await _dbContext.AttendanceRegisters
                .Include(x => x.Entries)
                .FirstOrDefaultAsync(x =>
                    x.SchoolId == resolvedSchoolId &&
                    x.Class == className &&
                    x.AttendanceDate == attendanceDate, cancellationToken);

            if (register is not null && register.DispatchedAt is not null)
            {
                throw new InvalidOperationException("This attendance register has already been dispatched and cannot be edited.");
            }

            if (register is null)
            {
                register = new AttendanceRegister
                {
                    SchoolId = resolvedSchoolId,
                    TeacherId = currentTeacherId,
                    AcademicTermId = term.Id,
                    Class = className,
                    AttendanceDate = attendanceDate,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _dbContext.AttendanceRegisters.Add(register);
            }
            else
            {
                register.TeacherId = currentTeacherId;
                register.AcademicTermId = term.Id;
                register.UpdatedAt = DateTime.UtcNow;
            }

            if (register.Entries.Count > 0)
            {
                _dbContext.AttendanceRegisterEntries.RemoveRange(register.Entries);
                register.Entries.Clear();
            }

            foreach (var student in roster)
            {
                var requestEntry = requestMap.TryGetValue(student.Id, out var matchingEntry)
                    ? matchingEntry
                    : new SaveAttendanceRegisterEntryRequest(student.Id, AttendanceStatus.Present.ToString(), null);

                register.Entries.Add(new AttendanceRegisterEntry
                {
                    SchoolId = resolvedSchoolId,
                    StudentId = student.Id,
                    Status = ParseStatus(requestEntry.Status),
                    Note = string.IsNullOrWhiteSpace(requestEntry.Note) ? null : requestEntry.Note.Trim(),
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await LoadRegisterAsync(register.Id, cancellationToken);
        });
    }

    private async Task<AttendanceRegisterResponse> LoadRegisterAsync(int registerId, CancellationToken cancellationToken)
    {
        var register = await _dbContext.AttendanceRegisters.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.AcademicTerm)
            .Include(x => x.Entries)
                .ThenInclude(x => x.Student)
            .FirstAsync(x => x.Id == registerId, cancellationToken);

        var school = await _dbContext.Schools.AsNoTracking()
            .FirstAsync(x => x.Id == register.SchoolId, cancellationToken);

        var roster = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == register.SchoolId && x.Class == register.Class)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        var entryMap = register.Entries.ToDictionary(x => x.StudentId);
        var students = roster.Select(student =>
        {
            entryMap.TryGetValue(student.Id, out var entry);
            return new AttendanceStudentRegisterResponse(
                student.Id,
                student.StudentNumber,
                student.FullName,
                student.Level,
                (entry?.Status ?? AttendanceStatus.Present).ToString(),
                entry?.Note);
        }).ToList();

        var (present, absent, late, excused) = CountStatuses(students);
        return new AttendanceRegisterResponse(
            register.Id,
            register.SchoolId,
            school.Name,
            register.TeacherId,
            register.Teacher.DisplayName,
            register.Class,
            register.AttendanceDate.Date,
            register.AcademicTerm.Name,
            register.DispatchedAt is not null,
            register.DispatchedAt,
            present,
            absent,
            late,
            excused,
            students);
    }

    private async Task<AcademicTerm> ResolveTermAsync(int schoolId, DateTime attendanceDate, CancellationToken cancellationToken)
    {
        await EnsureDefaultTermsAsync(schoolId, cancellationToken);

        var terms = await _dbContext.AcademicTerms.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .OrderBy(x => x.TermNumber)
            .ToListAsync(cancellationToken);

        var activeTerm = terms.FirstOrDefault(term =>
            term.StartDate.HasValue &&
            term.EndDate.HasValue &&
            term.StartDate.Value <= DateOnly.FromDateTime(attendanceDate) &&
            term.EndDate.Value >= DateOnly.FromDateTime(attendanceDate));

        return activeTerm ?? terms.First();
    }

    private async Task EnsureDefaultTermsAsync(int schoolId, CancellationToken cancellationToken)
    {
        var existingNumbers = await _dbContext.AcademicTerms.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .Select(x => x.TermNumber)
            .ToListAsync(cancellationToken);

        var missingTerms = Enumerable.Range(1, 3)
            .Where(termNumber => !existingNumbers.Contains(termNumber))
            .Select(termNumber => new AcademicTerm
            {
                SchoolId = schoolId,
                TermNumber = termNumber,
                Name = $"Term {termNumber}",
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (missingTerms.Count > 0)
        {
            _dbContext.AcademicTerms.AddRange(missingTerms);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task EnsureDefaultTermsForAllSchoolsAsync(CancellationToken cancellationToken)
    {
        var schoolIds = await _dbContext.Schools.AsNoTracking()
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var schoolId in schoolIds)
        {
            await EnsureDefaultTermsAsync(schoolId, cancellationToken);
        }
    }

    private static AttendanceDailySummaryResponse BuildDailySummary(AttendanceRegister register, string schoolName)
    {
        var (present, absent, late, excused) = CountStatuses(register.Entries.Select(entry => new AttendanceStudentRegisterResponse(
            entry.StudentId,
            string.Empty,
            string.Empty,
            string.Empty,
            entry.Status.ToString(),
            entry.Note)).ToList());

        return new AttendanceDailySummaryResponse(
            register.Id,
            register.SchoolId,
            schoolName,
            register.Class,
            register.Teacher.DisplayName,
            register.AcademicTerm.Name,
            register.AttendanceDate.Date,
            register.Entries.Count,
            present,
            absent,
            late,
            excused,
            register.DispatchedAt is not null,
            register.DispatchedAt);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before loading attendance data.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return resolvedSchoolId;
    }

    private int RequireTeacherId()
    {
        if (_currentUserContext.Role is not UserRole.Teacher)
        {
            throw new UnauthorizedAccessException("Only teachers can mark attendance.");
        }

        return _currentUserContext.UserId ?? throw new UnauthorizedAccessException("Teacher identity is missing.");
    }

    private static AttendanceStatus ParseStatus(string status)
    {
        if (Enum.TryParse<AttendanceStatus>(status.Trim(), true, out var parsedStatus))
        {
            return parsedStatus;
        }

        return AttendanceStatus.Present;
    }

    private static (int Present, int Absent, int Late, int Excused) CountStatuses(IReadOnlyList<AttendanceStudentRegisterResponse> students)
    {
        var present = students.Count(student => student.Status.Equals(AttendanceStatus.Present.ToString(), StringComparison.OrdinalIgnoreCase));
        var absent = students.Count(student => student.Status.Equals(AttendanceStatus.Absent.ToString(), StringComparison.OrdinalIgnoreCase));
        var late = students.Count(student => student.Status.Equals(AttendanceStatus.Late.ToString(), StringComparison.OrdinalIgnoreCase));
        var excused = students.Count(student => student.Status.Equals(AttendanceStatus.Excused.ToString(), StringComparison.OrdinalIgnoreCase));
        return (present, absent, late, excused);
    }
}
