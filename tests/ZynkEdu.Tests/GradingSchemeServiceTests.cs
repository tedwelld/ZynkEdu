using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class GradingSchemeServiceTests
{
    [Fact]
    public async Task SaveAsync_RejectsNonContiguousBands()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 21, UserId = 210 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        await SeedSchoolAsync(context, 21, "North Academy");

        var service = CreateService(context, currentUser);
        var request = new SaveGradingSchemeRequest(BuildCustomSchemeBands(overlapTopBand: true));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.SaveAsync(request));
        Assert.Contains("contiguous", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveAsync_RejectsReversedBandRange()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 22, UserId = 220 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        await SeedSchoolAsync(context, 22, "South Academy");

        var service = CreateService(context, currentUser);
        var bands = BuildCustomSchemeBands().ToList();
        bands[4] = bands[4] with { MinScore = 50m, MaxScore = 40m };

        var request = new SaveGradingSchemeRequest(bands);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.SaveAsync(request));
        Assert.Contains("minimum exceeds the maximum", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetAsync_RejectsTeacherAccess()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Teacher, SchoolId = 23, UserId = 230 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        await SeedSchoolAsync(context, 23, "East Academy");

        var service = CreateService(context, currentUser);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetAsync());
    }

    [Fact]
    public async Task ResolveGradeAsync_UsesTheSchoolScheme()
    {
        var adminContext = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 24, UserId = 240 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, adminContext);
        await using var _ = connection;

        await SeedSchoolAsync(context, 24, "West Academy");

        var service = CreateService(context, adminContext);
        await service.SaveAsync(new SaveGradingSchemeRequest(BuildCustomSchemeBands(customZgcTopBand: true)));

        var grade = await service.ResolveGradeAsync(24, "ZGC Level", 85m);

        Assert.Equal("B", grade);
    }

    private static GradingSchemeService CreateService(ZynkEduDbContext context, ICurrentUserContext currentUser)
        => new(context, currentUser, new StubAuditLogService());

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

    private static IReadOnlyList<SaveGradingBandRequest> BuildCustomSchemeBands(bool overlapTopBand = false, bool customZgcTopBand = false)
    {
        return [
            ..BuildBandsForLevel("ZGC Level", customZgcTopBand ? 90m : 80m, customZgcTopBand ? 80m : 70m, customZgcTopBand ? 70m : 60m, customZgcTopBand ? 60m : 50m, overlapTopBand),
            ..BuildBandsForLevel("O'Level", 80m, 70m, 60m, 50m, false),
            ..BuildBandsForLevel("A'Level", 80m, 70m, 60m, 50m, false)
        ];
    }

    private static IReadOnlyList<SaveGradingBandRequest> BuildBandsForLevel(string level, decimal aMin, decimal bMin, decimal cMin, decimal dMin, bool overlapTopBand)
    {
        return [
            new(level, "A", aMin, 100m),
            new(level, "B", bMin, overlapTopBand ? 80m : aMin - 0.1m),
            new(level, "C", cMin, bMin - 0.1m),
            new(level, "D", dMin, cMin - 0.1m),
            new(level, "F", 0m, dMin - 0.1m)
        ];
    }
}
