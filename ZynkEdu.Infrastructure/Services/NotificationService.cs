using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class NotificationService : INotificationService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public NotificationService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<NotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken cancellationToken = default)
    {
        var schoolId = RequireSchoolId();
        var createdBy = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("Creator is missing.");
        var targetStudents = request.StudentIds?.Count > 0
            ? await _dbContext.Students.Where(x => x.SchoolId == schoolId && request.StudentIds.Contains(x.Id)).ToListAsync(cancellationToken)
            : await _dbContext.Students.Where(x => x.SchoolId == schoolId).ToListAsync(cancellationToken);

        var notification = new Notification
        {
            SchoolId = schoolId,
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Type = request.Type,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var student in targetStudents)
        {
            notification.Recipients.Add(new NotificationRecipient
            {
                Student = student,
                Status = NotificationStatus.Pending,
                Destination = request.Type == NotificationType.Email ? student.ParentEmail : student.ParentPhone
            });
        }

        _dbContext.Notifications.Add(notification);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new NotificationResponse(
            notification.Id,
            notification.SchoolId,
            notification.Title,
            notification.Message,
            notification.Type,
            notification.CreatedBy,
            notification.CreatedAt,
            notification.Recipients.Select(x => new NotificationRecipientResponse(
                x.StudentId,
                x.Student.FullName,
                x.Destination ?? string.Empty,
                x.Status.ToString(),
                x.Attempts,
                x.LastError)).ToList());
    }

    public async Task<IReadOnlyList<NotificationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Notifications.AsNoTracking()
            : _dbContext.Notifications.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());

        var notifications = await query
            .Include(x => x.Recipients)
                .ThenInclude(x => x.Student)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        return notifications.Select(notification => new NotificationResponse(
            notification.Id,
            notification.SchoolId,
            notification.Title,
            notification.Message,
            notification.Type,
            notification.CreatedBy,
            notification.CreatedAt,
            notification.Recipients.Select(x => new NotificationRecipientResponse(
                x.StudentId,
                x.Student.FullName,
                x.Destination ?? string.Empty,
                x.Status.ToString(),
                x.Attempts,
                x.LastError)).ToList())).ToList();
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
