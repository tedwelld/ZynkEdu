using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class TeacherAssignmentService : ITeacherAssignmentService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public TeacherAssignmentService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<TeacherAssignmentResponse> CreateAsync(CreateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var trimmedClass = request.Class.Trim();
        var schoolClass = await GetRequiredSchoolClassAsync(resolvedSchoolId, trimmedClass, cancellationToken);

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (subject is null)
        {
            throw new InvalidOperationException("Subject was not found in this school.");
        }

        EnsureClassHasSubjects(schoolClass);
        EnsureSubjectMatchesClassLevel(subject.GradeLevel, schoolClass.GradeLevel);
        EnsureSubjectIsAssignedToClass(subject.Id, schoolClass);
        await EnsureAssignmentOwnershipAsync(resolvedSchoolId, subject.Id, trimmedClass, request.TeacherId, null, cancellationToken);

        var assignment = new TeacherAssignment
        {
            SchoolId = resolvedSchoolId,
            TeacherId = request.TeacherId,
            SubjectId = request.SubjectId,
            Class = trimmedClass
        };

        _dbContext.TeacherAssignments.Add(assignment);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TeacherAssignmentResponse(assignment.Id, resolvedSchoolId, teacher.Id, teacher.DisplayName, subject.Id, subject.Name, subject.GradeLevel, assignment.Class);
    }

    public async Task<TeacherAssignmentBatchResponse> CreateBatchAsync(CreateTeacherAssignmentsBatchRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subjectIds = request.SubjectIds.Where(subjectId => subjectId > 0).Distinct().ToArray();
        var classes = request.Classes
            .Select(className => className.Trim())
            .Where(className => !string.IsNullOrWhiteSpace(className))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (subjectIds.Length == 0)
        {
            throw new InvalidOperationException("Choose at least one subject.");
        }

        if (classes.Length == 0)
        {
            throw new InvalidOperationException("Choose at least one class.");
        }

        var schoolClasses = await GetRequiredSchoolClassesAsync(resolvedSchoolId, classes, cancellationToken);
        var classLevel = ResolveBatchClassLevel(schoolClasses);

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        foreach (var schoolClass in schoolClasses)
        {
            EnsureClassHasSubjects(schoolClass);
        }

        var subjects = await _dbContext.Subjects
            .AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && subjectIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (subjects.Count != subjectIds.Length)
        {
            throw new InvalidOperationException("One or more subjects were not found in this school.");
        }

        foreach (var subject in subjects)
        {
            EnsureSubjectMatchesClassLevel(subject.GradeLevel, classLevel);
            foreach (var schoolClass in schoolClasses)
            {
                EnsureSubjectIsAssignedToClass(subject.Id, schoolClass);
            }
        }

        var existingKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var existingAssignments = await _dbContext.TeacherAssignments.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && subjectIds.Contains(x.SubjectId) && classes.Contains(x.Class))
            .ToListAsync(cancellationToken);

        foreach (var existing in existingAssignments)
        {
            if (existing.TeacherId != teacher.Id)
            {
                throw new InvalidOperationException($"The class and subject pair {existing.Class} / {subjectLookupName(existing.SubjectId, subjects)} is already assigned to another teacher.");
            }

            existingKeys.Add(BuildAssignmentKey(existing.SubjectId, existing.Class));
        }

        var pendingAssignments = new List<TeacherAssignment>();
        foreach (var subject in subjects.OrderBy(subject => subject.Name))
        {
            foreach (var className in classes.OrderBy(className => className))
            {
                var key = BuildAssignmentKey(subject.Id, className);
                if (existingKeys.Contains(key))
                {
                    continue;
                }

                pendingAssignments.Add(new TeacherAssignment
                {
                    SchoolId = resolvedSchoolId,
                    TeacherId = teacher.Id,
                    SubjectId = subject.Id,
                    Class = className
                });
                existingKeys.Add(key);
            }
        }

        if (pendingAssignments.Count > 0)
        {
            _dbContext.TeacherAssignments.AddRange(pendingAssignments);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var subjectLookup = subjects.ToDictionary(subject => subject.Id, subject => subject);
        var assignments = pendingAssignments
            .OrderBy(assignment => assignment.Class)
            .ThenBy(assignment => subjectLookup[assignment.SubjectId].Name)
            .Select(assignment => new TeacherAssignmentResponse(
                assignment.Id,
                resolvedSchoolId,
                teacher.Id,
                teacher.DisplayName,
                assignment.SubjectId,
                subjectLookup[assignment.SubjectId].Name,
                subjectLookup[assignment.SubjectId].GradeLevel,
                assignment.Class))
            .ToList();

        var requestedCount = subjectIds.Length * classes.Length;
        return new TeacherAssignmentBatchResponse(
            resolvedSchoolId,
            teacher.Id,
            teacher.DisplayName,
            requestedCount,
            pendingAssignments.Count,
            requestedCount - pendingAssignments.Count,
            assignments);
    }

    public async Task<IReadOnlyList<TeacherAssignmentResponse>> GetByTeacherAsync(int teacherId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.TeacherAssignments.AsNoTracking()
            : _dbContext.TeacherAssignments.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .Where(x => x.TeacherId == teacherId)
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .OrderBy(x => x.Class)
            .Select(x => new TeacherAssignmentResponse(x.Id, x.SchoolId, x.TeacherId, x.Teacher.DisplayName, x.SubjectId, x.Subject.Name, x.Subject.GradeLevel, x.Class))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TeacherAssignmentResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.TeacherAssignments.AsNoTracking()
            : _dbContext.TeacherAssignments.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .OrderBy(x => x.Teacher.DisplayName)
            .Select(x => new TeacherAssignmentResponse(x.Id, x.SchoolId, x.TeacherId, x.Teacher.DisplayName, x.SubjectId, x.Subject.Name, x.Subject.GradeLevel, x.Class))
            .ToListAsync(cancellationToken);
    }

    public async Task<TeacherAssignmentResponse> UpdateAsync(int id, UpdateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var assignment = await _dbContext.TeacherAssignments.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Teacher assignment was not found in this school.");
        var trimmedClass = request.Class.Trim();
        var schoolClass = await GetRequiredSchoolClassAsync(resolvedSchoolId, trimmedClass, cancellationToken);

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (subject is null)
        {
            throw new InvalidOperationException("Subject was not found in this school.");
        }

        EnsureClassHasSubjects(schoolClass);
        EnsureSubjectMatchesClassLevel(subject.GradeLevel, schoolClass.GradeLevel);
        EnsureSubjectIsAssignedToClass(subject.Id, schoolClass);
        await EnsureAssignmentOwnershipAsync(resolvedSchoolId, subject.Id, trimmedClass, request.TeacherId, id, cancellationToken);

        assignment.TeacherId = request.TeacherId;
        assignment.SubjectId = request.SubjectId;
        assignment.Class = trimmedClass;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new TeacherAssignmentResponse(assignment.Id, resolvedSchoolId, teacher.Id, teacher.DisplayName, subject.Id, subject.Name, subject.GradeLevel, assignment.Class);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var assignment = await _dbContext.TeacherAssignments.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Teacher assignment was not found in this school.");

        _dbContext.TeacherAssignments.Remove(assignment);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving this assignment.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return resolvedSchoolId;
    }

    private int RequireSchoolId() => ResolveSchoolId(null);

    private static string BuildAssignmentKey(int subjectId, string className) => $"{subjectId}|{className.Trim()}";

    private static string subjectLookupName(int subjectId, IReadOnlyList<Subject> subjects)
        => subjects.FirstOrDefault(subject => subject.Id == subjectId)?.Name ?? $"Subject {subjectId}";

    private async Task<SchoolClass> GetRequiredSchoolClassAsync(int schoolId, string className, CancellationToken cancellationToken)
    {
        var schoolClass = await _dbContext.SchoolClasses
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Name == className, cancellationToken);

        if (schoolClass is null)
        {
            throw new InvalidOperationException("The selected class was not found in this school.");
        }

        if (!schoolClass.IsActive)
        {
            throw new InvalidOperationException("The selected class is not active.");
        }

        return schoolClass;
    }

    private async Task<IReadOnlyList<SchoolClass>> GetRequiredSchoolClassesAsync(int schoolId, IEnumerable<string> classNames, CancellationToken cancellationToken)
    {
        var classList = classNames.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var schoolClasses = await _dbContext.SchoolClasses
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .Where(x => x.SchoolId == schoolId && classList.Contains(x.Name))
            .ToListAsync(cancellationToken);

        if (schoolClasses.Count != classList.Length)
        {
            throw new InvalidOperationException("One or more selected classes were not found in this school.");
        }

        if (schoolClasses.Any(schoolClass => !schoolClass.IsActive))
        {
            throw new InvalidOperationException("One or more selected classes are not active.");
        }

        return schoolClasses;
    }

    private static string ResolveBatchClassLevel(IEnumerable<SchoolClass> classes)
    {
        var resolvedLevels = classes
            .Select(classItem => SchoolLevelCatalog.NormalizeLevel(classItem.GradeLevel))
            .ToArray();

        var distinctLevels = resolvedLevels
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (distinctLevels.Length == 0)
        {
            throw new InvalidOperationException("The selected classes do not belong to a supported level.");
        }

        if (distinctLevels.Length > 1)
        {
            throw new InvalidOperationException("Choose classes from the same level before saving assignments.");
        }

        return distinctLevels[0];
    }

    private static void EnsureSubjectMatchesClassLevel(string subjectLevel, string classLevel)
    {
        var normalizedSubjectLevel = SchoolLevelCatalog.NormalizeLevel(subjectLevel);
        var normalizedClassLevel = SchoolLevelCatalog.NormalizeLevel(classLevel);

        if (normalizedSubjectLevel == SchoolLevelCatalog.General)
        {
            return;
        }

        if (normalizedClassLevel == SchoolLevelCatalog.General)
        {
            if (normalizedSubjectLevel != SchoolLevelCatalog.General)
            {
                throw new InvalidOperationException($"The selected subject is for {normalizedSubjectLevel}, which does not match the selected class level.");
            }

            return;
        }

        if (!string.Equals(normalizedSubjectLevel, normalizedClassLevel, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"The selected subject is for {normalizedSubjectLevel}, which does not match the selected class level.");
        }
    }

    private static void EnsureClassHasSubjects(SchoolClass schoolClass)
    {
        if (schoolClass.Subjects.Count == 0)
        {
            throw new InvalidOperationException("Assign subjects to the selected class before creating teacher assignments.");
        }
    }

    private static void EnsureSubjectIsAssignedToClass(int subjectId, SchoolClass schoolClass)
    {
        if (schoolClass.Subjects.All(link => link.SubjectId != subjectId))
        {
            throw new InvalidOperationException("The selected subject is not assigned to the selected class.");
        }
    }

    private async Task EnsureAssignmentOwnershipAsync(int schoolId, int subjectId, string className, int teacherId, int? currentAssignmentId, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.TeacherAssignments.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.SubjectId == subjectId && x.Class == className)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            return;
        }

        if (currentAssignmentId is not null && existing.Id == currentAssignmentId.Value)
        {
            return;
        }

        if (existing.TeacherId != teacherId)
        {
            throw new InvalidOperationException("This class and subject pair is already assigned to another teacher.");
        }

        throw new InvalidOperationException("This teacher assignment already exists.");
    }
}
