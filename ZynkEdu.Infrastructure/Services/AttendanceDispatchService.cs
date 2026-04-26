using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AttendanceDispatchService : IAttendanceDispatchService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<AttendanceDispatchService> _logger;

    public AttendanceDispatchService(
        ZynkEduDbContext dbContext,
        IEmailSender emailSender,
        ILogger<AttendanceDispatchService> logger)
    {
        _dbContext = dbContext;
        _emailSender = emailSender;
        _logger = logger;
    }

    public async Task DispatchDueRegistersAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.Now;
        if (now.Hour < 13)
        {
            return;
        }

        var attendanceDate = now.Date;
        var schools = await _dbContext.Schools.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        foreach (var school in schools)
        {
            if (await _dbContext.AttendanceDispatchLogs.AsNoTracking().AnyAsync(x => x.SchoolId == school.Id && x.AttendanceDate == attendanceDate, cancellationToken))
            {
                continue;
            }

            var registers = await _dbContext.AttendanceRegisters.AsNoTracking()
                .Include(x => x.Teacher)
                .Include(x => x.AcademicTerm)
                .Include(x => x.Entries)
                    .ThenInclude(x => x.Student)
                .Where(x => x.SchoolId == school.Id && x.AttendanceDate == attendanceDate)
                .OrderBy(x => x.Class)
                .ToListAsync(cancellationToken);

            if (registers.Count == 0)
            {
                continue;
            }

            var message = BuildEmailBody(school.Name, attendanceDate, registers);
            var notificationMessage = BuildNotificationMessage(school.Name, attendanceDate, registers);
            var destinationEmail = await ResolveDestinationEmailAsync(school, cancellationToken);
            var emailSucceeded = false;
            string? errorMessage = null;

            try
            {
                if (!string.IsNullOrWhiteSpace(destinationEmail))
                {
                    await _emailSender.SendAsync(
                        destinationEmail,
                        $"Daily attendance register - {school.Name} - {attendanceDate:dd MMM yyyy}",
                        message,
                        cancellationToken);
                    emailSucceeded = true;
                }
                else
                {
                    errorMessage = "School admin contact email is missing.";
                }
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                _logger.LogWarning(ex, "Failed to email the attendance register for school {SchoolId}", school.Id);
            }

            var log = new AttendanceDispatchLog
            {
                SchoolId = school.Id,
                AttendanceDate = attendanceDate,
                DispatchedAt = DateTime.UtcNow,
                EmailSucceeded = emailSucceeded,
                DestinationEmail = destinationEmail,
                ErrorMessage = errorMessage
            };

            foreach (var register in registers)
            {
                _dbContext.AttendanceRegisters.Attach(register);
                register.DispatchedAt = DateTime.UtcNow;
            }

            _dbContext.AttendanceDispatchLogs.Add(log);
            _dbContext.Notifications.Add(new Notification
            {
                SchoolId = school.Id,
                Title = $"Daily attendance register - {attendanceDate:dd MMM yyyy}",
                Message = notificationMessage,
                Type = NotificationType.System,
                CreatedBy = 0,
                CreatedAt = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<string?> ResolveDestinationEmailAsync(School school, CancellationToken cancellationToken)
    {
        var directContact = NormalizeEmail(school.AdminContactEmail);
        if (!string.IsNullOrWhiteSpace(directContact))
        {
            return directContact;
        }

        return await _dbContext.Users.AsNoTracking()
            .Where(x => x.SchoolId == school.Id && x.Role == UserRole.Admin && x.IsActive && x.Username.Contains('@'))
            .Select(x => x.Username)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string BuildEmailBody(string schoolName, DateTime attendanceDate, IReadOnlyList<AttendanceRegister> registers)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"Daily attendance register for {schoolName}");
        builder.AppendLine($"Date: {attendanceDate:dddd, dd MMMM yyyy}");
        builder.AppendLine();

        foreach (var register in registers.OrderBy(x => x.Class))
        {
            var present = 0;
            var absent = 0;
            var late = 0;
            var excused = 0;

            builder.AppendLine($"{register.Class} - {register.Teacher.DisplayName}");

            foreach (var entry in register.Entries.OrderBy(x => x.Student.FullName))
            {
                builder.AppendLine($"  {entry.Student.FullName} ({entry.Student.StudentNumber}) - {entry.Status}");

                switch (entry.Status)
                {
                    case AttendanceStatus.Present:
                        present++;
                        break;
                    case AttendanceStatus.Absent:
                        absent++;
                        break;
                    case AttendanceStatus.Late:
                        late++;
                        break;
                    case AttendanceStatus.Excused:
                        excused++;
                        break;
                }
            }

            builder.AppendLine($"  Summary: Present {present}, Absent {absent}, Late {late}, Excused {excused}");
            builder.AppendLine();
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildNotificationMessage(string schoolName, DateTime attendanceDate, IReadOnlyList<AttendanceRegister> registers)
    {
        var builder = new StringBuilder();
        builder.Append($"Daily attendance register for {schoolName} on {attendanceDate:dd MMM yyyy}. ");

        foreach (var register in registers.OrderBy(x => x.Class))
        {
            var present = register.Entries.Count(x => x.Status == AttendanceStatus.Present);
            var absent = register.Entries.Count(x => x.Status == AttendanceStatus.Absent);
            var late = register.Entries.Count(x => x.Status == AttendanceStatus.Late);
            var excused = register.Entries.Count(x => x.Status == AttendanceStatus.Excused);
            builder.Append($"{register.Class}: P{present} A{absent} L{late} E{excused}. ");
        }

        var message = builder.ToString().Trim();
        return message.Length <= 1900 ? message : $"{message[..1897]}...";
    }

    private static string? NormalizeEmail(string? email)
        => string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
}
