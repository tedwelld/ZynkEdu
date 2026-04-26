using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Seeding;

public sealed class DemoDataSeeder
{
    private static readonly IReadOnlyList<SchoolBlueprint> Blueprints = BuildBlueprints();

    private readonly ZynkEduDbContext _dbContext;
    private readonly IStudentNumberGenerator _studentNumberGenerator;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private const string ParentPassword = "Parent123!";

    public DemoDataSeeder(
        ZynkEduDbContext dbContext,
        IStudentNumberGenerator studentNumberGenerator,
        IPasswordHasher<AppUser> passwordHasher)
    {
        _dbContext = dbContext;
        _studentNumberGenerator = studentNumberGenerator;
        _passwordHasher = passwordHasher;
    }

    private static IReadOnlyList<SchoolBlueprint> BuildBlueprints()
    {
        return new[]
        {
            BuildZgcSchool(),
            BuildOLevelSchool(),
            BuildALevelSchool()
        };
    }

    private static SchoolBlueprint BuildZgcSchool()
    {
        var classes = new[]
        {
            "Form 1A",
            "Form 1B",
            "Form 1C",
            "Form 2A",
            "Form 2B",
            "Form 2C"
        };

        return new SchoolBlueprint(
            "Northview Academy",
            "12 Maple Avenue",
            "northview.admin@zynkedu.local",
            new TeacherBlueprint("north.admin", "Northview Admin", "Welcome123!"),
            new TeacherBlueprint("north.teacher.one", "Daniel Moyo", "Welcome123!"),
            new TeacherBlueprint("north.teacher.two", "Tendai Ncube", "Welcome123!"),
            new[]
            {
                "Mathematics",
                "English",
                "Science",
                "Art",
                "History",
                "ICT"
            },
            classes,
            new[] { "Mathematics", "Science", "ICT" },
            new[] { "English", "Art", "History" },
            BuildStudents("northview", classes, "northview.zynkedu.local", "+263770100"));
    }

    private static SchoolBlueprint BuildOLevelSchool()
    {
        var classes = new[]
        {
            "Form 3A Sciences",
            "Form 3B Commercials",
            "Form 3C Arts",
            "Form 4A Sciences",
            "Form 4B Commercials",
            "Form 4C Arts"
        };

        return new SchoolBlueprint(
            "Lakeside Secondary School",
            "48 Harbour Road",
            "lakeside.admin@zynkedu.local",
            new TeacherBlueprint("lakeside.admin", "Lakeside Admin", "Welcome123!"),
            new TeacherBlueprint("lakeside.teacher.one", "Esther Banda", "Welcome123!"),
            new TeacherBlueprint("lakeside.teacher.two", "Peter Moyo", "Welcome123!"),
            new[]
            {
                "Biology",
                "Geography",
                "History",
                "Commerce",
                "Physics",
                "English"
            },
            classes,
            new[] { "Biology", "Geography", "Physics" },
            new[] { "History", "Commerce", "English" },
            BuildStudents("lakeside", classes, "lakeside.zynkedu.local", "+263770200"));
    }

    private static SchoolBlueprint BuildALevelSchool()
    {
        var classes = new[]
        {
            "Form 5 Arts",
            "Form 5 Commercials",
            "Form 5 Sciences",
            "Form 6 Arts",
            "Form 6 Commercials",
            "Form 6 Sciences"
        };

        return new SchoolBlueprint(
            "Riverbend Sixth Form",
            "78 Willow Crescent",
            "riverbend.admin@zynkedu.local",
            new TeacherBlueprint("riverbend.admin", "Riverbend Admin", "Welcome123!"),
            new TeacherBlueprint("riverbend.teacher.one", "Nokuthula Dube", "Welcome123!"),
            new TeacherBlueprint("riverbend.teacher.two", "Brian Chikosha", "Welcome123!"),
            new[]
            {
                "Economics",
                "Business Studies",
                "Mathematics",
                "Literature",
                "Accounting",
                "Law"
            },
            classes,
            new[] { "Economics", "Business Studies", "Mathematics" },
            new[] { "Literature", "Accounting", "Law" },
            BuildStudents("riverbend", classes, "riverbend.zynkedu.local", "+263770300"));
    }

