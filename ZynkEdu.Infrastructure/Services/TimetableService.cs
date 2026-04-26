using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class TimetableService : ITimetableService
{
    private static readonly string[] Weekdays = new[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday" };
    private static readonly (TimeOnly Start, TimeOnly End)[] Periods = new[]
    {
        (new TimeOnly(8, 0), new TimeOnly(8, 40)),
        (new TimeOnly(8, 45), new TimeOnly(9, 25)),
        (new TimeOnly(9, 30), new TimeOnly(10, 10)),
        (new TimeOnly(10, 20), new TimeOnly(11, 0)),
        (new TimeOnly(11, 10), new TimeOnly(11, 50)),
        (new TimeOnly(12, 0), new TimeOnly(12, 40))
    };

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public TimetableService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<TimetableResponse>> GetMyTimetableAsync(string? term = null, CancellationToken cancellationToken = default)
    {
        var schoolId = RequireSchoolId();
        var query = _dbContext.TimetableSlots.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Where(x => x.SchoolId == schoolId);

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => x.Term == term.Trim());
        }

        if (_currentUserContext.Role == UserRole.Teacher && _currentUserContext.UserId is int teacherId)
        {
            query = query.Where(x => x.TeacherId == teacherId);
        }

        var slots = (await query.ToListAsync(cancellationToken))
            .OrderBy(x => DayIndex(x.DayOfWeek))
            .ThenBy(x => x.StartTime)
            .ToList();

        return slots.Select(ToResponse).ToList();
    }

    public async Task<IReadOnlyList<TimetableResponse>> GenerateAsync(GenerateTimetableRequest request, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Only school admins can generate timetables.");
        }

        var schoolId = RequireSchoolId();
        var term = request.Term.Trim();
        var assignments = await _dbContext.TeacherAssignments.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Where(x => x.SchoolId == schoolId)
            .OrderBy(x => x.Class)
            .ThenBy(x => x.Subject.Name)
            .ThenBy(x => x.Teacher.DisplayName)
            .ToListAsync(cancellationToken);

        if (assignments.Count == 0)
        {
            return Array.Empty<TimetableResponse>();
        }

        var existing = _dbContext.TimetableSlots.Where(x => x.SchoolId == schoolId && x.Term == term);
        _dbContext.TimetableSlots.RemoveRange(existing);

        var generated = assignments.Select((assignment, index) =>
        {
            var period = Periods[index % Periods.Length];
            var day = Weekdays[index % Weekdays.Length];

            return new TimetableSlot
            {
                SchoolId = schoolId,
                TeacherId = assignment.TeacherId,
                SubjectId = assignment.SubjectId,
                Class = assignment.Class,
                Term = term,
                DayOfWeek = day,
                StartTime = period.Start,
                EndTime = period.End
            };
        }).ToList();

        _dbContext.TimetableSlots.AddRange(generated);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return generated.Select(slot =>
        {
            var assignment = assignments.First(item => item.TeacherId == slot.TeacherId && item.SubjectId == slot.SubjectId && item.Class == slot.Class);
            return new TimetableResponse(
                slot.Id,
                slot.SchoolId,
                slot.TeacherId,
                assignment.Teacher.DisplayName,
                slot.SubjectId,
                assignment.Subject.Name,
                slot.Class,
                slot.Term,
                slot.DayOfWeek,
                slot.StartTime.ToString("HH:mm"),
                slot.EndTime.ToString("HH:mm"));
        }).ToList();
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return schoolId;
    }

    private static TimetableResponse ToResponse(TimetableSlot slot) => new(
        slot.Id,
        slot.SchoolId,
        slot.TeacherId,
        slot.Teacher.DisplayName,
        slot.SubjectId,
        slot.Subject.Name,
        slot.Class,
        slot.Term,
        slot.DayOfWeek,
        slot.StartTime.ToString("HH:mm"),
        slot.EndTime.ToString("HH:mm"));

    private static int DayIndex(string dayOfWeek)
    {
        var index = Array.IndexOf(Weekdays, dayOfWeek);
        return index >= 0 ? index : int.MaxValue;
    }
}
