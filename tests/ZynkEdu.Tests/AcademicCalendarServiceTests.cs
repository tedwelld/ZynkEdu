using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class AcademicCalendarServiceTests
{
    [Fact]
    public async Task UpsertTermAsync_AllowsNonOverlappingTermsInTheSameSchool()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 11, UserId = 11, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 11,
            SchoolCode = "CA",
            Name = "Calendar Academy",
            Address = "1 School Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new AcademicCalendarService(context, currentUser);
        await service.UpsertTermAsync(1, new UpsertAcademicTermRequest("Term 1", new DateOnly(2026, 1, 10), new DateOnly(2026, 4, 10)));
        var termTwo = await service.UpsertTermAsync(2, new UpsertAcademicTermRequest("Term 2", new DateOnly(2026, 5, 1), new DateOnly(2026, 8, 1)));

        Assert.Equal(new DateOnly(2026, 5, 1), termTwo.StartDate);
        Assert.Equal(new DateOnly(2026, 8, 1), termTwo.EndDate);
    }

    [Fact]
    public async Task UpsertTermAsync_RejectsOverlappingTermRanges()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 12, UserId = 12, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 12,
            SchoolCode = "OA",
            Name = "Overlap Academy",
            Address = "2 School Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new AcademicCalendarService(context, currentUser);
        await service.UpsertTermAsync(1, new UpsertAcademicTermRequest("Term 1", new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 30)));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UpsertTermAsync(2, new UpsertAcademicTermRequest("Term 2", new DateOnly(2026, 4, 30), new DateOnly(2026, 8, 31))));

        Assert.Contains("overlap another term", ex.Message);
    }

    [Fact]
    public async Task UpsertTermAsync_UsesSchoolSpecificValidation()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 13, UserId = 13, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.AddRange(
            new School
            {
                Id = 13,
                SchoolCode = "S1",
                Name = "School One",
                Address = "3 School Road",
                CreatedAt = DateTime.UtcNow
            },
            new School
            {
                Id = 14,
                SchoolCode = "S2",
                Name = "School Two",
                Address = "4 School Road",
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new AcademicCalendarService(context, currentUser);
        await service.UpsertTermAsync(1, new UpsertAcademicTermRequest("Term 1", new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 30)));

        var otherSchoolContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 14, UserId = 14, UserName = "other.admin" };
        var (otherConnection, otherDb) = await TestDatabase.CreateContextAsync(databasePath, otherSchoolContext);
        await using var _otherConnection = otherConnection;
        var otherService = new AcademicCalendarService(otherDb, otherSchoolContext);

        var term = await otherService.UpsertTermAsync(1, new UpsertAcademicTermRequest("Term 1", new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 30)));

        Assert.Equal(14, term.SchoolId);
    }
}
