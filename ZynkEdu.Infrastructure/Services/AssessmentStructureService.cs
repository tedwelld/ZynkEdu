using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AssessmentStructureService : IAssessmentStructureService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public AssessmentStructureService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<AssessmentStructureResponse>> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var effectiveSchoolId = ResolveSchoolId(schoolId);
        var query = _dbContext.AssessmentStructures.AsNoTracking()
            .Include(a => a.Subject)
            .Where(a => a.SchoolId == effectiveSchoolId)
            .OrderBy(a => a.Level)
            .ThenBy(a => a.SubjectId == null ? 0 : 1)
            .ThenBy(a => a.Subject != null ? a.Subject.Name : string.Empty);

        var items = await query.ToListAsync(cancellationToken);
        return items.Select(Map).ToList();
    }

    public async Task<AssessmentStructureResponse> GetForLevelAsync(string level, int? subjectId = null, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var effectiveSchoolId = ResolveSchoolId(schoolId);

        // Prefer subject-specific, fall back to level-wide, then defaults
        var structures = await _dbContext.AssessmentStructures.AsNoTracking()
            .Include(a => a.Subject)
            .Where(a => a.SchoolId == effectiveSchoolId && a.Level == level && (a.SubjectId == null || a.SubjectId == subjectId))
            .ToListAsync(cancellationToken);

        var specific = subjectId.HasValue ? structures.FirstOrDefault(s => s.SubjectId == subjectId) : null;
        var general = structures.FirstOrDefault(s => s.SubjectId == null);

        if (specific is not null) return Map(specific);
        if (general is not null) return Map(general);

        // Return defaults (30/20/50) without a DB row
        return new AssessmentStructureResponse(0, effectiveSchoolId, level, subjectId, null, 30m, 20m, 50m, DateTime.UtcNow, DateTime.UtcNow);
    }

    public async Task<AssessmentStructureResponse> SaveAsync(SaveAssessmentStructureRequest request, int? id = null, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var effectiveSchoolId = ResolveSchoolId(schoolId);

        AssessmentStructure entity;
        if (id.HasValue)
        {
            entity = await _dbContext.AssessmentStructures
                .FirstOrDefaultAsync(a => a.Id == id.Value && a.SchoolId == effectiveSchoolId, cancellationToken)
                ?? throw new InvalidOperationException("Assessment structure not found.");
        }
        else
        {
            entity = new AssessmentStructure { SchoolId = effectiveSchoolId };
            _dbContext.AssessmentStructures.Add(entity);
        }

        entity.Level = request.Level;
        entity.SubjectId = request.SubjectId;
        entity.TestWeight = request.TestWeight;
        entity.AssignmentWeight = request.AssignmentWeight;
        entity.ExamWeight = request.ExamWeight;
        entity.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _dbContext.Entry(entity).Reference(a => a.Subject).LoadAsync(cancellationToken);
        return Map(entity);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var effectiveSchoolId = ResolveSchoolId(schoolId);
        var entity = await _dbContext.AssessmentStructures
            .FirstOrDefaultAsync(a => a.Id == id && a.SchoolId == effectiveSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Assessment structure not found.");

        _dbContext.AssessmentStructures.Remove(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private int ResolveSchoolId(int? requested)
    {
        if (_currentUserContext.Role == Domain.Enums.UserRole.PlatformAdmin && requested.HasValue)
            return requested.Value;
        return _currentUserContext.SchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private static AssessmentStructureResponse Map(AssessmentStructure a) =>
        new(a.Id, a.SchoolId, a.Level, a.SubjectId, a.Subject?.Name, a.TestWeight, a.AssignmentWeight, a.ExamWeight, a.CreatedAt, a.UpdatedAt);
}
