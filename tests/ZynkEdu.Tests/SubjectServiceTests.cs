using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class SubjectServiceTests
{
    [Fact]
    public async Task CreateAsync_ReturnsAndPersistsTheSelectedLevel()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 11, UserId = 110, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 11,
            SchoolCode = "NA",
            Name = "North Academy",
            Address = "12 Maple Avenue",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);
            var response = await service.CreateAsync(new CreateSubjectRequest("Mathematics", null, "O'Level"));

            Assert.Equal("O'Level", response.GradeLevel);

            var stored = await queryContext.Subjects.AsNoTracking().SingleAsync(x => x.Id == response.Id);
            Assert.Equal("O'Level", stored.GradeLevel);
        }
    }

    [Fact]
    public async Task CreateAsync_AllowsTheSameSubjectNameAcrossDifferentLevels()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 12, UserId = 120, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 12,
            SchoolCode = "LA",
            Name = "Lake Academy",
            Address = "45 Lake Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var first = await service.CreateAsync(new CreateSubjectRequest("Mathematics", null, "ZGC Level"));
            var second = await service.CreateAsync(new CreateSubjectRequest("Mathematics", null, "A'Level"));

            Assert.Equal("ZGC Level", first.GradeLevel);
            Assert.Equal("A'Level", second.GradeLevel);
            Assert.Equal("M", first.Code);
            Assert.Equal("M", second.Code);

            var subjects = await queryContext.Subjects.AsNoTracking().Where(x => x.SchoolId == 12 && x.Name == "Mathematics").ToListAsync();
            Assert.Equal(2, subjects.Count);
        }
    }

    [Fact]
    public async Task UpdateAsync_ReturnsTheUpdatedLevel()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 13, UserId = 130, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 13,
            SchoolCode = "QA",
            Name = "Queens Academy",
            Address = "88 Queens Street",
            CreatedAt = DateTime.UtcNow
        });
        context.Subjects.Add(new Subject
        {
            SchoolId = 13,
            Code = "PHY",
            Name = "Physics",
            GradeLevel = "ZGC Level"
        });
        await context.SaveChangesAsync();

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);
            var response = await service.UpdateAsync(1, new UpdateSubjectRequest("Physics", null, "O'Level"));

            Assert.Equal("O'Level", response.GradeLevel);
        }
    }

    private static SubjectService CreateService(ZynkEduDbContext context, ICurrentUserContext currentUser)
    {
        var generator = new SubjectCodeGenerator(context);
        return new SubjectService(context, currentUser, generator, new NoOpAuditLogService());
    }
}
