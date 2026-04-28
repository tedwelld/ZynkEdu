using Microsoft.EntityFrameworkCore;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class StudentNumberGeneratorTests
{
    [Fact]
    public async Task GenerateAsync_CreatesUniqueSequentialNumbers_ForConcurrentCalls()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, seedContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (seedContext)
        {
            seedContext.Schools.Add(new School { Id = 1, SchoolCode = "NA", Name = "Northview Academy", Address = "12 Maple Avenue", CreatedAt = DateTime.UtcNow });
            seedContext.StudentNumberCounters.Add(new StudentNumberCounter { SchoolId = 1, LastNumber = 0 });
            await seedContext.SaveChangesAsync();
        }

        var tasks = Enumerable.Range(0, 5).Select(async _ =>
        {
            var (taskConnection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
            await using var _taskConnection = taskConnection;
            await using var _taskContext = context;
            var generator = new StudentNumberGenerator(context, new SchoolCodeGenerator(context));
            return await generator.GenerateAsync(1);
        });

        var numbers = await Task.WhenAll(tasks);

        Assert.Equal(5, numbers.Distinct().Count());
        Assert.Contains("NA-0001", numbers);
        Assert.Contains("NA-0005", numbers);
    }

    [Fact]
    public async Task GenerateAsync_DisambiguatesSchoolsWithMatchingInitials()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, seedContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (seedContext)
        {
            var codeGenerator = new SchoolCodeGenerator(seedContext);
            var firstCode = await codeGenerator.GenerateAsync("North Academy");
            seedContext.Schools.Add(new School { Id = 1, SchoolCode = firstCode, Name = "North Academy", Address = "12 Maple Avenue", CreatedAt = DateTime.UtcNow });
            await seedContext.SaveChangesAsync();

            var secondCode = await codeGenerator.GenerateAsync("Noble Academy");
            seedContext.Schools.Add(new School { Id = 2, SchoolCode = secondCode, Name = "Noble Academy", Address = "24 Oak Road", CreatedAt = DateTime.UtcNow });
            await seedContext.SaveChangesAsync();
        }

        var (taskConnection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _taskConnection = taskConnection;
        await using var _taskContext = context;
        var generator = new StudentNumberGenerator(context, new SchoolCodeGenerator(context));

        var firstNumber = await generator.GenerateAsync(1);
        var secondNumber = await generator.GenerateAsync(2);

        Assert.Equal("NA-0001", firstNumber);
        Assert.Equal("N1A-0001", secondNumber);
    }
}
