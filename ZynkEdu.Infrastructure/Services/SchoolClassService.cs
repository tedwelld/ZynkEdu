using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class SchoolClassService : ISchoolClassService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;

    public SchoolClassService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<SchoolClassResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var query = _dbContext.SchoolClasses.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .OrderBy(x => x.GradeLevel)
            .ThenBy(x => x.Name);

        var classes = await query.ToListAsync(cancellationToken);
        return classes.Select(Map).ToList();
    }

    public async Task<SchoolClassResponse> CreateAsync(CreateSchoolClassRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var gradeLevel = NormalizeClassLevel(request.GradeLevel);
        var className = NormalizeClassName(request.ClassName);
        EnsureClassNameMatchesLevel(className, gradeLevel);

        if (await _dbContext.SchoolClasses.AnyAsync(x => x.SchoolId == resolvedSchoolId && x.Name == className, cancellationToken))
        {
            throw new InvalidOperationException("A class with the same name already exists in this school.");
        }

        var schoolClass = new SchoolClass
        {
            SchoolId = resolvedSchoolId,
            Name = className,
            GradeLevel = gradeLevel,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SchoolClasses.Add(schoolClass);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "SchoolClass", schoolClass.Id.ToString(), $"Created class {schoolClass.Name} for {schoolClass.GradeLevel}.", cancellationToken);

        return await GetByIdAsync(schoolClass.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task<SchoolClassResponse> UpdateAsync(int id, UpdateSchoolClassRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var schoolClass = await _dbContext.SchoolClasses
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Class was not found in this school.");

        var gradeLevel = NormalizeClassLevel(request.GradeLevel);
        var className = NormalizeClassName(request.ClassName);
        EnsureClassNameMatchesLevel(className, gradeLevel);

        if (await _dbContext.SchoolClasses.AnyAsync(x => x.Id != id && x.SchoolId == resolvedSchoolId && x.Name == className, cancellationToken))
        {
            throw new InvalidOperationException("A class with the same name already exists in this school.");
        }

        if (schoolClass.Subjects.Any(subjectLink =>
                !string.Equals(SchoolLevelCatalog.NormalizeLevel(subjectLink.Subject.GradeLevel), SchoolLevelCatalog.General, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(SchoolLevelCatalog.NormalizeLevel(subjectLink.Subject.GradeLevel), gradeLevel, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Reassign the class subjects before changing the class level.");
        }

        schoolClass.Name = className;
        schoolClass.GradeLevel = gradeLevel;
        schoolClass.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "SchoolClass", schoolClass.Id.ToString(), $"Updated class {schoolClass.Name} for {schoolClass.GradeLevel}.", cancellationToken);

        return await GetByIdAsync(schoolClass.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task<SchoolClassResponse> AssignSubjectsAsync(int id, AssignClassSubjectsRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var schoolClass = await _dbContext.SchoolClasses
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Class was not found in this school.");

        if (!schoolClass.IsActive)
        {
            throw new InvalidOperationException("Activate the class before assigning subjects.");
        }

        var normalizedLevel = NormalizeClassLevel(schoolClass.GradeLevel);
        var subjectIds = request.SubjectIds.Where(subjectId => subjectId > 0).Distinct().ToArray();

        var subjects = subjectIds.Length == 0
            ? new List<Subject>()
            : await _dbContext.Subjects.AsNoTracking()
                .Where(x => x.SchoolId == resolvedSchoolId && subjectIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

        if (subjects.Count != subjectIds.Length)
        {
            throw new InvalidOperationException("One or more subjects were not found in this school.");
        }

        foreach (var subject in subjects)
        {
            var subjectLevel = NormalizeClassLevel(subject.GradeLevel);
            if (!string.Equals(subjectLevel, normalizedLevel, StringComparison.OrdinalIgnoreCase) && subjectLevel != SchoolLevelCatalog.General)
            {
                throw new InvalidOperationException($"Subject {subject.Name} belongs to {subjectLevel}, which does not match the class level.");
            }
        }

        var existingLinks = schoolClass.Subjects.ToList();
        _dbContext.SchoolClassSubjects.RemoveRange(existingLinks);

        foreach (var subject in subjects)
        {
            _dbContext.SchoolClassSubjects.Add(new SchoolClassSubject
            {
                SchoolId = resolvedSchoolId,
                SchoolClassId = schoolClass.Id,
                SubjectId = subject.Id,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "SchoolClass", schoolClass.Id.ToString(), $"Assigned {subjects.Count} subject(s) to class {schoolClass.Name}.", cancellationToken);

        return await GetByIdAsync(schoolClass.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var schoolClass = await _dbContext.SchoolClasses.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Class was not found in this school.");

        schoolClass.IsActive = false;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "SchoolClass", schoolClass.Id.ToString(), $"Deactivated class {schoolClass.Name}.", cancellationToken);
    }

    private async Task<SchoolClassResponse> GetByIdAsync(int id, int schoolId, CancellationToken cancellationToken)
    {
        var schoolClass = await _dbContext.SchoolClasses.AsNoTracking()
            .Where(x => x.Id == id && x.SchoolId == schoolId)
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .FirstAsync(cancellationToken);

        return Map(schoolClass);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving this class.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return resolvedSchoolId;
    }

    private static string NormalizeClassName(string value) => value.Trim();

    private static string NormalizeClassLevel(string? gradeLevel)
    {
        var normalized = SchoolLevelCatalog.NormalizeLevel(gradeLevel);
        if (!SchoolLevelCatalog.IsKnownLevel(normalized) || normalized == SchoolLevelCatalog.General)
        {
            throw new InvalidOperationException("Choose one of the supported levels.");
        }

        return normalized;
    }

    private static void EnsureClassNameMatchesLevel(string className, string gradeLevel)
    {
        var allowedClasses = SchoolLevelCatalog.GetClassesForLevel(gradeLevel);
        if (allowedClasses.Count == 0 || !allowedClasses.Any(value => string.Equals(value, className, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException($"The selected class name does not belong to {gradeLevel}.");
        }
    }

    private static SchoolClassResponse Map(SchoolClass schoolClass)
    {
        var subjects = schoolClass.Subjects
            .Where(x => x.Subject is not null)
            .OrderBy(x => x.Subject.Name)
            .ToList();

        return new SchoolClassResponse(
            schoolClass.Id,
            schoolClass.SchoolId,
            schoolClass.Name,
            schoolClass.GradeLevel,
            schoolClass.IsActive,
            subjects.Count > 0,
            subjects.Select(x => x.SubjectId).ToList(),
            subjects.Select(x => x.Subject.Name).ToList(),
            schoolClass.CreatedAt);
    }
}
