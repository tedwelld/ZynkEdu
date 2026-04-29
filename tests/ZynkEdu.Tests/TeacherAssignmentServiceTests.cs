using Microsoft.AspNetCore.Identity;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class TeacherAssignmentServiceTests
{
    [Fact]
    public async Task CreateAsync_RejectsDuplicateTeacherAssignment()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 3, UserId = 33, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher1",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 3,
            DisplayName = "Teacher One",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 3,
            Code = "MATH1",
            Name = "Math",
            GradeLevel = "ZGC Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 3,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.Add(new SchoolClassSubject
        {
            SchoolId = 3,
            SchoolClassId = schoolClass.Id,
            SubjectId = subject.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentRequest(teacher.Id, subject.Id, "Form 1A");

        await service.CreateAsync(request);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(request));
        Assert.Equal("This teacher assignment already exists.", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_RejectsAnotherTeacherForTheSameClassSubjectPair()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 30, UserId = 300, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacherOne = new AppUser
        {
            Username = "teacher-a",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 30,
            DisplayName = "Teacher A",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacherOne.PasswordHash = hasher.HashPassword(teacherOne, "Password123!");

        var teacherTwo = new AppUser
        {
            Username = "teacher-b",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 30,
            DisplayName = "Teacher B",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacherTwo.PasswordHash = hasher.HashPassword(teacherTwo, "Password123!");

        var subject = new Subject
        {
            SchoolId = 30,
            Code = "MATH30",
            Name = "Math",
            GradeLevel = "ZGC Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 30,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(teacherOne, teacherTwo);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.Add(new SchoolClassSubject
        {
            SchoolId = 30,
            SchoolClassId = schoolClass.Id,
            SubjectId = subject.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);

        await service.CreateAsync(new CreateTeacherAssignmentRequest(teacherOne.Id, subject.Id, "Form 1A"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateTeacherAssignmentRequest(teacherTwo.Id, subject.Id, "Form 1A")));
        Assert.Contains("already assigned to another teacher", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_AllowsCrossLevelSubjectAssignment()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 4, UserId = 44, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher2",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 4,
            DisplayName = "Teacher Two",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 4,
            Code = "BIO1",
            Name = "Biology",
            GradeLevel = "O'Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 4,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.Add(new SchoolClassSubject
        {
            SchoolId = 4,
            SchoolClassId = schoolClass.Id,
            SubjectId = subject.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var assignment = await service.CreateAsync(new CreateTeacherAssignmentRequest(teacher.Id, subject.Id, "Form 1A"));

        Assert.Equal(subject.Id, assignment.SubjectId);
        Assert.Equal("Form 1A", assignment.Class);
    }

    [Fact]
    public async Task UpdateAsync_AllowsCrossLevelSubjectAssignment()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 5, UserId = 55, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher3",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 5,
            DisplayName = "Teacher Three",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var primarySubject = new Subject
        {
            SchoolId = 5,
            Code = "ENG1",
            Name = "English",
            GradeLevel = "ZGC Level"
        };

        var mismatchedSubject = new Subject
        {
            SchoolId = 5,
            Code = "CHE1",
            Name = "Chemistry",
            GradeLevel = "A'Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 5,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.AddRange(primarySubject, mismatchedSubject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject
            {
                SchoolId = 5,
                SchoolClassId = schoolClass.Id,
                SubjectId = primarySubject.Id,
                CreatedAt = DateTime.UtcNow
            },
            new SchoolClassSubject
            {
                SchoolId = 5,
                SchoolClassId = schoolClass.Id,
                SubjectId = mismatchedSubject.Id,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var assignment = new TeacherAssignment
        {
            SchoolId = 5,
            TeacherId = teacher.Id,
            SubjectId = primarySubject.Id,
            Class = "Form 1A"
        };
        context.TeacherAssignments.Add(assignment);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var updated = await service.UpdateAsync(assignment.Id, new UpdateTeacherAssignmentRequest(teacher.Id, mismatchedSubject.Id, "Form 1A"));

        Assert.Equal(mismatchedSubject.Id, updated.SubjectId);
        Assert.Equal("Form 1A", updated.Class);
    }

    [Fact]
    public async Task CreateBatchAsync_AllowsCrossLevelSubjectAssignments()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 6, UserId = 66, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher4",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 6,
            DisplayName = "Teacher Four",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 6,
            Code = "ART1",
            Name = "Art",
            GradeLevel = "A'Level"
        };
        var firstClass = new SchoolClass
        {
            SchoolId = 6,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var secondClass = new SchoolClass
        {
            SchoolId = 6,
            Name = "Form 1B",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.AddRange(firstClass, secondClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject
            {
                SchoolId = 6,
                SchoolClassId = firstClass.Id,
                SubjectId = subject.Id,
                CreatedAt = DateTime.UtcNow
            },
            new SchoolClassSubject
            {
                SchoolId = 6,
                SchoolClassId = secondClass.Id,
                SubjectId = subject.Id,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentsBatchRequest(teacher.Id, new[] { subject.Id }, new[] { "Form 1A", "Form 1B" });

        var result = await service.CreateBatchAsync(request);
        Assert.Equal(2, result.CreatedCount);
        Assert.Equal(2, result.Assignments.Count);
    }

    [Fact]
    public async Task CreateBatchAsync_AllowsMixedLevelClasses()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 7, UserId = 77, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher5",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 7,
            DisplayName = "Teacher Five",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 7,
            Code = "MUS1",
            Name = "Music",
            GradeLevel = "General"
        };
        var form1Class = new SchoolClass
        {
            SchoolId = 7,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var form3Class = new SchoolClass
        {
            SchoolId = 7,
            Name = "Form 3A Sciences",
            GradeLevel = "O'Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.AddRange(form1Class, form3Class);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.AddRange(
            new SchoolClassSubject
            {
                SchoolId = 7,
                SchoolClassId = form1Class.Id,
                SubjectId = subject.Id,
                CreatedAt = DateTime.UtcNow
            },
            new SchoolClassSubject
            {
                SchoolId = 7,
                SchoolClassId = form3Class.Id,
                SubjectId = subject.Id,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentsBatchRequest(teacher.Id, new[] { subject.Id }, new[] { "Form 1A", "Form 3A Sciences" });

        var result = await service.CreateBatchAsync(request);
        Assert.Equal(2, result.CreatedCount);
        Assert.Equal(2, result.Assignments.Count);
    }

    [Fact]
    public async Task CreateBatchAsync_RejectsAnotherTeacherOwningTheSameClassSubjectPair()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 9, UserId = 99, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacherOne = new AppUser
        {
            Username = "teacher7",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 9,
            DisplayName = "Teacher Seven",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacherOne.PasswordHash = hasher.HashPassword(teacherOne, "Password123!");

        var teacherTwo = new AppUser
        {
            Username = "teacher8",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 9,
            DisplayName = "Teacher Eight",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacherTwo.PasswordHash = hasher.HashPassword(teacherTwo, "Password123!");

        var subject = new Subject
        {
            SchoolId = 9,
            Code = "SCI9",
            Name = "Science",
            GradeLevel = "ZGC Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 9,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.AddRange(teacherOne, teacherTwo);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();
        context.SchoolClassSubjects.Add(new SchoolClassSubject
        {
            SchoolId = 9,
            SchoolClassId = schoolClass.Id,
            SubjectId = subject.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        await context.TeacherAssignments.AddAsync(new TeacherAssignment
        {
            SchoolId = 9,
            TeacherId = teacherOne.Id,
            SubjectId = subject.Id,
            Class = "Form 1A"
        });
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var request = new CreateTeacherAssignmentsBatchRequest(teacherTwo.Id, new[] { subject.Id }, new[] { "Form 1A" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateBatchAsync(request));
        Assert.Contains("already assigned to another teacher", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_RejectsClassesWithoutSubjects()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 8, UserId = 88, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var hasher = new PasswordHasher<AppUser>();
        var teacher = new AppUser
        {
            Username = "teacher6",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 8,
            DisplayName = "Teacher Six",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = hasher.HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 8,
            Code = "PHY1",
            Name = "Physics",
            GradeLevel = "ZGC Level"
        };
        var schoolClass = new SchoolClass
        {
            SchoolId = 8,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        await context.SaveChangesAsync();

        var service = new TeacherAssignmentService(context, currentUser);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateTeacherAssignmentRequest(teacher.Id, subject.Id, "Form 1A")));

        Assert.Contains("Assign subjects to the selected class", ex.Message);
    }
}
