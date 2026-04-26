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
            new StubNotificationService());

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.CreateAsync(new CreateResultRequest(
            student.Id,
            otherSubject.Id,
            70,
            "Term 1",
            "Good effort")));
    }
}

internal sealed class StubNotificationService : INotificationService
{
    public Task<NotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken cancellationToken = default)
        => Task.FromResult(new NotificationResponse(1, 1, request.Title, request.Message, request.Type, 1, DateTime.UtcNow, Array.Empty<NotificationRecipientResponse>()));

    public Task<IReadOnlyList<NotificationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<NotificationResponse>>(Array.Empty<NotificationResponse>());
}
