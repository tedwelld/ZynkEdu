using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System.Threading;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class StudentLifecycleServiceTests
{
    [Fact]
    public async Task MoveAsync_Transfer_CreatesDestinationPlacementAndArchivesSource()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            await SeedSchoolAsync(context, 1, "NA", "North Academy", ("Form 2A", "ZGC Level"));
            await SeedSchoolAsync(context, 2, "LA", "Lake Academy", ("Form 3A Sciences", "O'Level"));

            var student = new Student
            {
                SchoolId = 1,
                StudentNumber = "NA-0001",
                FullName = "Aminata Transfer",
                Class = "Form 2A",
                Level = "ZGC Level",
                Status = "Active",
                EnrollmentYear = 2026,
                ParentEmail = "aminata@example.com",
                ParentPhone = "+263770000001",
                ParentPasswordHash = "hash",
                CreatedAt = DateTime.UtcNow
            };
            context.Students.Add(student);
            await context.SaveChangesAsync();

            var service = CreateLifecycleService(context, currentUser);
            var response = await service.MoveAsync(new StudentMovementRequest(
                student.Id,
                "Transfer",
                2,
                "Form 3A Sciences",
                "O'Level",
                "Family relocation",
                "Transferred to another school",
                DateTime.UtcNow.Date,
                false),
                1);

            Assert.Equal("Transfer", response.Action);
            Assert.NotNull(response.DestinationStudentId);

            var source = await context.Students.AsNoTracking().SingleAsync(x => x.Id == student.Id);
            var destination = await context.Students.AsNoTracking().SingleAsync(x => x.Id == response.DestinationStudentId);
            var movement = await context.StudentMovements.AsNoTracking().SingleAsync(x => x.Id == response.MovementId);

            Assert.Equal("TransferredOut", source.Status);
            Assert.False(string.IsNullOrWhiteSpace(source.ProfileKey));
            Assert.Equal(source.ProfileKey, destination.ProfileKey);
            Assert.Equal(2, destination.SchoolId);
            Assert.Equal("Form 3A Sciences", destination.Class);
            Assert.Equal("Active", destination.Status);
            Assert.Equal("Transfer", movement.Action);
            Assert.Equal(student.Id, movement.SourceStudentId);
            Assert.Equal(destination.Id, movement.DestinationStudentId);
            Assert.Equal(1, movement.SourceSchoolId);
            Assert.Equal(2, movement.DestinationSchoolId);
        }
    }

    [Fact]
    public async Task CommitPromotionRunAsync_PromotesReshufflesAndReAdmitsWithinSchool()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            await SeedSchoolAsync(
                context,
                1,
                "NA",
                "North Academy",
                ("Form 1A", "ZGC Level"),
                ("Form 2A", "ZGC Level"),
                ("Form 3A Sciences", "O'Level"),
                ("Form 3B Commercials", "O'Level"),
                ("Form 4A Sciences", "O'Level"),
                ("Form 5A Arts", "A'Level"),
                ("Form 6A Arts", "A'Level"));

            var promoteStudent = new Student
            {
                SchoolId = 1,
                StudentNumber = "NA-0001",
                FullName = "Bright Promote",
                Class = "Form 1A",
                Level = "ZGC Level",
                Status = "Active",
                EnrollmentYear = 2026,
                ParentEmail = "bright@example.com",
                ParentPhone = "+263770000011",
                ParentPasswordHash = "hash",
                CreatedAt = DateTime.UtcNow
            };

            var reshuffleStudent = new Student
            {
                SchoolId = 1,
                StudentNumber = "NA-0002",
                FullName = "Chipo Reshuffle",
                Class = "Form 3A Sciences",
                Level = "O'Level",
                Status = "Active",
                EnrollmentYear = 2026,
                ParentEmail = "chipo@example.com",
                ParentPhone = "+263770000012",
                ParentPasswordHash = "hash",
                CreatedAt = DateTime.UtcNow
            };

            var readmitStudent = new Student
            {
                SchoolId = 1,
                StudentNumber = "NA-0003",
                FullName = "Dumisani Return",
                Class = "Form 4A Sciences",
                Level = "O'Level",
                Status = "Exited",
                EnrollmentYear = 2025,
                ParentEmail = "dumisani@example.com",
                ParentPhone = "+263770000013",
                ParentPasswordHash = "hash",
                CreatedAt = DateTime.UtcNow
            };

            context.Students.AddRange(promoteStudent, reshuffleStudent, readmitStudent);
            await context.SaveChangesAsync();

            var service = CreateLifecycleService(context, currentUser);
            var response = await service.CommitPromotionRunAsync(new StudentPromotionRunRequest(
                "2026 / 2027",
                "Year end progression",
                new[]
                {
                    new StudentMovementRequest(promoteStudent.Id, "Promote", null, "Form 2A", "ZGC Level", null, null, DateTime.UtcNow.Date),
                    new StudentMovementRequest(reshuffleStudent.Id, "Reshuffle", null, "Form 3B Commercials", "O'Level", null, null, DateTime.UtcNow.Date),
                    new StudentMovementRequest(readmitStudent.Id, "ReAdmit", null, "Form 5A Arts", "A'Level", "Readmitted for A-Level", null, DateTime.UtcNow.Date)
                }));

            Assert.Equal("Committed", response.Status);
            Assert.Equal(3, response.Movements.Count);

            var promotedSource = await context.Students.AsNoTracking().SingleAsync(x => x.Id == promoteStudent.Id);
            var reshuffledSource = await context.Students.AsNoTracking().SingleAsync(x => x.Id == reshuffleStudent.Id);
            var readmitSource = await context.Students.AsNoTracking().SingleAsync(x => x.Id == readmitStudent.Id);
            var activePlacements = await context.Students.AsNoTracking().Where(x => x.SchoolId == 1 && x.Status == "Active").ToListAsync();

            Assert.Equal("Promoted", promotedSource.Status);
            Assert.Equal("Reshuffled", reshuffledSource.Status);
            Assert.Equal("Exited", readmitSource.Status);
            Assert.Equal(3, activePlacements.Count);
            Assert.Contains(activePlacements, x => x.Class == "Form 2A" && x.ProfileKey == promotedSource.ProfileKey);
            Assert.Contains(activePlacements, x => x.Class == "Form 3B Commercials" && x.ProfileKey == reshuffledSource.ProfileKey);
            Assert.Contains(activePlacements, x => x.Class == "Form 5A Arts" && x.ProfileKey == readmitSource.ProfileKey);

            var studentService = new StudentService(
                context,
                currentUser,
                new StubStudentNumberGenerator(),
                new AuditLogService(context, currentUser, NullLogger<AuditLogService>.Instance));

            var visibleStudents = await studentService.GetAllAsync();
            var allStudents = await studentService.GetAllAsync(includeInactive: true);

            Assert.Equal(3, visibleStudents.Count);
            Assert.Equal(6, allStudents.Count);
        }
    }

    [Fact]
    public async Task MoveAsync_RejectsCrossSchoolTransferForSchoolAdmin()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            await SeedSchoolAsync(context, 1, "NA", "North Academy", ("Form 2A", "ZGC Level"));
            await SeedSchoolAsync(context, 2, "LA", "Lake Academy", ("Form 3A Sciences", "O'Level"));

            var student = new Student
            {
                SchoolId = 1,
                StudentNumber = "NA-0001",
                FullName = "Elias Guarded",
                Class = "Form 2A",
                Level = "ZGC Level",
                Status = "Active",
                EnrollmentYear = 2026,
                ParentEmail = "elias@example.com",
                ParentPhone = "+263770000021",
                ParentPasswordHash = "hash",
                CreatedAt = DateTime.UtcNow
            };
            context.Students.Add(student);
            await context.SaveChangesAsync();

            var service = CreateLifecycleService(context, currentUser);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.MoveAsync(new StudentMovementRequest(
                student.Id,
                "Transfer",
                2,
                "Form 3A Sciences",
                "O'Level",
                null,
                null,
                DateTime.UtcNow.Date,
                false)));
        }
    }

    private static StudentLifecycleService CreateLifecycleService(ZynkEduDbContext context, ICurrentUserContext currentUser)
    {
        return new StudentLifecycleService(context, currentUser, new StubStudentNumberGenerator(), new NoOpAuditLogService());
    }

    private static async Task SeedSchoolAsync(ZynkEduDbContext context, int schoolId, string schoolCode, string schoolName, params (string Name, string GradeLevel)[] classes)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = schoolCode,
            Name = schoolName,
            Address = "12 Example Road",
            CreatedAt = DateTime.UtcNow
        });

        foreach (var (name, gradeLevel) in classes)
        {
            context.SchoolClasses.Add(new SchoolClass
            {
                SchoolId = schoolId,
                Name = name,
                GradeLevel = gradeLevel,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync();
    }

    private sealed class StubStudentNumberGenerator : IStudentNumberGenerator
    {
        private int _counter;

        public Task<string> GenerateAsync(int schoolId, CancellationToken cancellationToken = default)
        {
            var next = Interlocked.Increment(ref _counter);
            return Task.FromResult($"SCH-{schoolId:000}-{next:0000}");
        }
    }
}
