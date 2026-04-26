using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class DashboardService : IDashboardService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public DashboardService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<DashboardResponse> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resultsQuery = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId.HasValue
                ? _dbContext.Results.AsNoTracking().Where(x => x.SchoolId == schoolId.Value)
                : _dbContext.Results.AsNoTracking()
            : _dbContext.Results.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());

        var results = await resultsQuery
            .Include(x => x.Student)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .ToListAsync(cancellationToken);
        var resultSchoolIds = results.Select(x => x.SchoolId).Distinct().ToArray();
        var schoolNames = await _dbContext.Schools.AsNoTracking()
            .Where(x => resultSchoolIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var overallAverage = results.Count == 0 ? 0 : results.Average(x => x.Score);
        var passRate = results.Count == 0 ? 0 : results.Count(x => x.Score >= 50) * 100m / results.Count;

        var subjectPerformance = results
            .GroupBy(x => x.Subject.Name)
            .Select(group => new SubjectPerformanceDto(group.Key, group.Average(x => x.Score)))
            .OrderByDescending(x => x.AverageScore)
            .ToList();

        var classPerformance = results
            .GroupBy(x => x.Student.Class)
            .Select(group => new ClassPerformanceDto(group.Key, group.Average(x => x.Score), group.Count(x => x.Score >= 50) * 100m / group.Count()))
            .OrderByDescending(x => x.AverageScore)
            .ToList();

        var studentPerformance = results
            .GroupBy(x => new { x.StudentId, x.Student.StudentNumber, x.Student.FullName })
            .Select(group => new StudentRankingDto(group.Key.StudentId, group.Key.StudentNumber, group.Key.FullName, group.Average(x => x.Score)))
            .OrderByDescending(x => x.AverageScore)
            .ToList();

        var teacherPerformance = results
            .GroupBy(x => new { x.TeacherId, x.Teacher.DisplayName, x.Subject.Name, x.Student.Class })
            .Select(group => new TeacherPerformanceDto(group.Key.TeacherId, group.Key.DisplayName, group.Key.Name, group.Key.Class, group.Average(x => x.Score)))
            .OrderByDescending(x => x.AverageScore)
            .ToList();

        var schoolPerformance = results
            .GroupBy(x => x.SchoolId)
            .Select(group =>
            {
                var average = group.Average(x => x.Score);
                var passRateForSchool = group.Count(x => x.Score >= 50) * 100m / group.Count();
                var schoolName = schoolNames.TryGetValue(group.Key, out var name) ? name : $"School {group.Key}";
                return new SchoolPerformanceDto(group.Key, schoolName, average, passRateForSchool, group.Count());
            })
            .OrderBy(x => x.SchoolName)
            .ToList();

        return new DashboardResponse(
            overallAverage,
            passRate,
            subjectPerformance,
            classPerformance,
            studentPerformance.Take(5).ToList(),
            studentPerformance.OrderBy(x => x.AverageScore).Take(5).ToList(),
            teacherPerformance,
            schoolPerformance);
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only school admins can view the dashboard.");
        }

        return schoolId;
    }
}
