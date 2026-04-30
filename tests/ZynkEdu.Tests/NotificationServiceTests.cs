using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class NotificationServiceTests
{
    [Fact]
    public async Task SendAsync_TargetsOnlyTheSelectedClass()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 9, UserId = 90 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var studentA = new Student
        {
            SchoolId = 9,
            StudentNumber = "SCH009-0001",
            FullName = "Alpha Student",
            Class = "Form 1A",
            Level = "Form 1",
            ParentEmail = "alpha@example.com",
            ParentPhone = "2777000001",
            CreatedAt = DateTime.UtcNow
        };
        var studentB = new Student
        {
            SchoolId = 9,
            StudentNumber = "SCH009-0002",
            FullName = "Beta Student",
            Class = "Form 1B",
            Level = "Form 1",
            ParentEmail = "beta@example.com",
            ParentPhone = "2777000002",
            CreatedAt = DateTime.UtcNow
        };

        context.Students.AddRange(studentA, studentB);
        await context.SaveChangesAsync();

        context.Guardians.AddRange(
            new Guardian
            {
                SchoolId = 9,
                StudentId = studentA.Id,
                DisplayName = "Alpha Guardian",
                Relationship = "Mother",
                ParentEmail = "alpha@example.com",
                ParentPhone = "2777000001",
                IsPrimary = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Guardian
            {
                SchoolId = 9,
                StudentId = studentB.Id,
                DisplayName = "Beta Guardian",
                Relationship = "Father",
                ParentEmail = "beta@example.com",
                ParentPhone = "2777000002",
                IsPrimary = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new NotificationService(context, currentUser);
        var response = await service.SendAsync(new SendNotificationRequest(
            "Class alert",
            "Please attend the meeting.",
            NotificationType.Sms,
            null,
            NotificationAudience.Class,
            9,
            "Form 1A"));

        Assert.Single(response.Recipients);
        Assert.Equal(studentA.Id, response.Recipients[0].StudentId);
        Assert.Equal("2777000001", response.Recipients[0].Destination);
    }

    [Fact]
    public async Task SendAsync_TargetsTheRequestedStudentsOnly()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 4, UserId = 40 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var studentA = new Student
        {
            SchoolId = 4,
            StudentNumber = "SCH004-0001",
            FullName = "Gamma Student",
            Class = "Form 2A",
            Level = "Form 2",
            ParentEmail = "gamma@example.com",
            ParentPhone = "2777000003",
            CreatedAt = DateTime.UtcNow
        };
        var studentB = new Student
        {
            SchoolId = 4,
            StudentNumber = "SCH004-0002",
            FullName = "Delta Student",
            Class = "Form 2B",
            Level = "Form 2",
            ParentEmail = "delta@example.com",
            ParentPhone = "2777000004",
            CreatedAt = DateTime.UtcNow
        };

        context.Students.AddRange(studentA, studentB);
        await context.SaveChangesAsync();

        context.Guardians.AddRange(
            new Guardian
            {
                SchoolId = 4,
                StudentId = studentA.Id,
                DisplayName = "Gamma Guardian",
                Relationship = "Mother",
                ParentEmail = "gamma@example.com",
                ParentPhone = "2777000003",
                IsPrimary = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Guardian
            {
                SchoolId = 4,
                StudentId = studentB.Id,
                DisplayName = "Delta Guardian",
                Relationship = "Father",
                ParentEmail = "delta@example.com",
                ParentPhone = "2777000004",
                IsPrimary = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new NotificationService(context, currentUser);
        var response = await service.SendAsync(new SendNotificationRequest(
            "Individual alert",
            "Your child has a reminder.",
            NotificationType.Email,
            new[] { studentB.Id },
            NotificationAudience.Individual,
            4));

        Assert.Single(response.Recipients);
        Assert.Equal(studentB.Id, response.Recipients[0].StudentId);
        Assert.Equal("delta@example.com", response.Recipients[0].Destination);
    }
}
