using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class DisciplineService : IDisciplineService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;

    public DisciplineService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<DisciplineIncidentResponse>> GetAllAsync(
        int? schoolId = null,
        int? studentId = null,
        bool? isResolved = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        IQueryable<DisciplineIncident> query = _dbContext.DisciplineIncidents.AsNoTracking()
            .Include(i => i.Student)
            .Where(i => i.SchoolId == resolvedSchoolId);

        if (studentId.HasValue)
            query = query.Where(i => i.StudentId == studentId.Value);

        if (isResolved.HasValue)
            query = query.Where(i => i.IsResolved == isResolved.Value);

        var incidents = await query
            .OrderByDescending(i => i.IncidentDate)
            .ThenByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var recorderIds = incidents.Select(i => i.RecordedByUserId).Distinct().ToList();
        var recorders = await _dbContext.Users.AsNoTracking()
            .Where(u => recorderIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        return incidents.Select(i =>
        {
            recorders.TryGetValue(i.RecordedByUserId, out var recorderName);
            return MapIncident(i, i.Student.FullName, i.Student.Class, recorderName ?? "Unknown");
        }).ToList();
    }

    public async Task<DisciplineIncidentResponse> CreateAsync(CreateDisciplineIncidentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var userId = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("User context required.");

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == request.StudentId && s.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Student not found in this school.");

        var severity = NormalizeSeverity(request.Severity);

        var incident = new DisciplineIncident
        {
            SchoolId = resolvedSchoolId,
            StudentId = request.StudentId,
            IncidentType = request.IncidentType.Trim(),
            Severity = severity,
            IncidentDate = request.IncidentDate.Date,
            Description = request.Description.Trim(),
            ActionTaken = request.ActionTaken?.Trim(),
            RecordedByUserId = userId,
            IsResolved = false
        };

        _dbContext.DisciplineIncidents.Add(incident);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "DisciplineIncident", incident.Id.ToString(),
            $"Incident recorded for {student.FullName}: {incident.IncidentType} ({severity}) on {incident.IncidentDate:yyyy-MM-dd}.", cancellationToken);

        var recorderName = await _dbContext.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

        return MapIncident(incident, student.FullName, student.Class, recorderName);
    }

    public async Task<DisciplineIncidentResponse> UpdateAsync(int id, UpdateDisciplineIncidentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var incident = await _dbContext.DisciplineIncidents
            .Include(i => i.Student)
            .FirstOrDefaultAsync(i => i.Id == id && i.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Incident not found.");

        var severity = NormalizeSeverity(request.Severity);

        incident.IncidentType = request.IncidentType.Trim();
        incident.Severity = severity;
        incident.IncidentDate = request.IncidentDate.Date;
        incident.Description = request.Description.Trim();
        incident.ActionTaken = request.ActionTaken?.Trim();
        incident.IsResolved = request.IsResolved;
        incident.ResolvedAt = request.IsResolved && incident.ResolvedAt == null ? DateTime.UtcNow : incident.ResolvedAt;
        incident.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var recorderName = await _dbContext.Users.AsNoTracking()
            .Where(u => u.Id == incident.RecordedByUserId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

        return MapIncident(incident, incident.Student.FullName, incident.Student.Class, recorderName);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var incident = await _dbContext.DisciplineIncidents.FirstOrDefaultAsync(i => i.Id == id && i.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Incident not found.");

        _dbContext.DisciplineIncidents.Remove(incident);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Deleted", "DisciplineIncident", id.ToString(),
            $"Discipline incident {id} deleted.", cancellationToken);
    }

    private static DisciplineIncidentResponse MapIncident(DisciplineIncident incident, string studentName, string studentClass, string recorderName) =>
        new(incident.Id, incident.SchoolId, incident.StudentId, studentName, studentClass,
            incident.IncidentType, incident.Severity, incident.IncidentDate, incident.Description,
            incident.ActionTaken, recorderName, incident.IsResolved, incident.ResolvedAt, incident.CreatedAt, incident.UpdatedAt);

    private static string NormalizeSeverity(string severity) =>
        severity.Trim() switch
        {
            var s when string.Equals(s, "Minor", StringComparison.OrdinalIgnoreCase) => "Minor",
            var s when string.Equals(s, "Moderate", StringComparison.OrdinalIgnoreCase) => "Moderate",
            var s when string.Equals(s, "Serious", StringComparison.OrdinalIgnoreCase) => "Serious",
            var s when string.Equals(s, "Critical", StringComparison.OrdinalIgnoreCase) => "Critical",
            _ => throw new InvalidOperationException("Severity must be Minor, Moderate, Serious, or Critical.")
        };

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        return _currentUserContext.SchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private int ResolveEditableSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        if (_currentUserContext.SchoolId is not int resolvedSchoolId ||
            _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
            throw new UnauthorizedAccessException("Only admins and teachers can manage discipline incidents.");

        return resolvedSchoolId;
    }
}
