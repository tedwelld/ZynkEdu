using Microsoft.AspNetCore.Identity;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class TeacherAssignmentServiceTests
{
    [Fact]
    public async Task CreateAsync_RejectsDuplicateTeacherAssignment()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 3, UserId = 33, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher1",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 3,
            DisplayName = "Teacher One",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 3,
            Code = "MATH1",
            Name = "Math",
            GradeLevel = "ZGC Level"
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentRequest(teacher.Id, subject.Id, "Form 1A");

        await service.CreateAsync(request);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(request));
        Assert.Equal("This teacher assignment already exists.", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_RejectsSubjectLevelMismatch()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 4, UserId = 44, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher2",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 4,
            DisplayName = "Teacher Two",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 4,
            Code = "BIO1",
            Name = "Biology",
            GradeLevel = "O'Level"
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateTeacherAssignmentRequest(teacher.Id, subject.Id, "Form 1A")));

        Assert.Contains("does not match the selected class level", ex.Message);
    }

    [Fact]
    public async Task UpdateAsync_RejectsSubjectLevelMismatch()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 5, UserId = 55, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher3",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 5,
            DisplayName = "Teacher Three",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var primarySubject = new Subject
        {
            SchoolId = 5,
            Code = "ENG1",
            Name = "English",
            GradeLevel = "ZGC Level"
        };

        var mismatchedSubject = new Subject
        {
            SchoolId = 5,
            Code = "CHE1",
            Name = "Chemistry",
            GradeLevel = "A'Level"
        };

        context.Users.Add(teacher);
        context.Subjects.AddRange(primarySubject, mismatchedSubject);
        await context.SaveChangesAsync();

        var assignment = new TeacherAssignment
        {
            SchoolId = 5,
            TeacherId = teacher.Id,
            SubjectId = primarySubject.Id,
            Class = "Form 1A"
        };
        context.TeacherAssignments.Add(assignment);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateAsync(assignment.Id, new UpdateTeacherAssignmentRequest(teacher.Id, mismatchedSubject.Id, "Form 1A")));

        Assert.Contains("does not match the selected class level", ex.Message);
    }

    [Fact]
    public async Task CreateBatchAsync_RejectsSubjectLevelMismatch()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 6, UserId = 66, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher4",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 6,
            DisplayName = "Teacher Four",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 6,
            Code = "ART1",
            Name = "Art",
            GradeLevel = "A'Level"
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentsBatchRequest(teacher.Id, new[] { subject.Id }, new[] { "Form 1A", "Form 1B" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateBatchAsync(request));
        Assert.Contains("does not match the selected class level", ex.Message);
    }

    [Fact]
    public async Task CreateBatchAsync_RejectsMixedLevelClasses()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 7, UserId = 77, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher5",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 7,
            DisplayName = "Teacher Five",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 7,
            Code = "MUS1",
            Name = "Music",
            GradeLevel = "General"
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentsBatchRequest(teacher.Id, new[] { subject.Id }, new[] { "Form 1A", "Form 3A Sciences" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateBatchAsync(request));
        Assert.Contains("same level", ex.Message);
    }
}
