using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AuditLogService : IAuditLogService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        ILogger<AuditLogService> logger)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _logger = logger;
    }

    public async Task LogAsync(int? schoolId, string action, string entityType, string entityId, string summary, CancellationToken cancellationToken = default)
    {
        var log = new AuditLog
        {
            SchoolId = schoolId ?? _currentUserContext.SchoolId,
            ActorUserId = _currentUserContext.UserId,
            ActorRole = _currentUserContext.Role?.ToString() ?? "System",
            ActorName = _currentUserContext.UserName ?? "System",
            Action = action.Trim(),
            EntityType = entityType.Trim(),
            EntityId = entityId.Trim(),
            Summary = summary.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            _dbContext.AuditLogs.Add(log);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _dbContext.Entry(log).State = EntityState.Detached;
            _logger.LogWarning(ex, "Audit log write failed for {Action} on {EntityType}:{EntityId}. The primary operation will continue.", action, entityType, entityId);
        }
    }

    public async Task<IReadOnlyList<AuditLogResponse>> GetRecentAsync(int? schoolId = null, int take = 10, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId
            : RequireSchoolId();

        var query = _currentUserContext.Role == UserRole.PlatformAdmin && resolvedSchoolId is null
            ? _dbContext.AuditLogs.AsNoTracking()
            : _dbContext.AuditLogs.AsNoTracking().Where(x => x.SchoolId == resolvedSchoolId);

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(Math.Clamp(take, 1, 50))
            .Select(x => new AuditLogResponse(
                x.Id,
                x.SchoolId,
                x.ActorUserId,
                x.ActorRole,
                x.ActorName,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Summary,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
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
}
