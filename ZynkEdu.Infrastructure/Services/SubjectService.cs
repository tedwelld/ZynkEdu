using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class SubjectService : ISubjectService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly ISubjectCodeGenerator _subjectCodeGenerator;
    private readonly IAuditLogService _auditLogService;

    public SubjectService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, ISubjectCodeGenerator subjectCodeGenerator, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _subjectCodeGenerator = subjectCodeGenerator;
        _auditLogService = auditLogService;
    }

    public async Task<SubjectResponse> CreateAsync(CreateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var gradeLevel = NormalizeGradeLevel(request.GradeLevel);
        var weeklyLoad = NormalizeWeeklyLoad(request.WeeklyLoad);
        var code = string.IsNullOrWhiteSpace(request.Code)
            ? await _subjectCodeGenerator.GenerateAsync(request.Name, resolvedSchoolId, gradeLevel, null, cancellationToken)
            : NormalizeCode(request.Code);
        var subject = new Subject
        {
            SchoolId = resolvedSchoolId,
            Code = code,
            Name = request.Name.Trim(),
            GradeLevel = gradeLevel,
            WeeklyLoad = weeklyLoad,
            IsPractical = request.IsPractical
        };

        _dbContext.Subjects.Add(subject);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "Subject", subject.Id.ToString(), $"Created subject {subject.Name} ({subject.Code}).", cancellationToken);
        return new SubjectResponse(subject.Id, subject.SchoolId, subject.Code ?? string.Empty, subject.Name, subject.GradeLevel, subject.WeeklyLoad, subject.IsPractical);
    }

    public async Task<IReadOnlyList<SubjectResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.Subjects.AsNoTracking()
            : _dbContext.Subjects.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .OrderBy(x => x.Name)
            .Select(x => new SubjectResponse(x.Id, x.SchoolId, x.Code ?? string.Empty, x.Name, x.GradeLevel, x.WeeklyLoad, x.IsPractical))
            .ToListAsync(cancellationToken);
    }

    public async Task<SubjectResponse> UpdateAsync(int id, UpdateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject was not found in this school.");

        subject.Name = request.Name.Trim();
        subject.Code = string.IsNullOrWhiteSpace(request.Code)
            ? await _subjectCodeGenerator.GenerateAsync(subject.Name, subject.SchoolId, NormalizeGradeLevel(request.GradeLevel), subject.Id, cancellationToken)
            : NormalizeCode(request.Code);
        subject.GradeLevel = NormalizeGradeLevel(request.GradeLevel);
        subject.WeeklyLoad = NormalizeWeeklyLoad(request.WeeklyLoad);
        subject.IsPractical = request.IsPractical;

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(subject.SchoolId, "Updated", "Subject", subject.Id.ToString(), $"Updated subject {subject.Name} ({subject.Code}).", cancellationToken);
        return new SubjectResponse(subject.Id, subject.SchoolId, subject.Code ?? string.Empty, subject.Name, subject.GradeLevel, subject.WeeklyLoad, subject.IsPractical);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject was not found in this school.");

        _dbContext.Subjects.Remove(subject);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(subject.SchoolId, "Deleted", "Subject", subject.Id.ToString(), $"Deleted subject {subject.Name} ({subject.Code}).", cancellationToken);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving this subject.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return resolvedSchoolId;
    }

    private int RequireSchoolId() => ResolveSchoolId(null);

    private static string NormalizeCode(string code)
    {
        var value = code.Trim().ToUpperInvariant();
        return value.Length > 20 ? value[..20] : value;
    }

    private static string NormalizeGradeLevel(string? gradeLevel)
    {
        return SchoolLevelCatalog.NormalizeLevel(gradeLevel);
    }

    private static int NormalizeWeeklyLoad(int weeklyLoad)
    {
        if (weeklyLoad < 1 || weeklyLoad > 9)
        {
            throw new InvalidOperationException("The subject weekly load must be between 1 and 9.");
        }

        return weeklyLoad;
    }
}
