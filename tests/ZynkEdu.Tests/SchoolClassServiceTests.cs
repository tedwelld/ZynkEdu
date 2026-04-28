using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class SchoolClassServiceTests
{
    [Fact]
    public async Task CreateAsync_StoresClassInSelectedSchool_ForPlatformAdmin()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 1,
            SchoolCode = "NA",
            Name = "North Academy",
            Address = "12 Example Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = CreateService(context, currentUser);
        var result = await service.CreateAsync(new CreateSchoolClassRequest("Form 1A", "ZGC Level"), 1);

        Assert.Equal(1, result.SchoolId);
        Assert.Equal("Form 1A", result.ClassName);
        Assert.Equal("ZGC Level", result.GradeLevel);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task CreateAsync_RejectsUnsupportedLevel()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 2, UserId = 2, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 2,
            SchoolCode = "LA",
            Name = "Lake Academy",
            Address = "24 Example Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = CreateService(context, currentUser);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateSchoolClassRequest("Form 1A", "General")));

        Assert.Contains("supported levels", ex.Message);
    }

    [Fact]
    public async Task AssignSubjectsAsync_RejectsCrossLevelSubjects()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 3, UserId = 3, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var schoolClass = new SchoolClass
        {
            SchoolId = 3,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var subject = new Subject
        {
            SchoolId = 3,
            Code = "BIO1",
            Name = "Biology",
            GradeLevel = "O'Level"
        };

        context.Schools.Add(new School
        {
            Id = 3,
            SchoolCode = "SA",
            Name = "South Academy",
            Address = "33 Example Road",
            CreatedAt = DateTime.UtcNow
        });
        context.SchoolClasses.Add(schoolClass);
        context.Subjects.Add(subject);
        await context.SaveChangesAsync();

        var service = CreateService(context, currentUser);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.AssignSubjectsAsync(schoolClass.Id, new AssignClassSubjectsRequest(new[] { subject.Id }), 3));

        Assert.Contains("does not match the class level", ex.Message);
    }

    [Fact]
    public async Task DeleteAsync_DeactivatesClass()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 4, UserId = 4, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var schoolClass = new SchoolClass
        {
            SchoolId = 4,
            Name = "Form 2A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();

        var service = CreateService(context, currentUser);
        await service.DeleteAsync(schoolClass.Id);

        var updated = await context.SchoolClasses.AsNoTracking().FirstAsync(x => x.Id == schoolClass.Id);
        Assert.False(updated.IsActive);
    }

    private static SchoolClassService CreateService(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, TestCurrentUserContext currentUser)
        => new(context, currentUser, new NoOpAuditLogService());
}
