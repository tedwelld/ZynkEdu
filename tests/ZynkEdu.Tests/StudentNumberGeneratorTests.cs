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
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, seedContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (seedContext)
        {
            seedContext.StudentNumberCounters.Add(new StudentNumberCounter { SchoolId = 1, LastNumber = 0 });
            await seedContext.SaveChangesAsync();
        }

        var tasks = Enumerable.Range(0, 5).Select(async _ =>
        {
            var (taskConnection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
            await using var _taskConnection = taskConnection;
            await using var _taskContext = context;
            var generator = new StudentNumberGenerator(context);
            return await generator.GenerateAsync(1);
        });

        var numbers = await Task.WhenAll(tasks);

        Assert.Equal(5, numbers.Distinct().Count());
        Assert.Contains("SCH001-0001", numbers);
        Assert.Contains("SCH001-0005", numbers);
    }
}
