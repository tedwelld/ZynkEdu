using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class StudentServiceTests
{
    [Fact]
    public async Task EnrollAllSubjectsAsync_UsesCurrentSchool_ForSchoolAdmin()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 1, UserId = 1, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            SeedSchool(context, 1, "North Academy", "NA", "NA-0001", "Alice North", "Math", "English");
            await context.SaveChangesAsync();
        }

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var result = await service.EnrollAllSubjectsAsync();

            Assert.Equal(1, result.SchoolCount);
            Assert.Equal(1, result.StudentCount);
            Assert.Equal(2, result.SubjectCount);
            Assert.Equal(2, result.EnrollmentCount);

            var enrollments = await queryContext.StudentSubjectEnrollments.AsNoTracking().Where(x => x.SchoolId == 1).ToListAsync();
            Assert.Equal(2, enrollments.Count);
        }
    }

    [Fact]
    public async Task EnrollAllSubjectsAsync_ProcessesAllSchools_ForPlatformAdminWithoutSchoolFilter()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 1, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            SeedSchool(context, 1, "North Academy", "NA", "NA-0001", "Alice North", "Math", "English");
            SeedSchool(context, 2, "Lake Academy", "LA", "LA-0001", "Brian Lake", "Biology", "Geography");
            await context.SaveChangesAsync();
        }

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var result = await service.EnrollAllSubjectsAsync();

            Assert.Equal(2, result.SchoolCount);
            Assert.Equal(2, result.StudentCount);
            Assert.Equal(4, result.SubjectCount);
            Assert.Equal(4, result.EnrollmentCount);

            var schoolOneEnrollments = await queryContext.StudentSubjectEnrollments.AsNoTracking().Where(x => x.SchoolId == 1).ToListAsync();
            var schoolTwoEnrollments = await queryContext.StudentSubjectEnrollments.AsNoTracking().Where(x => x.SchoolId == 2).ToListAsync();

            Assert.Equal(2, schoolOneEnrollments.Count);
            Assert.Equal(2, schoolTwoEnrollments.Count);
        }
    }

    [Fact]
    public async Task GetAllAsync_ReturnsOnlyStudentsFromTeachersAssignedClasses()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Teacher, SchoolId = 1, UserId = 101, UserName = "teacher.one" };
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
                Address = "12 Example Road",
                CreatedAt = DateTime.UtcNow
            });

            var subject = new Subject
            {
                SchoolId = 1,
                Code = "NA1",
                Name = "Mathematics",
                GradeLevel = "General"
            };
            context.Subjects.Add(subject);

            var teacher = new AppUser
            {
                Id = 101,
                Username = "teacher.one",
                PasswordHash = "hash",
                Role = UserRole.Teacher,
                SchoolId = 1,
                DisplayName = "Teacher One",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            context.Users.Add(teacher);
            context.TeacherUsers.Add(new TeacherUser
            {
                Id = 101,
                SchoolId = 1,
                DisplayName = "Teacher One",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();

            context.TeacherAssignments.Add(new TeacherAssignment
            {
                SchoolId = 1,
                TeacherId = 101,
                SubjectId = subject.Id,
                Class = "Form 1A"
            });

            context.Students.AddRange(
                new Student
                {
                    SchoolId = 1,
                    StudentNumber = "NA-0001",
                    FullName = "Alice Alpha",
                    Class = "Form 1A",
                    Level = "ZGC Level",
                    Status = "Active",
                    EnrollmentYear = 2026,
                    ParentEmail = "alice@example.com",
                    ParentPhone = "+263770100001",
                    ParentPasswordHash = "hash",
                    CreatedAt = DateTime.UtcNow
                },
                new Student
                {
                    SchoolId = 1,
                    StudentNumber = "NA-0002",
                    FullName = "Brian Beta",
                    Class = "Form 1B",
                    Level = "ZGC Level",
                    Status = "Active",
                    EnrollmentYear = 2026,
                    ParentEmail = "brian@example.com",
                    ParentPhone = "+263770100002",
                    ParentPasswordHash = "hash",
                    CreatedAt = DateTime.UtcNow
                });

            await context.SaveChangesAsync();
        }

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var assignedClassStudents = await service.GetAllAsync("Form 1A");
            var unassignedClassStudents = await service.GetAllAsync("Form 1B");

            Assert.Single(assignedClassStudents);
            Assert.Equal("Alice Alpha", assignedClassStudents[0].FullName);
            Assert.Empty(unassignedClassStudents);
        }
    }

    private static StudentService CreateService(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, ICurrentUserContext currentUser)
    {
        return new StudentService(context, currentUser, new StubStudentNumberGenerator(), new AuditLogService(context, currentUser, NullLogger<AuditLogService>.Instance));
    }

    private static void SeedSchool(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, int schoolId, string schoolName, string schoolCode, string studentNumber, string studentName, string firstSubjectName, string secondSubjectName)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = schoolCode,
            Name = schoolName,
            Address = "12 Example Road",
            CreatedAt = DateTime.UtcNow
        });

        var firstSubject = new Subject
        {
            SchoolId = schoolId,
            Code = $"{schoolCode}1",
            Name = firstSubjectName,
            GradeLevel = "General"
        };

        var secondSubject = new Subject
        {
            SchoolId = schoolId,
            Code = $"{schoolCode}2",
            Name = secondSubjectName,
            GradeLevel = "General"
        };

        context.Subjects.AddRange(firstSubject, secondSubject);

        var student = new Student
        {
            SchoolId = schoolId,
            StudentNumber = studentNumber,
            FullName = studentName,
            Class = "Form 1A",
            Level = "ZGC Level",
            Status = "Active",
            EnrollmentYear = 2026,
            ParentEmail = $"{studentName.Replace(" ", string.Empty).ToLowerInvariant()}@example.com",
            ParentPhone = $"+263770{schoolId:000}001",
            ParentPasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };

        context.Students.Add(student);
        context.SaveChanges();

        context.StudentSubjectEnrollments.Add(new StudentSubjectEnrollment
        {
            SchoolId = schoolId,
            StudentId = student.Id,
            SubjectId = firstSubject.Id
        });
    }

    private sealed class StubStudentNumberGenerator : IStudentNumberGenerator
    {
        public Task<string> GenerateAsync(int schoolId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult($"SCH-{schoolId:0000}");
        }
    }
}
