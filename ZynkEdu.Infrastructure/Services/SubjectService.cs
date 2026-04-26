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

    public SubjectService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<SubjectResponse> CreateAsync(CreateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subject = new Subject
        {
            SchoolId = resolvedSchoolId,
            Name = request.Name.Trim()
        };

        _dbContext.Subjects.Add(subject);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new SubjectResponse(subject.Id, subject.SchoolId, subject.Name);
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
            .Select(x => new SubjectResponse(x.Id, x.SchoolId, x.Name))
            .ToListAsync(cancellationToken);
    }

    public async Task<SubjectResponse> UpdateAsync(int id, UpdateSubjectRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject was not found in this school.");

        subject.Name = request.Name.Trim();
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new SubjectResponse(subject.Id, subject.SchoolId, subject.Name);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject was not found in this school.");

        _dbContext.Subjects.Remove(subject);
        await _dbContext.SaveChangesAsync(cancellationToken);
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
}
