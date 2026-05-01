using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class ResultAuthorizationTests
{
    [Fact]
    public async Task CreateAsync_RejectsTeacherWhoIsNotAssignedToTheClass()
    {
        var adminContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, adminContext);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher1",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 1,
            DisplayName = "Teacher One",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject { SchoolId = 1, Name = "Math" };
        var otherSubject = new Subject { SchoolId = 1, Name = "Science" };
        var student = new Student
        {
            SchoolId = 1,
            StudentNumber = "SCH001-0001",
            FullName = "John Doe",
            Class = "Grade 1",
            ParentEmail = "parent@example.com",
            ParentPhone = "2777000000",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.AddRange(subject, otherSubject);
        context.Students.Add(student);
        await context.SaveChangesAsync();

        context.Guardians.Add(new Guardian
        {
            SchoolId = 1,
            StudentId = student.Id,
            DisplayName = "Parent One",
            Relationship = "Guardian",
            ParentEmail = "parent@example.com",
            ParentPhone = "2777000000",
            IsPrimary = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        context.TeacherAssignments.Add(new TeacherAssignment
        {
            SchoolId = 1,
            TeacherId = teacher.Id,
            SubjectId = subject.Id,
            Class = "Grade 2"
        });
        await context.SaveChangesAsync();

        var teacherContext = new TestCurrentUserContext { Role = UserRole.Teacher, SchoolId = 1, UserId = teacher.Id };
        var (teacherConnection, teacherDb) = await TestDatabase.CreateContextAsync(databasePath, teacherContext);
        await using var _teacherConnection = teacherConnection;
        await using var _teacherDb = teacherDb;
        var service = new ResultService(
            teacherDb,
            teacherContext,
            new StubNotificationService(),
            new StubAuditLogService(),
            new RecordingEmailSender(),
            new RecordingSmsSender(),
            new ReportEmailTemplateService(),
            new StubGradingSchemeService());

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.CreateAsync(new CreateResultRequest(
            student.Id,
            otherSubject.Id,
            70,
            "Term 1",
            "Good effort")));
    }

    [Fact]
    public async Task SendSlipAsync_UsesTheSelectedStudentsGuardianContact()
    {
        var adminContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, adminContext);
        await using var _ = connection;

        var student = new Student
        {
            SchoolId = 1,
            StudentNumber = "SCH001-0001",
            FullName = "Amunike Junior",
            Class = "Form 1A",
            Level = "ZGC Level",
            ParentEmail = "legacy-parent@example.com",
            ParentPhone = "2777000999",
            CreatedAt = DateTime.UtcNow
        };

        context.Students.Add(student);
        await context.SaveChangesAsync();

        context.Guardians.Add(new Guardian
        {
            SchoolId = 1,
            StudentId = student.Id,
            DisplayName = "Amunike Guardian",
            Relationship = "Mother",
            ParentEmail = "guardian@example.com",
            ParentPhone = "2777000001",
            IsPrimary = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        context.Guardians.Add(new Guardian
        {
            SchoolId = 1,
            StudentId = student.Id,
            DisplayName = "Amunike Secondary Guardian",
            Relationship = "Father",
            ParentEmail = "secondary@example.com",
            ParentPhone = "2777000002",
            IsPrimary = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var emailSender = new RecordingEmailSender();
        var smsSender = new RecordingSmsSender();
        var service = new ResultService(
            context,
            adminContext,
            new StubNotificationService(),
            new StubAuditLogService(),
            emailSender,
            smsSender,
            new ReportEmailTemplateService(),
            new StubGradingSchemeService());

        var slipBytes = new byte[] { 1, 2, 3, 4 };
        var response = await service.SendSlipAsync(student.Id, new SendResultSlipRequest(true, true), slipBytes, "student-slip.pdf", null);

        Assert.True(response.EmailSent);
        Assert.True(response.SmsSent);
        Assert.Single(emailSender.Messages);
        Assert.Equal("guardian@example.com", emailSender.Messages[0].Destination);
        Assert.NotNull(emailSender.Messages[0].HtmlMessage);
        Assert.Equal("student-slip.pdf", emailSender.Messages[0].AttachmentFileName);
        Assert.Equal(slipBytes, emailSender.Messages[0].AttachmentBytes);
        Assert.Single(smsSender.Messages);
        Assert.Equal("2777000001", smsSender.Messages[0].Destination);
    }

    [Fact]
    public async Task SendSlipAsync_FiltersSubjectsToTheStudentsLevelOnly()
    {
        var adminContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, adminContext);
        await using var _ = connection;

        var math = new Subject { SchoolId = 1, Name = "Math", GradeLevel = "ZGC Level" };
        var science = new Subject { SchoolId = 1, Name = "Science", GradeLevel = "ZGC Level" };
        var accounting = new Subject { SchoolId = 1, Name = "Accounting", GradeLevel = "O'Level" };
        var teacher = new AppUser
        {
            Username = "amunike.teacher",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 1,
            DisplayName = "Amunike Teacher",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = new PasswordHasher<AppUser>().HashPassword(teacher, "Password123!");
        var student = new Student
        {
            SchoolId = 1,
            StudentNumber = "SCH001-0002",
            FullName = "Amunike Junior",
            Class = "Form 1A",
            Level = "ZGC Level",
            ParentEmail = "guardian@example.com",
            ParentPhone = "2777000001",
            CreatedAt = DateTime.UtcNow
        };

        context.Subjects.AddRange(math, science, accounting);
        context.Users.Add(teacher);
        context.Students.Add(student);
        await context.SaveChangesAsync();

        context.Guardians.Add(new Guardian
        {
            SchoolId = 1,
            StudentId = student.Id,
            DisplayName = "Amunike Guardian",
            Relationship = "Guardian",
            ParentEmail = "guardian@example.com",
            ParentPhone = "2777000001",
            IsPrimary = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });

        context.StudentSubjectEnrollments.AddRange(
            new StudentSubjectEnrollment { SchoolId = 1, StudentId = student.Id, SubjectId = math.Id },
            new StudentSubjectEnrollment { SchoolId = 1, StudentId = student.Id, SubjectId = science.Id },
            new StudentSubjectEnrollment { SchoolId = 1, StudentId = student.Id, SubjectId = accounting.Id });

        context.Results.AddRange(
            new Result
            {
                SchoolId = 1,
                StudentId = student.Id,
                SubjectId = math.Id,
                TeacherId = teacher.Id,
                Score = 84,
                Grade = "A",
                Term = "Term 1",
                Comment = "Excellent",
                ApprovalStatus = "Approved",
                IsLocked = true,
                CreatedAt = DateTime.UtcNow
            },
            new Result
            {
                SchoolId = 1,
                StudentId = student.Id,
                SubjectId = accounting.Id,
                TeacherId = teacher.Id,
                Score = 72,
                Grade = "B",
                Term = "Term 1",
                Comment = "Good",
                ApprovalStatus = "Approved",
                IsLocked = true,
                CreatedAt = DateTime.UtcNow
            });

        await context.SaveChangesAsync();

        var emailSender = new RecordingEmailSender();
        var smsSender = new RecordingSmsSender();
        var service = new ResultService(
            context,
            adminContext,
            new StubNotificationService(),
            new StubAuditLogService(),
            emailSender,
            smsSender,
            new ReportEmailTemplateService(),
            new StubGradingSchemeService());

        var slipBytes = new byte[] { 1, 2, 3, 4 };
        var response = await service.SendSlipAsync(student.Id, new SendResultSlipRequest(true, false), slipBytes, "student-slip.pdf", null);

        Assert.True(response.EmailSent);
        Assert.Single(emailSender.Messages);
        Assert.Contains("Math", emailSender.Messages[0].HtmlMessage);
        Assert.Contains("Science", emailSender.Messages[0].HtmlMessage);
        Assert.DoesNotContain("Accounting", emailSender.Messages[0].HtmlMessage);
    }
}

internal sealed class StubNotificationService : INotificationService
{
    public Task<NotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken cancellationToken = default)
        => Task.FromResult(new NotificationResponse(1, 1, request.Title, request.Message, request.Type, 1, DateTime.UtcNow, Array.Empty<NotificationRecipientResponse>()));

    public Task<IReadOnlyList<NotificationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<NotificationResponse>>(Array.Empty<NotificationResponse>());
}

internal sealed class StubAuditLogService : IAuditLogService
{
    public Task LogAsync(int? schoolId, string action, string entityType, string entityId, string summary, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task LogAsync(int? schoolId, string action, string entityType, string entityId, string summary, string? oldValue = null, string? newValue = null, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<IReadOnlyList<AuditLogResponse>> GetRecentAsync(int? schoolId = null, int take = 10, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<AuditLogResponse>>(Array.Empty<AuditLogResponse>());
}

internal sealed class StubGradingSchemeService : IGradingSchemeService
{
    public Task EnsureDefaultsAsync(int schoolId, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<GradingSchemeResponse> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(new GradingSchemeResponse(schoolId ?? 1, "Test School", Array.Empty<GradingLevelResponse>()));

    public Task<string> ResolveGradeAsync(int schoolId, string level, decimal score, CancellationToken cancellationToken = default)
        => Task.FromResult(score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F");

    public Task<GradingSchemeResponse> SaveAsync(SaveGradingSchemeRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
        => Task.FromResult(new GradingSchemeResponse(schoolId ?? 1, "Test School", Array.Empty<GradingLevelResponse>()));
}
