using Microsoft.EntityFrameworkCore;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class AttendanceServiceTests
{
    [Fact]
    public async Task GetDailySummariesAsync_ReturnsGlobalSummaries_ForPlatformAdminWithoutSchoolScope()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1 };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            var termOne = new AcademicTerm
            {
                SchoolId = 1,
                TermNumber = 1,
                Name = "Term 1",
                CreatedAt = DateTime.UtcNow
            };
            var termTwo = new AcademicTerm
            {
                SchoolId = 2,
                TermNumber = 1,
                Name = "Term 1",
                CreatedAt = DateTime.UtcNow
            };

            var teacherOne = new AppUser
            {
                Username = "teacher.one",
                PasswordHash = "hash",
                DisplayName = "Teacher One",
                Role = UserRole.Teacher,
                SchoolId = 1,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            var teacherTwo = new AppUser
            {
                Username = "teacher.two",
                PasswordHash = "hash",
                DisplayName = "Teacher Two",
                Role = UserRole.Teacher,
                SchoolId = 2,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            context.Schools.AddRange(
                new School { Id = 1, SchoolCode = "NA", Name = "North Academy", Address = "12 Maple Avenue", CreatedAt = DateTime.UtcNow },
                new School { Id = 2, SchoolCode = "LA", Name = "Lake Academy", Address = "24 Oak Road", CreatedAt = DateTime.UtcNow });
            context.Users.AddRange(teacherOne, teacherTwo);
            await context.SaveChangesAsync();

            context.AcademicTerms.AddRange(termOne, termTwo);
            context.Students.AddRange(
                new Student
                {
                    SchoolId = 1,
                    StudentNumber = "NA-0001",
                    FullName = "Alice North",
                    Class = "Form 1A",
                    Level = "ZGC Level",
                    Status = "Active",
                    ParentEmail = "alice.north@example.com",
                    ParentPhone = "+263770100001",
                    ParentPasswordHash = "hash",
                    CreatedAt = DateTime.UtcNow
                },
                new Student
                {
                    SchoolId = 2,
                    StudentNumber = "LA-0001",
                    FullName = "Brian Lake",
                    Class = "Form 2A",
                    Level = "ZGC Level",
                    Status = "Active",
                    ParentEmail = "brian.lake@example.com",
                    ParentPhone = "+263770200001",
                    ParentPasswordHash = "hash",
                    CreatedAt = DateTime.UtcNow
                });
            await context.SaveChangesAsync();

            context.AttendanceRegisters.AddRange(
                new AttendanceRegister
                {
                    SchoolId = 1,
                    TeacherId = teacherOne.Id,
                    AcademicTermId = termOne.Id,
                    Class = "Form 1A",
                    AttendanceDate = new DateTime(2026, 4, 27),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    Entries =
                    [
                        new AttendanceRegisterEntry
                        {
                            SchoolId = 1,
                            StudentId = context.Students.Local.First(student => student.SchoolId == 1).Id,
                            Status = AttendanceStatus.Present,
                            CreatedAt = DateTime.UtcNow
                        }
                    ]
                },
                new AttendanceRegister
                {
                    SchoolId = 2,
                    TeacherId = teacherTwo.Id,
                    AcademicTermId = termTwo.Id,
                    Class = "Form 2A",
                    AttendanceDate = new DateTime(2026, 4, 27),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    Entries =
                    [
                        new AttendanceRegisterEntry
                        {
                            SchoolId = 2,
                            StudentId = context.Students.Local.First(student => student.SchoolId == 2).Id,
                            Status = AttendanceStatus.Absent,
                            CreatedAt = DateTime.UtcNow
                        }
                    ]
                });
            await context.SaveChangesAsync();
        }

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = new AttendanceService(queryContext, currentUser);

            var summaries = await service.GetDailySummariesAsync(new DateTime(2026, 4, 27));

            Assert.Equal(2, summaries.Count);
            Assert.Contains(summaries, summary => summary.SchoolId == 1 && summary.SchoolName == "North Academy" && summary.PresentCount == 1);
            Assert.Contains(summaries, summary => summary.SchoolId == 2 && summary.SchoolName == "Lake Academy" && summary.AbsentCount == 1);
        }
    }
}
