using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class PlatformSubjectCatalogServiceTests
{
    [Fact]
    public async Task CreateAsync_PersistsTheCatalogSubject()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var service = CreateService(context);
        var response = await service.CreateAsync(new CreateSubjectRequest("Mathematics", null, "O'Level", 1, true));

        Assert.Equal("Mathematics", response.Name);
        Assert.Equal("O'Level", response.GradeLevel);
        Assert.True(response.IsPractical);

        var stored = await context.PlatformSubjectCatalogs.AsNoTracking().SingleAsync(x => x.Id == response.Id);
        Assert.Equal("Mathematics", stored.Name);
        Assert.Equal("O'Level", stored.GradeLevel);
        Assert.True(stored.IsPractical);
    }

    [Fact]
    public async Task UpdateAndDeleteAsync_ManageCatalogSubjects()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var service = CreateService(context);
        var created = await service.CreateAsync(new CreateSubjectRequest("Biology", "BIO1", "ZGC Level", 1, true));

        var updated = await service.UpdateAsync(created.Id, new UpdateSubjectRequest("Advanced Biology", null, "A'Level", 1, true));
        Assert.Equal("Advanced Biology", updated.Name);
        Assert.Equal("A'Level", updated.GradeLevel);
        Assert.True(updated.IsPractical);

        await service.DeleteAsync(updated.Id);

        Assert.Empty(await context.PlatformSubjectCatalogs.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task ImportFromSchoolToCatalogAsync_SkipsDuplicatesAndKeepsTheGradeLevel()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 2, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.AddRange(
            new School { Id = 20, SchoolCode = "SRC", Name = "Source School", Address = "1 Source St", CreatedAt = DateTime.UtcNow },
            new School { Id = 21, SchoolCode = "DST", Name = "Target School", Address = "2 Target St", CreatedAt = DateTime.UtcNow });
        context.Subjects.AddRange(
            new Subject { SchoolId = 20, Code = "MATH1", Name = "Mathematics", GradeLevel = "ZGC Level", IsPractical = true },
            new Subject { SchoolId = 20, Code = "SCI1", Name = "Science", GradeLevel = "O'Level", IsPractical = true });
        context.PlatformSubjectCatalogs.Add(new PlatformSubjectCatalog
        {
            Code = "MATH1",
            Name = "Mathematics",
            GradeLevel = "ZGC Level"
        });
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await service.ImportFromSchoolToCatalogAsync(new ImportSchoolSubjectsRequest(20, new[] { 1, 2 }));

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(1, result.SkippedCount);

        var catalog = await context.PlatformSubjectCatalogs.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        Assert.Equal(2, catalog.Count);
        var imported = catalog.Single(x => x.Name == "Science");
        Assert.Equal("O'Level", imported.GradeLevel);
        Assert.Equal("SCI1", imported.Code);
        Assert.True(imported.IsPractical);
    }

    [Fact]
    public async Task ImportFromSchoolToSchoolAsync_PreservesCodeAndGradeLevel()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 3, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.AddRange(
            new School { Id = 30, SchoolCode = "SRC", Name = "Source School", Address = "1 Source St", CreatedAt = DateTime.UtcNow },
            new School { Id = 31, SchoolCode = "DST", Name = "Target School", Address = "2 Target St", CreatedAt = DateTime.UtcNow });
        context.Subjects.Add(new Subject
        {
            SchoolId = 30,
            Code = "PHY1",
            Name = "Physics",
            GradeLevel = "A'Level",
            IsPractical = true
        });
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await service.ImportFromSchoolToSchoolAsync(31, new ImportSchoolSubjectsRequest(30, new[] { 1 }));

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(0, result.SkippedCount);

        var imported = await context.Subjects.AsNoTracking().SingleAsync(x => x.SchoolId == 31);
        Assert.Equal("PHY1", imported.Code);
        Assert.Equal("Physics", imported.Name);
        Assert.Equal("A'Level", imported.GradeLevel);
        Assert.True(imported.IsPractical);
    }

    [Fact]
    public async Task PublishAllCatalogToSchoolAsync_SkipsExistingMatches()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 4, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.AddRange(
            new School { Id = 40, SchoolCode = "SRC", Name = "Source School", Address = "1 Source St", CreatedAt = DateTime.UtcNow },
            new School { Id = 41, SchoolCode = "DST", Name = "Target School", Address = "2 Target St", CreatedAt = DateTime.UtcNow });
        context.PlatformSubjectCatalogs.AddRange(
            new PlatformSubjectCatalog { Code = "MATH1", Name = "Mathematics", GradeLevel = "ZGC Level", IsPractical = true },
            new PlatformSubjectCatalog { Code = "ENG1", Name = "English", GradeLevel = "O'Level", IsPractical = true });
        context.Subjects.Add(new Subject
        {
            SchoolId = 41,
            Code = "MATHX",
            Name = "Mathematics",
            GradeLevel = "ZGC Level"
        });
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await service.PublishAllCatalogToSchoolAsync(41);

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(1, result.SkippedCount);

        var imported = await context.Subjects.AsNoTracking().SingleAsync(x => x.SchoolId == 41 && x.Name == "English");
        Assert.Equal("O'Level", imported.GradeLevel);
        Assert.Equal("ENG1", imported.Code);
        Assert.True(imported.IsPractical);
    }

    private static PlatformSubjectCatalogService CreateService(ZynkEduDbContext context)
    {
        var generator = new SubjectCodeGenerator(context);
        return new PlatformSubjectCatalogService(context, generator, new NoOpAuditLogService());
    }
}
