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

        var notification = new Notification
        {
            SchoolId = schoolId,
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Type = request.Type,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        if (audience is NotificationAudience.Teachers or NotificationAudience.Admins or NotificationAudience.PlatformAdmins || request.StaffIds is { Count: > 0 })
        {
            var targetStaff = await ResolveStaffAsync(schoolId, audience, request.StaffIds, cancellationToken);
            if (targetStaff.Count == 0)
            {
                throw new InvalidOperationException("No matching staff members were found.");
            }

            foreach (var staff in targetStaff)
            {
                notification.Recipients.Add(new NotificationRecipient
                {
                    StaffUserId = staff.Id,
                    RecipientType = staff.Role.ToString(),
                    Status = NotificationStatus.Pending,
                    Destination = ResolveStaffDestination(staff, request.Type)
                });
            }
        }
        else
        {
            var targetStudents = audience switch
            {
                NotificationAudience.Individual => await ResolveStudentsByIdAsync(schoolId, request.StudentIds, cancellationToken),
                NotificationAudience.Class => await ResolveStudentsByClassAsync(schoolId, request.ClassName, cancellationToken),
                NotificationAudience.All or NotificationAudience.Guardians => await _dbContext.Students.Where(x => x.SchoolId == schoolId).ToListAsync(cancellationToken),
                _ => throw new InvalidOperationException("Choose a notification audience.")
            };

            if (targetStudents.Count == 0)
            {
                throw new InvalidOperationException("No matching students were found.");
            }

            foreach (var student in targetStudents)
            {
                var guardians = await _dbContext.Guardians.AsNoTracking()
                    .Where(x => x.StudentId == student.Id && x.IsActive)
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenBy(x => x.Id)
                    .ToListAsync(cancellationToken);

                if (guardians.Count == 0 && (!string.IsNullOrWhiteSpace(student.ParentEmail) || !string.IsNullOrWhiteSpace(student.ParentPhone)))
                {
                    guardians.Add(new Guardian
                    {
                        SchoolId = student.SchoolId,
                        StudentId = student.Id,
                        DisplayName = student.FullName,
                        Relationship = "Guardian",
                        ParentEmail = student.ParentEmail,
                        ParentPhone = student.ParentPhone,
                        IsPrimary = true,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                foreach (var guardian in guardians)
                {
                    notification.Recipients.Add(new NotificationRecipient
                    {
                        StudentId = student.Id,
                        RecipientType = "Guardian",
                        Status = NotificationStatus.Pending,
                        Destination = request.Type == NotificationType.Email ? guardian.ParentEmail : guardian.ParentPhone
                    });
                }
            }
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
                x.Student?.FullName ?? x.StaffUser?.DisplayName ?? x.Destination ?? "Recipient",
                x.Destination ?? string.Empty,
                x.Status.ToString(),
                x.Attempts,
                x.LastError,
                x.RecipientType)).ToList());
    }

    public async Task<IReadOnlyList<NotificationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Notifications.AsNoTracking()
            : _dbContext.Notifications.AsNoTracking().Where(x => x.SchoolId == RequireCurrentSchoolId());

        var notifications = await query
            .Include(x => x.Recipients)
                .ThenInclude(x => x.Student)
            .Include(x => x.Recipients)
                .ThenInclude(x => x.StaffUser)
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
                x.Student?.FullName ?? x.StaffUser?.DisplayName ?? x.Destination ?? "Recipient",
                x.Destination ?? string.Empty,
                x.Status.ToString(),
                x.Attempts,
                x.LastError,
                x.RecipientType)).ToList())).ToList();
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

    private async Task<List<AppUser>> ResolveStaffAsync(int schoolId, NotificationAudience audience, IReadOnlyList<int>? staffIds, CancellationToken cancellationToken)
    {
        var query = _dbContext.Users.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.IsActive && x.Role != UserRole.PlatformAdmin);

        query = audience switch
        {
            NotificationAudience.Teachers => query.Where(x => x.Role == UserRole.Teacher),
            NotificationAudience.Admins => query.Where(x => x.Role == UserRole.Admin),
            NotificationAudience.PlatformAdmins => _dbContext.Users.AsNoTracking().Where(x => x.IsActive && x.Role == UserRole.PlatformAdmin),
            _ => query
        };

        if (staffIds is { Count: > 0 })
        {
            var requestedIds = staffIds.Where(id => id > 0).Distinct().ToArray();
            query = query.Where(x => requestedIds.Contains(x.Id));
        }

        return await query.OrderBy(x => x.DisplayName).ToListAsync(cancellationToken);
    }

    private static string ResolveStaffDestination(AppUser user, NotificationType type)
    {
        if (type == NotificationType.Email)
        {
            return user.ContactEmail ?? user.Username;
        }

        return user.Username;
    }
}
