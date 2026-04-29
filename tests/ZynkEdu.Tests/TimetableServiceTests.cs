using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class TimetableServiceTests
{
    [Fact]
    public async Task GenerateAsync_AutoAssignsTeachersWhenCoverageIsMissing()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 901, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();

        AppUser CreateTeacher(string username, string displayName)
        {
            var teacher = new AppUser
            {
                Username = username,
                PasswordHash = string.Empty,
                Role = UserRole.Teacher,
                SchoolId = 78,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");
            return teacher;
        }

        var teachers = new[]
        {
            CreateTeacher("math.teacher", "Math Teacher"),
            CreateTeacher("english.teacher", "English Teacher"),
            CreateTeacher("commerce.teacher", "Commerce Teacher"),
            CreateTeacher("biology.teacher", "Biology Teacher")
        };

        var math = new Subject
        {
            SchoolId = 78,
            Code = "MATH",
            Name = "Mathematics",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1
        };

        var english = new Subject
        {
            SchoolId = 78,
            Code = "ENG",
            Name = "English",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1
        };

        var commerce = new Subject
        {
            SchoolId = 78,
            Code = "COMM",
            Name = "Commerce",
            GradeLevel = "O'Level",
            WeeklyLoad = 1
        };

        var biology = new Subject
        {
            SchoolId = 78,
            Code = "BIO",
            Name = "Biology",
            GradeLevel = "A'Level",
            WeeklyLoad = 1
        };

        var form1A = new SchoolClass
        {
            SchoolId = 78,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form1B = new SchoolClass
        {
            SchoolId = 78,
            Name = "Form 1B",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form3A = new SchoolClass
        {
            SchoolId = 78,
            Name = "Form 3A Sciences",
            GradeLevel = "O'Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form5A = new SchoolClass
        {
            SchoolId = 78,
            Name = "Form 5 Arts",
            GradeLevel = "A'Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(teachers);
        context.Subjects.AddRange(math, english, commerce, biology);
        context.SchoolClasses.AddRange(form1A, form1B, form3A, form5A);
        await context.SaveChangesAsync();

        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form1A.Id, SubjectId = math.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form1A.Id, SubjectId = english.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form1B.Id, SubjectId = math.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form1B.Id, SubjectId = english.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form3A.Id, SubjectId = commerce.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 78, SchoolClassId = form5A.Id, SubjectId = biology.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var service = new TimetableService(context, currentUser);
        var generated = await service.GenerateAsync(new GenerateTimetableRequest("Term 1"), 78);

        Assert.NotEmpty(generated);
        Assert.Equal(6, generated.Count);
        Assert.Equal(6, await context.TeacherAssignments.AsNoTracking().CountAsync(x => x.SchoolId == 78));
        Assert.Contains(context.TeacherAssignments.AsNoTracking(), assignment => assignment.SchoolId == 78 && assignment.Class == "Form 1A" && assignment.SubjectId == math.Id);
        Assert.Contains(context.TeacherAssignments.AsNoTracking(), assignment => assignment.SchoolId == 78 && assignment.Class == "Form 1B" && assignment.SubjectId == english.Id);
    }

    [Fact]
    public async Task GenerateAsync_StaggersPracticalSubjectsAcrossClasses()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 902, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();

        AppUser CreateTeacher(string username, string displayName)
        {
            var teacher = new AppUser
            {
                Username = username,
                PasswordHash = string.Empty,
                Role = UserRole.Teacher,
                SchoolId = 81,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");
            return teacher;
        }

        var teachers = new[]
        {
            CreateTeacher("practical.teacher", "Practical Teacher")
        };

        var practicalSubject = new Subject
        {
            SchoolId = 81,
            Code = "PRACT",
            Name = "Computer Science",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 2,
            IsPractical = true
        };

        var form1A = new SchoolClass
        {
            SchoolId = 81,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form1B = new SchoolClass
        {
            SchoolId = 81,
            Name = "Form 1B",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(teachers);
        context.Subjects.Add(practicalSubject);
        context.SchoolClasses.AddRange(form1A, form1B);
        await context.SaveChangesAsync();

        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject { SchoolId = 81, SchoolClassId = form1A.Id, SubjectId = practicalSubject.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 81, SchoolClassId = form1B.Id, SubjectId = practicalSubject.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        context.TeacherAssignments.AddRange(
            new TeacherAssignment { SchoolId = 81, TeacherId = teachers[0].Id, SubjectId = practicalSubject.Id, Class = form1A.Name },
            new TeacherAssignment { SchoolId = 81, TeacherId = teachers[0].Id, SubjectId = practicalSubject.Id, Class = form1B.Name }
        );
        await context.SaveChangesAsync();

        var service = new TimetableService(context, currentUser);
        var generated = await service.GenerateAsync(new GenerateTimetableRequest("Term 1"), 81);

        Assert.Equal(4, generated.Count);
        Assert.All(generated, slot => Assert.Equal("Computer Science", slot.SubjectName));
        Assert.Equal(1, generated.Select(slot => slot.TeacherId).Distinct().Count());
        Assert.Equal(generated.Count, generated.Select(slot => $"{slot.DayOfWeek}|{slot.StartTime}").Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Empty(
            generated.Where(slot => slot.Class == "Form 1A")
                .Select(slot => $"{slot.DayOfWeek}|{slot.StartTime}")
                .Intersect(
                    generated.Where(slot => slot.Class == "Form 1B")
                        .Select(slot => $"{slot.DayOfWeek}|{slot.StartTime}"),
                    StringComparer.OrdinalIgnoreCase));
        Assert.Contains(generated, slot => slot.Class == "Form 1A");
        Assert.Contains(generated, slot => slot.Class == "Form 1B");
    }

    [Fact]
    public async Task GenerateAsync_AutoAssignsAndBalancesPracticalSubjectsAcrossTeachers()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 903, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();

        AppUser CreateTeacher(string username, string displayName)
        {
            var teacher = new AppUser
            {
                Username = username,
                PasswordHash = string.Empty,
                Role = UserRole.Teacher,
                SchoolId = 82,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");
            return teacher;
        }

        var teachers = new[]
        {
            CreateTeacher("practical.teacher1", "Practical Teacher 1"),
            CreateTeacher("practical.teacher2", "Practical Teacher 2")
        };

        var practicalSubject = new Subject
        {
            SchoolId = 82,
            Code = "PRACT",
            Name = "Woodwork",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1,
            IsPractical = true
        };

        var form1A = new SchoolClass
        {
            SchoolId = 82,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form1B = new SchoolClass
        {
            SchoolId = 82,
            Name = "Form 1B",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form1C = new SchoolClass
        {
            SchoolId = 82,
            Name = "Form 1C",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(teachers);
        context.Subjects.Add(practicalSubject);
        context.SchoolClasses.AddRange(form1A, form1B, form1C);
        await context.SaveChangesAsync();

        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject { SchoolId = 82, SchoolClassId = form1A.Id, SubjectId = practicalSubject.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 82, SchoolClassId = form1B.Id, SubjectId = practicalSubject.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 82, SchoolClassId = form1C.Id, SubjectId = practicalSubject.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var service = new TimetableService(context, currentUser);
        var generated = await service.GenerateAsync(new GenerateTimetableRequest("Term 1"), 82);

        Assert.Equal(3, generated.Count);
        Assert.All(generated, slot => Assert.Equal("Woodwork", slot.SubjectName));
        Assert.Equal(2, generated.Select(slot => slot.TeacherId).Distinct().Count());

        var teacherLoad = await context.TeacherAssignments.AsNoTracking()
            .GroupBy(x => x.TeacherId)
            .Select(group => group.Count())
            .OrderBy(count => count)
            .ToListAsync();

        Assert.Equal(2, teacherLoad.Count);
        Assert.Equal(1, teacherLoad[0]);
        Assert.Equal(2, teacherLoad[1]);
        Assert.Equal(3, generated.Select(slot => $"{slot.TeacherId}|{slot.DayOfWeek}|{slot.StartTime}").Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    [Fact]
    public async Task PublishAsync_CreatesApprovalNotificationForTeachers()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 79, UserId = 777, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var service = new TimetableService(context, currentUser);

        await service.PublishAsync(new PublishTimetableRequest("Term 1"), 79);

        var publication = await context.TimetablePublications.AsNoTracking().SingleAsync(x => x.SchoolId == 79 && x.Term == "Term 1");
        Assert.True(publication.PublishedAt != default);

        var notification = await context.Notifications.AsNoTracking().SingleAsync(x => x.SchoolId == 79 && x.Type == NotificationType.System && x.Title == "Timetable approved for Term 1");
        Assert.Contains("approved", notification.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(777, notification.CreatedBy);
    }

    [Fact]
    public async Task GenerateAsync_ReturnsLevelAwareSlotsWithoutTeacherOrClassClashes()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.PlatformAdmin, UserId = 900, UserName = "platform.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();

        AppUser CreateTeacher(string username, string displayName)
        {
            var teacher = new AppUser
            {
                Username = username,
                PasswordHash = string.Empty,
                Role = UserRole.Teacher,
                SchoolId = 77,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");
            return teacher;
        }

        var mathTeacher = CreateTeacher("math.teacher", "Math Teacher");
        var englishTeacher = CreateTeacher("english.teacher", "English Teacher");
        var commerceTeacher = CreateTeacher("commerce.teacher", "Commerce Teacher");
        var biologyTeacher = CreateTeacher("biology.teacher", "Biology Teacher");

        var math = new Subject
        {
            SchoolId = 77,
            Code = "MATH",
            Name = "Mathematics",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1
        };

        var english = new Subject
        {
            SchoolId = 77,
            Code = "ENG",
            Name = "English",
            GradeLevel = "ZGC Level",
            WeeklyLoad = 1
        };

        var commerce = new Subject
        {
            SchoolId = 77,
            Code = "COMM",
            Name = "Commerce",
            GradeLevel = "O'Level",
            WeeklyLoad = 1
        };

        var biology = new Subject
        {
            SchoolId = 77,
            Code = "BIO",
            Name = "Biology",
            GradeLevel = "A'Level",
            WeeklyLoad = 1
        };

        var form1A = new SchoolClass
        {
            SchoolId = 77,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form1B = new SchoolClass
        {
            SchoolId = 77,
            Name = "Form 1B",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form3A = new SchoolClass
        {
            SchoolId = 77,
            Name = "Form 3A Sciences",
            GradeLevel = "O'Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var form5A = new SchoolClass
        {
            SchoolId = 77,
            Name = "Form 5 Arts",
            GradeLevel = "A'Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(mathTeacher, englishTeacher, commerceTeacher, biologyTeacher);
        context.Subjects.AddRange(math, english, commerce, biology);
        context.SchoolClasses.AddRange(form1A, form1B, form3A, form5A);
        await context.SaveChangesAsync();

        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form1A.Id, SubjectId = math.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form1A.Id, SubjectId = english.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form1B.Id, SubjectId = math.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form1B.Id, SubjectId = english.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form3A.Id, SubjectId = commerce.Id, CreatedAt = DateTime.UtcNow },
            new SchoolClassSubject { SchoolId = 77, SchoolClassId = form5A.Id, SubjectId = biology.Id, CreatedAt = DateTime.UtcNow }
        );

        context.TeacherAssignments.AddRange(
            new TeacherAssignment { SchoolId = 77, TeacherId = mathTeacher.Id, SubjectId = math.Id, Class = form1A.Name },
            new TeacherAssignment { SchoolId = 77, TeacherId = mathTeacher.Id, SubjectId = math.Id, Class = form1B.Name },
            new TeacherAssignment { SchoolId = 77, TeacherId = englishTeacher.Id, SubjectId = english.Id, Class = form1A.Name },
            new TeacherAssignment { SchoolId = 77, TeacherId = englishTeacher.Id, SubjectId = english.Id, Class = form1B.Name },
            new TeacherAssignment { SchoolId = 77, TeacherId = commerceTeacher.Id, SubjectId = commerce.Id, Class = form3A.Name },
            new TeacherAssignment { SchoolId = 77, TeacherId = biologyTeacher.Id, SubjectId = biology.Id, Class = form5A.Name }
        );
        await context.SaveChangesAsync();

        var service = new TimetableService(context, currentUser);
        var generated = await service.GenerateAsync(new GenerateTimetableRequest("Term 1"), 77);

        Assert.NotEmpty(generated);
        Assert.Equal(3, generated.Select(slot => slot.GradeLevel).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Contains(generated, slot => slot.GradeLevel == "ZGC Level");
        Assert.Contains(generated, slot => slot.GradeLevel == "O'Level");
        Assert.Contains(generated, slot => slot.GradeLevel == "A'Level");

        var teacherKeys = generated.Select(slot => $"{slot.TeacherId}|{slot.DayOfWeek}|{slot.StartTime}").ToList();
        var classKeys = generated.Select(slot => $"{slot.Class}|{slot.DayOfWeek}|{slot.StartTime}").ToList();
        var sessionTimes = generated.Select(slot => $"{slot.StartTime:HH:mm}-{slot.EndTime:HH:mm}").ToList();
        var expectedSessionTimes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "07:20-07:55",
            "07:55-08:30",
            "08:30-09:05",
            "09:05-09:40",
            "09:40-10:15",
            "10:50-11:25",
            "11:25-12:00",
            "12:00-12:35",
            "12:35-13:10"
        };

        Assert.Equal(teacherKeys.Count, teacherKeys.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(classKeys.Count, classKeys.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.All(sessionTimes, time => Assert.Contains(time, expectedSessionTimes));
        Assert.Equal(5, generated.Select(slot => slot.DayOfWeek).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Contains(generated, slot => slot.DayOfWeek == "Thursday");
        Assert.Contains(generated, slot => slot.DayOfWeek == "Friday");
    }
}