    private static IReadOnlyList<StudentBlueprint> BuildStudents(string schoolKey, IReadOnlyList<string> classes, string emailDomain, string phonePrefix)
    {
        var maleNames = new[]
        {
            "Aiden", "Brian", "Caleb", "Daniel", "Ethan", "Frank", "Godfrey", "Hector", "Isaac", "Jordan",
            "Kuda", "Liam", "Moses", "Nathan", "Owen", "Prince", "Quincy", "Ryan", "Sam", "Tawanda"
        };

        var femaleNames = new[]
        {
            "Ava", "Beatrice", "Chloe", "Diana", "Ella", "Faith", "Grace", "Hannah", "Ivy", "Joy",
            "Kaitlyn", "Lerato", "Mia", "Nadia", "Olivia", "Precious", "Ruth", "Tariro", "Unity", "Zoe"
        };

        var students = new List<StudentBlueprint>(5);
        var phoneCounter = 1;

        foreach (var (className, index) in classes.Take(5).Select((value, index) => (value, index)))
        {
            var classCode = className.Replace(" ", string.Empty).Replace("'", string.Empty).ToLowerInvariant();
            var isMale = index % 2 == 0;
            var name = isMale ? maleNames[index] : femaleNames[index];
            var suffix = isMale ? "boy" : "girl";

            students.Add(new StudentBlueprint(
                $"{name} {className}",
                className,
                $"{schoolKey}.{classCode}.{suffix}{index + 1:00}@{emailDomain}",
                $"{phonePrefix}{phoneCounter++:03}"));
        }

        return students;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        foreach (var blueprint in Blueprints)
        {
            var school = await EnsureSchoolAsync(blueprint, cancellationToken);
            await SeedSchoolAsync(school, blueprint, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<School> EnsureSchoolAsync(SchoolBlueprint blueprint, CancellationToken cancellationToken)
    {
        var school = await _dbContext.Schools.FirstOrDefaultAsync(x => x.Name == blueprint.Name, cancellationToken);
        if (school is not null)
        {
            school.Address = blueprint.Address;
            school.AdminContactEmail = blueprint.AdminContactEmail;
            return school;
        }

        school = new School
        {
            Name = blueprint.Name,
            Address = blueprint.Address,
            AdminContactEmail = blueprint.AdminContactEmail,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Schools.Add(school);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return school;
    }

    private async Task SeedSchoolAsync(School school, SchoolBlueprint blueprint, CancellationToken cancellationToken)
    {
        var admin = await EnsureUserAsync(school.Id, blueprint.Admin, UserRole.Admin, cancellationToken);
        var teacherOne = await EnsureUserAsync(school.Id, blueprint.TeacherOne, UserRole.Teacher, cancellationToken);
        var teacherTwo = await EnsureUserAsync(school.Id, blueprint.TeacherTwo, UserRole.Teacher, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var subjects = new Dictionary<string, Subject>(StringComparer.OrdinalIgnoreCase);
        foreach (var subjectName in blueprint.Subjects)
        {
            subjects[subjectName] = await EnsureSubjectAsync(school.Id, subjectName, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var students = new List<Student>();
        foreach (var studentBlueprint in blueprint.Students)
        {
            students.Add(await EnsureStudentAsync(school.Id, studentBlueprint, cancellationToken));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var student in students)
        {
            await EnsureGuardianAsync(school.Id, student, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var className in blueprint.Classes)
        {
            foreach (var subjectName in blueprint.TeacherOneSubjects)
            {
                await EnsureAssignmentAsync(school.Id, teacherOne.Id, subjects[subjectName].Id, className, cancellationToken);
            }

            foreach (var subjectName in blueprint.TeacherTwoSubjects)
            {
                await EnsureAssignmentAsync(school.Id, teacherTwo.Id, subjects[subjectName].Id, className, cancellationToken);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var (student, index) in students.Select((value, index) => (value, index)))
        {
            var firstSubjectName = blueprint.TeacherOneSubjects[index % blueprint.TeacherOneSubjects.Count];
            var secondSubjectName = blueprint.TeacherTwoSubjects[index % blueprint.TeacherTwoSubjects.Count];
            await EnsureResultAsync(
                school.Id,
                student,
                subjects[firstSubjectName],
                teacherOne,
                ScoreFor(index, 0),
                "Term 1",
                "Strong classroom participation and steady progress.",
                cancellationToken);

            await EnsureResultAsync(
                school.Id,
                student,
                subjects[secondSubjectName],
                teacherTwo,
                ScoreFor(index, 1),
                "Term 1",
                "Continues to improve with consistent revision.",
                cancellationToken);
        }

        await SeedNotificationsAsync(school.Id, admin.Id, students, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await SeedAcademicTermsAsync(school.Id, cancellationToken);
        await SeedTimetableAsync(school.Id, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<AppUser> EnsureUserAsync(int schoolId, TeacherBlueprint blueprint, UserRole role, CancellationToken cancellationToken)
    {
        var username = blueprint.Username.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(x => x.Username == username, cancellationToken);
        var isNew = user is null;
        if (user is null)
        {
            user = new AppUser
            {
                Username = username,
                Role = role,
                SchoolId = schoolId,
                DisplayName = blueprint.DisplayName.Trim(),
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, blueprint.Password);
            _dbContext.Users.Add(user);
        }
        else
        {
            user.SchoolId = schoolId;
            user.Role = role;
            user.DisplayName = blueprint.DisplayName.Trim();
            user.IsActive = true;
            if (string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                user.PasswordHash = _passwordHasher.HashPassword(user, blueprint.Password);
            }
        }

        if (isNew)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        if (role == UserRole.Admin)
        {
            var profile = await _dbContext.StaffAdmins.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.StaffAdmins.Add(new StaffAdmin
                {
                    Id = user.Id,
                    SchoolId = schoolId,
                    DisplayName = blueprint.DisplayName.Trim(),
                    IsActive = true,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.SchoolId = schoolId;
                profile.DisplayName = blueprint.DisplayName.Trim();
                profile.IsActive = true;
            }
        }
        else if (role == UserRole.Teacher)
        {
            var profile = await _dbContext.TeacherUsers.FirstOrDefaultAsync(x => x.Id == user.Id, cancellationToken);
            if (profile is null)
            {
                _dbContext.TeacherUsers.Add(new TeacherUser
                {
                    Id = user.Id,
                    SchoolId = schoolId,
                    DisplayName = blueprint.DisplayName.Trim(),
                    IsActive = true,
                    CreatedAt = user.CreatedAt
                });
            }
            else
            {
                profile.SchoolId = schoolId;
                profile.DisplayName = blueprint.DisplayName.Trim();
                profile.IsActive = true;
            }
        }

        return user;
    }

    private async Task<Subject> EnsureSubjectAsync(int schoolId, string name, CancellationToken cancellationToken)
    {
        var subjectName = name.Trim();
        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Name == subjectName, cancellationToken);
        if (subject is not null)
        {
            return subject;
        }

        subject = new Subject
        {
            SchoolId = schoolId,
            Name = subjectName
        };

        _dbContext.Subjects.Add(subject);
        return subject;
    }

    private async Task<Student> EnsureStudentAsync(int schoolId, StudentBlueprint blueprint, CancellationToken cancellationToken)
    {
        var email = blueprint.ParentEmail.Trim().ToLowerInvariant();
        var phone = blueprint.ParentPhone.Trim();
        var student = await _dbContext.Students.FirstOrDefaultAsync(x => x.ParentEmail == email || x.ParentPhone == phone, cancellationToken);
        if (student is not null)
        {
            if (string.IsNullOrWhiteSpace(student.ParentPasswordHash))
            {
                student.ParentPasswordHash = HashParentPassword(email);
            }

            return student;
        }

        student = new Student
        {
            SchoolId = schoolId,
            StudentNumber = await _studentNumberGenerator.GenerateAsync(schoolId, cancellationToken),
            FullName = blueprint.FullName.Trim(),
            Class = blueprint.Class.Trim(),
            ParentEmail = email,
            ParentPhone = phone,
            ParentPasswordHash = HashParentPassword(email),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Students.Add(student);
        return student;
    }

    private async Task EnsureGuardianAsync(int schoolId, Student student, CancellationToken cancellationToken)
    {
        var guardian = await _dbContext.Guardians.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (guardian is null)
        {
            guardian = new Guardian
            {
                SchoolId = schoolId,
                StudentId = student.Id,
                DisplayName = student.FullName,
                ParentEmail = student.ParentEmail,
                ParentPhone = student.ParentPhone,
                PasswordHash = student.ParentPasswordHash,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Guardians.Add(guardian);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            guardian.SchoolId = schoolId;
            guardian.DisplayName = student.FullName;
            guardian.ParentEmail = student.ParentEmail;
            guardian.ParentPhone = student.ParentPhone;
            guardian.PasswordHash = student.ParentPasswordHash;
            guardian.IsActive = true;
        }

        student.GuardianId = guardian.Id;
    }

    private string HashParentPassword(string parentIdentifier)
    {
        return _passwordHasher.HashPassword(new AppUser { Username = parentIdentifier }, ParentPassword);
    }

    private async Task EnsureAssignmentAsync(int schoolId, int teacherId, int subjectId, string className, CancellationToken cancellationToken)
    {
        var normalizedClass = className.Trim();
        var exists = await _dbContext.TeacherAssignments.AnyAsync(x =>
            x.SchoolId == schoolId &&
            x.TeacherId == teacherId &&
            x.SubjectId == subjectId &&
            x.Class == normalizedClass, cancellationToken);

        if (exists)
        {
            return;
        }

        _dbContext.TeacherAssignments.Add(new TeacherAssignment
        {
            SchoolId = schoolId,
            TeacherId = teacherId,
            SubjectId = subjectId,
            Class = normalizedClass
        });
    }

    private async Task EnsureResultAsync(
        int schoolId,
        Student student,
        Subject subject,
        AppUser teacher,
        decimal score,
        string term,
        string comment,
        CancellationToken cancellationToken)
    {
        var exists = await _dbContext.Results.AnyAsync(x =>
            x.SchoolId == schoolId &&
            x.StudentId == student.Id &&
            x.SubjectId == subject.Id &&
            x.Term == term, cancellationToken);

        if (exists)
        {
            return;
        }

        _dbContext.Results.Add(new Result
        {
            SchoolId = schoolId,
            StudentId = student.Id,
            SubjectId = subject.Id,
            TeacherId = teacher.Id,
            Score = score,
            Grade = GetGrade(score),
            Term = term,
            Comment = comment,
            CreatedAt = DateTime.UtcNow
        });
    }

    private async Task SeedNotificationsAsync(int schoolId, int createdBy, IReadOnlyList<Student> students, CancellationToken cancellationToken)
    {
        var notifications = new[]
        {
            new
            {
                Title = "Term 1 results are live",
                Message = "Parents can now review learner performance for the first term.",
                Type = NotificationType.Email
            },
            new
            {
                Title = "Parent meeting reminder",
                Message = "The school parent meeting takes place this Friday at 15:00.",
                Type = NotificationType.Sms
            }
        };

        foreach (var notificationSeed in notifications)
        {
            var exists = await _dbContext.Notifications.AnyAsync(x => x.SchoolId == schoolId && x.Title == notificationSeed.Title, cancellationToken);
            if (exists)
            {
                continue;
            }

            var notification = new Notification
            {
                SchoolId = schoolId,
                Title = notificationSeed.Title,
                Message = notificationSeed.Message,
                Type = notificationSeed.Type,
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var student in students)
            {
                notification.Recipients.Add(new NotificationRecipient
                {
                    Student = student,
                    Destination = notificationSeed.Type == NotificationType.Email ? student.ParentEmail : student.ParentPhone,
                    Status = NotificationStatus.Delivered,
                    Attempts = 1,
                    DeliveredAt = DateTime.UtcNow
                });
            }

            _dbContext.Notifications.Add(notification);
        }
    }

    private async Task SeedTimetableAsync(int schoolId, CancellationToken cancellationToken)
    {
        const string term = "Term 1";
        if (await _dbContext.TimetableSlots.AnyAsync(x => x.SchoolId == schoolId && x.Term == term, cancellationToken))
        {
            return;
        }

        var assignments = await _dbContext.TeacherAssignments
            .AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Where(x => x.SchoolId == schoolId)
            .OrderBy(x => x.Class)
            .ThenBy(x => x.Subject.Name)
            .ToListAsync(cancellationToken);

        if (assignments.Count == 0)
        {
            return;
        }

        var weekdays = new[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday" };
        var periods = new[]
        {
            (new TimeOnly(8, 0), new TimeOnly(8, 40)),
            (new TimeOnly(8, 45), new TimeOnly(9, 25)),
            (new TimeOnly(9, 30), new TimeOnly(10, 10)),
            (new TimeOnly(10, 20), new TimeOnly(11, 0)),
            (new TimeOnly(11, 10), new TimeOnly(11, 50)),
            (new TimeOnly(12, 0), new TimeOnly(12, 40))
        };

        var slots = assignments.Select((assignment, index) =>
        {
            var period = periods[index % periods.Length];
            return new TimetableSlot
            {
                SchoolId = schoolId,
                TeacherId = assignment.TeacherId,
                SubjectId = assignment.SubjectId,
                Class = assignment.Class,
                Term = term,
                DayOfWeek = weekdays[index % weekdays.Length],
                StartTime = period.Item1,
                EndTime = period.Item2
            };
        }).ToList();

        _dbContext.TimetableSlots.AddRange(slots);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedAcademicTermsAsync(int schoolId, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.AcademicTerms.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .Select(x => x.TermNumber)
            .ToListAsync(cancellationToken);

        var terms = Enumerable.Range(1, 3)
            .Where(termNumber => !existing.Contains(termNumber))
            .Select(termNumber => new AcademicTerm
            {
                SchoolId = schoolId,
                TermNumber = termNumber,
                Name = $"Term {termNumber}",
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (terms.Count > 0)
        {
            _dbContext.AcademicTerms.AddRange(terms);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static decimal ScoreFor(int index, int offset)
    {
        return (offset == 0 ? 37 : 43) + ((index * (offset == 0 ? 9 : 7) + (offset == 0 ? 3 : 11)) % 58);
    }

    private static string GetGrade(decimal score)
    {
        if (score >= 80) return "A";
        if (score >= 70) return "B";
        if (score >= 60) return "C";
        if (score >= 50) return "D";
        return "F";
    }

    private sealed record TeacherBlueprint(string Username, string DisplayName, string Password);

    private sealed record StudentBlueprint(string FullName, string Class, string ParentEmail, string ParentPhone);

    private sealed record SchoolBlueprint(
        string Name,
        string Address,
        string AdminContactEmail,
        TeacherBlueprint Admin,
        TeacherBlueprint TeacherOne,
        TeacherBlueprint TeacherTwo,
        IReadOnlyList<string> Subjects,
        IReadOnlyList<string> Classes,
        IReadOnlyList<string> TeacherOneSubjects,
        IReadOnlyList<string> TeacherTwoSubjects,
        IReadOnlyList<StudentBlueprint> Students);
}
