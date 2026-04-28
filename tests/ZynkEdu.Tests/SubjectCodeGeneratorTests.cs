using Microsoft.EntityFrameworkCore;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class SubjectCodeGeneratorTests
{
    [Fact]
    public async Task GenerateAsync_DisambiguatesPendingSubjectCodesWithinTheSameContext()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            context.Schools.Add(new School
            {
                Id = 1,
                SchoolCode = "NA",
                Name = "North Academy",
                Address = "12 Maple Avenue",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        var (taskConnection, taskContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _taskConnection = taskConnection;
        await using (taskContext)
        {
            var generator = new SubjectCodeGenerator(taskContext);

            var firstCode = await generator.GenerateAsync("Law", 1, "ZGC Level");
            taskContext.Subjects.Add(new Subject
            {
                SchoolId = 1,
                Code = firstCode,
                Name = "Law",
                GradeLevel = "ZGC Level"
            });

            var secondCode = await generator.GenerateAsync("Literature", 1, "ZGC Level");

            Assert.Equal("L", firstCode);
            Assert.Equal("L1", secondCode);
        }
    }

    [Fact]
    public async Task GenerateAsync_AllowsTheSameCodeAcrossDifferentLevels()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            context.Schools.Add(new School
            {
                Id = 1,
                SchoolCode = "NA",
                Name = "North Academy",
                Address = "12 Maple Avenue",
                CreatedAt = DateTime.UtcNow
            });

            context.Subjects.Add(new Subject
            {
                SchoolId = 1,
                Code = "M",
                Name = "Math",
                GradeLevel = "ZGC Level"
            });

            await context.SaveChangesAsync();
        }

        var (taskConnection, taskContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _taskConnection = taskConnection;
        await using (taskContext)
        {
            var generator = new SubjectCodeGenerator(taskContext);

            var oLevelCode = await generator.GenerateAsync("Math", 1, "O'Level");

            Assert.Equal("M", oLevelCode);
        }
    }

    [Fact]
    public async Task GenerateAsync_DisambiguatesPendingSchoolCodesWithinTheSameContext()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            var generator = new SchoolCodeGenerator(context);

            var firstCode = await generator.GenerateAsync("North Academy");
            context.Schools.Add(new School
            {
                Id = 1,
                SchoolCode = firstCode,
                Name = "North Academy",
                Address = "12 Maple Avenue",
                CreatedAt = DateTime.UtcNow
            });

            var secondCode = await generator.GenerateAsync("Noble Academy");

            Assert.Equal("NA", firstCode);
            Assert.Equal("N1A", secondCode);
        }
    }
}
