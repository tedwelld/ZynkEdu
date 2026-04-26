using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class ResultService : IResultService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly INotificationService _notificationService;

    public ResultService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _notificationService = notificationService;
    }

    public async Task<ResultResponse> CreateAsync(CreateResultRequest request, CancellationToken cancellationToken = default)
    {
        var schoolId = RequireSchoolId();
        var teacherId = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("Teacher identity is missing.");
        if (_currentUserContext.Role is not (UserRole.Teacher or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only teachers can post results.");
        }

        var student = await _dbContext.Students.FirstOrDefaultAsync(x => x.Id == request.StudentId && x.SchoolId == schoolId, cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == request.SubjectId && x.SchoolId == schoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject was not found in this school.");

        var isAuthorized = await _dbContext.TeacherAssignments.AnyAsync(x =>
            x.TeacherId == teacherId &&
            x.SubjectId == request.SubjectId &&
            x.Class == student.Class &&
            x.SchoolId == schoolId, cancellationToken);

        if (!isAuthorized)
        {
            throw new UnauthorizedAccessException("Teacher is not assigned to this subject and class.");
        }

        var teacher = await _dbContext.Users.FirstAsync(x => x.Id == teacherId, cancellationToken);
        var result = new Result
        {
            SchoolId = schoolId,
            StudentId = student.Id,
            SubjectId = subject.Id,
            TeacherId = teacher.Id,
            Score = request.Score,
            Grade = GetGrade(request.Score),
            Term = request.Term.Trim(),
            Comment = request.Comment?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Results.Add(result);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(result.Comment) || result.Score >= 0)
        {
            await _notificationService.SendAsync(new SendNotificationRequest(
                $"Result posted for {student.FullName}",
                $"{subject.Name}: {result.Score}% | Grade {result.Grade}{(string.IsNullOrWhiteSpace(result.Comment) ? string.Empty : $" | {result.Comment}")}",
                NotificationType.System,
                new[] { student.Id }), cancellationToken);
        }

        return new ResultResponse(
            result.Id,
            result.SchoolId,
            student.Id,
            student.FullName,
            student.StudentNumber,
            subject.Id,
            subject.Name,
            teacher.Id,
            teacher.DisplayName,
            result.Score,
            result.Grade,
            result.Term,
            result.Comment,
            result.CreatedAt);
    }

    public async Task<IReadOnlyList<ResultResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Results.AsNoTracking()
            : _dbContext.Results.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());

        return await query
            .Include(x => x.Student)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ResultResponse>> GetStudentResultsAsync(int studentId, CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Results.AsNoTracking()
            : _dbContext.Results.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());

        return await query
            .Where(x => x.StudentId == studentId)
            .Include(x => x.Student)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ResultResponse>> GetClassResultsAsync(string className, CancellationToken cancellationToken = default)
    {
        var query = _currentUserContext.Role == UserRole.PlatformAdmin
            ? _dbContext.Results.AsNoTracking()
            : _dbContext.Results.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());

        return await query
            .Where(x => x.Student.Class == className)
            .Include(x => x.Student)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentCommentResponse>> GetParentResultsAsync(string destination, CancellationToken cancellationToken = default)
    {
        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => x.ParentPhone == destination || x.ParentEmail == destination)
            .ToListAsync(cancellationToken);

        var studentIds = students.Select(x => x.Id).ToArray();
        var results = await _dbContext.Results.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId))
            .Include(x => x.Subject)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        return results.Select(x =>
        {
            var subject = x.Subject;
            return new StudentCommentResponse(x.Id, x.SubjectId, subject.Name, x.Score, x.Grade, x.Term, x.Comment, x.CreatedAt);
        }).ToList();
    }

    public async Task<IReadOnlyList<ParentPreviewReportResponse>> GetParentReportPreviewAsync(string destination, CancellationToken cancellationToken = default)
    {
        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => x.ParentPhone == destination || x.ParentEmail == destination)
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject)
            .Include(x => x.Results)
                .ThenInclude(x => x.Subject)
            .Include(x => x.Results)
                .ThenInclude(x => x.Teacher)
            .ToListAsync(cancellationToken);

        if (students.Count == 0)
        {
            return Array.Empty<ParentPreviewReportResponse>();
        }

        var schoolNames = await _dbContext.Schools.AsNoTracking()
            .Where(x => students.Select(student => student.SchoolId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return students.Select(student =>
        {
            var subjectRows = student.SubjectEnrollments
                .Select(enrollment => enrollment.Subject)
                .Where(subject => subject is not null)
                .GroupBy(subject => subject!.Id)
                .Select(group =>
                {
                    var subjectId = group.Key;
                    var subjectName = group.First().Name;
                    var subjectResults = student.Results
                        .Where(result => result.SubjectId == subjectId)
                        .OrderByDescending(result => result.CreatedAt)
                        .ToList();

                    var actualResult = subjectResults.FirstOrDefault();
                    var averageMark = subjectResults.Count == 0 ? 0m : Math.Round(subjectResults.Average(result => result.Score), 1);

                    return new ParentReportSubjectResponse(
                        subjectId,
                        subjectName,
                        averageMark,
                        actualResult?.Score,
                        actualResult?.Grade,
                        actualResult?.Teacher.DisplayName,
                        actualResult?.Comment,
                        actualResult?.Term,
                        actualResult?.CreatedAt);
                })
                .OrderBy(row => row.SubjectName)
                .ToList();

            if (subjectRows.Count == 0)
            {
                subjectRows = student.Results
                    .Select(result => new ParentReportSubjectResponse(
                        result.SubjectId,
                        result.Subject.Name,
                        result.Score,
                        result.Score,
                        result.Grade,
                        result.Teacher.DisplayName,
                        result.Comment,
                        result.Term,
                        result.CreatedAt))
                    .GroupBy(row => row.SubjectId)
                    .Select(group => group.OrderByDescending(item => item.CreatedAt).First())
                    .OrderBy(row => row.SubjectName)
                    .ToList();
            }

            var overallAverage = student.Results.Count == 0
                ? 0m
                : Math.Round(student.Results.Average(result => result.Score), 1);

            return new ParentPreviewReportResponse(
                student.Id,
                student.FullName,
                student.StudentNumber,
                student.Class,
                student.Level,
                student.EnrollmentYear,
                schoolNames.TryGetValue(student.SchoolId, out var schoolName) ? schoolName : $"School {student.SchoolId}",
                overallAverage,
                subjectRows);
        }).ToList();
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return schoolId;
    }

    private static string GetGrade(decimal score)
    {
        if (score >= 80) return "A";
        if (score >= 70) return "B";
        if (score >= 60) return "C";
        if (score >= 50) return "D";
        return "F";
    }
}
