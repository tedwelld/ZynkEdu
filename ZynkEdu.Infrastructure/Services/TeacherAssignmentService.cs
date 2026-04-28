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
        var classLevel = ResolveClassLevel(trimmedClass);

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

        EnsureSubjectMatchesClassLevel(subject.GradeLevel, classLevel);

        var existingAssignment = await _dbContext.TeacherAssignments.AsNoTracking().FirstOrDefaultAsync(x =>
            x.SchoolId == resolvedSchoolId &&
            x.TeacherId == request.TeacherId &&
            x.SubjectId == request.SubjectId &&
            x.Class == trimmedClass, cancellationToken);

        if (existingAssignment is not null)
        {
            throw new InvalidOperationException("This teacher assignment already exists.");
        }

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

        var classLevel = ResolveBatchClassLevel(classes);

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.TeacherId && x.SchoolId == resolvedSchoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
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
        }

        var existingKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var existingAssignments = await _dbContext.TeacherAssignments.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && x.TeacherId == teacher.Id && subjectIds.Contains(x.SubjectId) && classes.Contains(x.Class))
            .ToListAsync(cancellationToken);

        foreach (var existing in existingAssignments)
        {
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
        var classLevel = ResolveClassLevel(trimmedClass);

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

        EnsureSubjectMatchesClassLevel(subject.GradeLevel, classLevel);

        var duplicateAssignment = await _dbContext.TeacherAssignments.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Id != id &&
            x.SchoolId == resolvedSchoolId &&
            x.TeacherId == request.TeacherId &&
            x.SubjectId == request.SubjectId &&
            x.Class == trimmedClass, cancellationToken);

        if (duplicateAssignment is not null)
        {
            throw new InvalidOperationException("This teacher assignment already exists.");
        }

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

    private static string ResolveClassLevel(string className)
    {
        if (SchoolLevelCatalog.TryGetClassLevel(className, out var level))
        {
            return level;
        }

        throw new InvalidOperationException("The selected class does not belong to a supported level.");
    }

    private static string ResolveBatchClassLevel(IEnumerable<string> classes)
    {
        var resolvedLevels = new List<string>();
        foreach (var className in classes)
        {
            if (!SchoolLevelCatalog.TryGetClassLevel(className, out var level))
            {
                throw new InvalidOperationException("The selected classes do not belong to a supported level.");
            }

            resolvedLevels.Add(level);
        }

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
        if (normalizedSubjectLevel == SchoolLevelCatalog.General)
        {
            return;
        }

        if (!string.Equals(normalizedSubjectLevel, classLevel, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"The selected subject is for {normalizedSubjectLevel}, which does not match the selected class level.");
        }
    }
}
