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
        var schoolId = ResolveSchoolId(request.SchoolId);
        var createdBy = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("Creator is missing.");
        var audience = request.Audience;
        if (audience == NotificationAudience.All && request.StudentIds is { Count: > 0 } && string.IsNullOrWhiteSpace(request.ClassName))
        {
            audience = NotificationAudience.Individual;
        }

        var targetStudents = audience switch
        {
            NotificationAudience.Individual => await ResolveStudentsByIdAsync(schoolId, request.StudentIds, cancellationToken),
            NotificationAudience.Class => await ResolveStudentsByClassAsync(schoolId, request.ClassName, cancellationToken),
            NotificationAudience.All => await _dbContext.Students.Where(x => x.SchoolId == schoolId).ToListAsync(cancellationToken),
            _ => throw new InvalidOperationException("Choose a notification audience.")
        };

        if (targetStudents.Count == 0)
        {
            throw new InvalidOperationException("No matching students were found.");
        }

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
            : _dbContext.Notifications.AsNoTracking().Where(x => x.SchoolId == RequireCurrentSchoolId());

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

    private int ResolveSchoolId(int? requestedSchoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return requestedSchoolId ?? throw new InvalidOperationException("Choose a school before sending this notification.");
        }

        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        if (requestedSchoolId is not null && requestedSchoolId != schoolId)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return schoolId;
    }

    private int RequireCurrentSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return schoolId;
    }

    private async Task<List<Student>> ResolveStudentsByIdAsync(int schoolId, IReadOnlyList<int>? studentIds, CancellationToken cancellationToken)
    {
        var requestedIds = studentIds?.Where(id => id > 0).Distinct().ToArray() ?? Array.Empty<int>();
        if (requestedIds.Length == 0)
        {
            throw new InvalidOperationException("Choose at least one student.");
        }

        var students = await _dbContext.Students
            .Where(x => x.SchoolId == schoolId && requestedIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (students.Count != requestedIds.Length)
        {
            throw new InvalidOperationException("One or more selected students were not found in this school.");
        }

        return students;
    }

    private async Task<List<Student>> ResolveStudentsByClassAsync(int schoolId, string? className, CancellationToken cancellationToken)
    {
        var trimmedClass = className?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedClass))
        {
            throw new InvalidOperationException("Choose a class.");
        }

        var students = await _dbContext.Students
            .Where(x => x.SchoolId == schoolId && x.Class == trimmedClass)
            .ToListAsync(cancellationToken);

        if (students.Count == 0)
        {
            throw new InvalidOperationException("No students were found for the selected class.");
        }

        return students;
    }
}
