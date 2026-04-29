using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class TimetableDispatchServiceTests
{
    [Fact]
    public async Task DispatchDueTimetablesAsync_SkipsTeachersWithoutValidEmailAddresses()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 901, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "amunike",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 8,
            DisplayName = "Amunike Teacher",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 8,
            Code = "BIO",
            Name = "Biology",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.TimetablePublications.Add(new TimetablePublication
        {
            SchoolId = 8,
            Term = "Term 1",
            PublishedAt = DateTime.UtcNow.AddMinutes(-5),
            CreatedAt = DateTime.UtcNow
        });
        context.TimetableSlots.Add(new TimetableSlot
        {
            SchoolId = 8,
            Teacher = teacher,
            Subject = subject,
            Class = "Form 1A",
            Term = "Term 1",
            DayOfWeek = "Monday",
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(8, 40)
        });
        await context.SaveChangesAsync();

        var emailSender = new RecordingEmailSender();
        var service = new TimetableDispatchService(context, emailSender, NullLogger<TimetableDispatchService>.Instance);

        await service.DispatchDueTimetablesAsync();

        Assert.Empty(emailSender.Messages);

        var publication = await context.TimetablePublications.AsNoTracking().SingleAsync(x => x.SchoolId == 8 && x.Term == "Term 1");
        Assert.NotNull(publication.DispatchedAt);

        var dispatchLog = await context.TimetableDispatchLogs.AsNoTracking().SingleAsync(x => x.SchoolId == 8 && x.TeacherId == teacher.Id && x.Term == "Term 1");
        Assert.NotNull(dispatchLog.DispatchedAt);
        Assert.Contains("Skipped", dispatchLog.LastError ?? string.Empty);
    }
}
