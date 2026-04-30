using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class ResultGradingSchemeTests
{
    [Fact]
    public async Task CreateAsync_UsesTheConfiguredSchoolGradingScheme()
    {
        var adminContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 31, UserId = 310 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, adminContext);
        await using var _ = connection;

        await SeedSchoolAsync(context, 31, "Central Academy");

        var gradingService = new GradingSchemeService(context, adminContext, new StubAuditLogService());
        await gradingService.SaveAsync(new SaveGradingSchemeRequest([
            ..BuildBandsForLevel("ZGC Level", 90m, 80m, 70m, 60m),
            ..BuildBandsForLevel("O'Level", 80m, 70m, 60m, 50m),
            ..BuildBandsForLevel("A'Level", 80m, 70m, 60m, 50m)
        ]));

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher.custom.grade",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 31,
            DisplayName = "Teacher Custom Grade",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject { SchoolId = 31, Name = "Mathematics", GradeLevel = "ZGC Level" };
        var student = new Student
        {
            SchoolId = 31,
            StudentNumber = "SCH031-0001",
            FullName = "Custom Grade Student",
            Class = "Form 1A",
            Level = "ZGC Level",
            ParentEmail = "guardian@example.com",
            ParentPhone = "2777000031",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.Students.Add(student);
        await context.SaveChangesAsync();

        context.TeacherAssignments.Add(new TeacherAssignment
        {
            SchoolId = 31,
            TeacherId = teacher.Id,
            SubjectId = subject.Id,
            Class = "Form 1A"
        });
        await context.SaveChangesAsync();

        var teacherContext = new TestCurrentUserContext { Role = UserRole.Teacher, SchoolId = 31, UserId = teacher.Id };
        var (teacherConnection, teacherDb) = await TestDatabase.CreateContextAsync(databasePath, teacherContext);
        await using var _teacherConnection = teacherConnection;

        var resultService = new ResultService(
            teacherDb,
            teacherContext,
            new StubNotificationService(),
            new StubAuditLogService(),
            new RecordingEmailSender(),
            new RecordingSmsSender(),
            new ReportEmailTemplateService(),
            new GradingSchemeService(teacherDb, teacherContext, new StubAuditLogService()));

        var result = await resultService.CreateAsync(new CreateResultRequest(student.Id, subject.Id, 85m, "Term 1", null));

        Assert.Equal("B", result.Grade);
    }

    private static async Task SeedSchoolAsync(ZynkEduDbContext context, int schoolId, string name)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = $"SCH{schoolId}",
            Name = name,
            Address = "Main Street",
            CreatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
    }

    private static IReadOnlyList<SaveGradingBandRequest> BuildBandsForLevel(string level, decimal aMin, decimal bMin, decimal cMin, decimal dMin)
    {
        return [
            new(level, "A", aMin, 100m),
            new(level, "B", bMin, aMin - 0.1m),
            new(level, "C", cMin, bMin - 0.1m),
            new(level, "D", dMin, cMin - 0.1m),
            new(level, "F", 0m, dMin - 0.1m)
        ];
    }
}
