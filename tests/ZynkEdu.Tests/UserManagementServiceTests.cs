using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class UserManagementServiceTests
{
    [Fact]
    public async Task DeleteTeacherAsync_RemovesTeacherAndTeacherOwnedRecords()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 10, UserId = 100, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 10,
            SchoolCode = "HA",
            Name = "Harare Academy",
            Address = "10 Example Road",
            CreatedAt = DateTime.UtcNow
        });

        var teacher = new AppUser
        {
            Username = "teacher.delete",
            PasswordHash = string.Empty,
            Role = UserRole.Teacher,
            SchoolId = 10,
            DisplayName = "Teacher Delete",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        teacher.PasswordHash = new PasswordHasher<AppUser>().HashPassword(teacher, "Password123!");

        var subject = new Subject
        {
            SchoolId = 10,
            Code = "MATH10",
            Name = "Mathematics",
            GradeLevel = "ZGC Level"
        };

        var schoolClass = new SchoolClass
        {
            SchoolId = 10,
            Name = "Form 1A",
            GradeLevel = "ZGC Level",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var term = new AcademicTerm
        {
            SchoolId = 10,
            TermNumber = 1,
            Name = "Term 1",
            CreatedAt = DateTime.UtcNow
        };

        var student = new Student
        {
            SchoolId = 10,
            StudentNumber = "HA-0001",
            FullName = "Student One",
            Class = "Form 1A",
            Level = "ZGC Level",
            Status = "Active",
            EnrollmentYear = 2026,
            ParentEmail = "student.one@example.com",
            ParentPhone = "+263770300001",
            ParentPasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(teacher);
        context.Subjects.Add(subject);
        context.SchoolClasses.Add(schoolClass);
        context.AcademicTerms.Add(term);
        context.Students.Add(student);
        await context.SaveChangesAsync();

        context.TeacherUsers.Add(new TeacherUser
        {
            Id = teacher.Id,
            SchoolId = 10,
            DisplayName = teacher.DisplayName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        context.SchoolClassSubjects.Add(new SchoolClassSubject
        {
            SchoolId = 10,
            SchoolClassId = schoolClass.Id,
            SubjectId = subject.Id,
            CreatedAt = DateTime.UtcNow
        });

        context.TeacherAssignments.Add(new TeacherAssignment
        {
            SchoolId = 10,
            TeacherId = teacher.Id,
            SubjectId = subject.Id,
            Class = schoolClass.Name
        });

        context.TimetableSlots.Add(new TimetableSlot
        {
            SchoolId = 10,
            TeacherId = teacher.Id,
            SubjectId = subject.Id,
            Class = schoolClass.Name,
            Term = term.Name,
            DayOfWeek = "Monday",
            StartTime = new TimeOnly(7, 20),
            EndTime = new TimeOnly(7, 55)
        });

        context.Results.Add(new Result
        {
            SchoolId = 10,
            StudentId = student.Id,
            SubjectId = subject.Id,
            TeacherId = teacher.Id,
            Score = 81,
            Grade = "A",
            Term = term.Name,
            ApprovalStatus = "Pending",
            IsLocked = false,
            CreatedAt = DateTime.UtcNow
        });

        context.AttendanceRegisters.Add(new AttendanceRegister
        {
            SchoolId = 10,
            TeacherId = teacher.Id,
            AcademicTermId = term.Id,
            Class = schoolClass.Name,
            AttendanceDate = new DateTime(2026, 4, 27),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Entries =
            [
                new AttendanceRegisterEntry
                {
                    SchoolId = 10,
                    StudentId = student.Id,
                    Status = AttendanceStatus.Present,
                    CreatedAt = DateTime.UtcNow
                }
            ]
        });

        await context.SaveChangesAsync();

        var service = new UserManagementService(context, currentUser, new PasswordHasher<AppUser>(), new TeacherAssignmentService(context, currentUser));
        await service.DeleteTeacherAsync(teacher.Id);

        Assert.False(await context.Users.AsNoTracking().AnyAsync(x => x.Id == teacher.Id));
        Assert.False(await context.TeacherUsers.AsNoTracking().AnyAsync(x => x.Id == teacher.Id));
        Assert.False(await context.TeacherAssignments.AsNoTracking().AnyAsync(x => x.TeacherId == teacher.Id));
        Assert.False(await context.TimetableSlots.AsNoTracking().AnyAsync(x => x.TeacherId == teacher.Id));
        Assert.False(await context.Results.AsNoTracking().AnyAsync(x => x.TeacherId == teacher.Id));
        Assert.False(await context.AttendanceRegisters.AsNoTracking().AnyAsync(x => x.TeacherId == teacher.Id));
        Assert.False(await context.AttendanceRegisterEntries.AsNoTracking().AnyAsync(x => x.StudentId == student.Id));
    }

    [Fact]
    public async Task CreateAccountantAsync_WritesTheUserAndAccountingProfile_ForASchoolAdmin()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 25, UserId = 250, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        context.Schools.Add(new School
        {
            Id = 25,
            SchoolCode = "HB",
            Name = "Highlands Baptist",
            Address = "25 Example Road",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new UserManagementService(context, currentUser, new PasswordHasher<AppUser>(), new TeacherAssignmentService(context, currentUser));
        var created = await service.CreateAccountantAsync(new CreateAccountantRequest(
            Username: "acc.jane",
            Password: "Password123!",
            Role: UserRole.AccountantJunior,
            DisplayName: "Jane Accountant",
            ContactEmail: "jane@example.com"));

        Assert.Equal("acc.jane", created.Username);
        Assert.Equal(UserRole.AccountantJunior.ToString(), created.Role);
        Assert.Equal(25, created.SchoolId);

        var user = await context.Users.AsNoTracking().SingleAsync(x => x.Id == created.Id);
        var accountantProfile = await context.AccountantUsers.AsNoTracking().SingleAsync(x => x.Id == created.Id);

        Assert.Equal("acc.jane", user.Username);
        Assert.Equal("Jane Accountant", accountantProfile.DisplayName);
        Assert.Equal(25, accountantProfile.SchoolId);

        var accountants = await service.GetAccountantsAsync(cancellationToken: default);
        Assert.Single(accountants);
        Assert.Equal(created.Id, accountants[0].Id);
        Assert.Equal("Jane Accountant", accountants[0].DisplayName);
    }
}
