using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class AcademicCalendarService : IAcademicCalendarService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public AcademicCalendarService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<AcademicTermResponse>> GetTermsAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        await EnsureDefaultTermsAsync(resolvedSchoolId, cancellationToken);

        return await _dbContext.AcademicTerms.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .OrderBy(x => x.TermNumber)
            .Select(x => new AcademicTermResponse(x.Id, x.SchoolId, x.TermNumber, x.Name, x.StartDate, x.EndDate, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<AcademicTermResponse> UpsertTermAsync(int termNumber, UpsertAcademicTermRequest request, CancellationToken cancellationToken = default)
    {
        RequireEditableRole();
        ValidateTermNumber(termNumber);

        var schoolId = RequireSchoolId();
        await EnsureDefaultTermsAsync(schoolId, cancellationToken);

        var term = await _dbContext.AcademicTerms.FirstAsync(x => x.SchoolId == schoolId && x.TermNumber == termNumber, cancellationToken);
        term.Name = request.Name.Trim();
        term.StartDate = request.StartDate;
        term.EndDate = request.EndDate;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new AcademicTermResponse(term.Id, term.SchoolId, term.TermNumber, term.Name, term.StartDate, term.EndDate, term.CreatedAt);
    }

    public async Task<IReadOnlyList<SchoolCalendarEventResponse>> GetEventsAsync(int? termId = null, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        await EnsureDefaultTermsAsync(resolvedSchoolId, cancellationToken);

        var query = _dbContext.SchoolCalendarEvents.AsNoTracking()
            .Include(x => x.AcademicTerm)
            .Where(x => x.SchoolId == resolvedSchoolId);

        if (termId is not null)
        {
            query = query.Where(x => x.AcademicTermId == termId.Value);
        }

        return await query
            .OrderByDescending(x => x.EventDate)
            .ThenBy(x => x.Title)
            .Select(x => new SchoolCalendarEventResponse(x.Id, x.SchoolId, x.AcademicTermId, x.AcademicTerm.Name, x.Title, x.Description, x.EventDate, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SchoolCalendarEventResponse> CreateEventAsync(CreateSchoolCalendarEventRequest request, CancellationToken cancellationToken = default)
    {
        RequireEditableRole();

        var schoolId = RequireSchoolId();
        await EnsureDefaultTermsAsync(schoolId, cancellationToken);

        var term = await _dbContext.AcademicTerms.FirstOrDefaultAsync(x => x.Id == request.AcademicTermId && x.SchoolId == schoolId, cancellationToken);
        if (term is null)
        {
            throw new InvalidOperationException("The selected term was not found for this school.");
        }

        var eventItem = new SchoolCalendarEvent
        {
            SchoolId = schoolId,
            AcademicTermId = term.Id,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            EventDate = request.EventDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SchoolCalendarEvents.Add(eventItem);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SchoolCalendarEventResponse(eventItem.Id, eventItem.SchoolId, eventItem.AcademicTermId, term.Name, eventItem.Title, eventItem.Description, eventItem.EventDate, eventItem.CreatedAt);
    }

    public async Task DeleteEventAsync(int id, CancellationToken cancellationToken = default)
    {
        RequireEditableRole();

        var schoolId = RequireSchoolId();
        var eventItem = await _dbContext.SchoolCalendarEvents.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == schoolId, cancellationToken)
            ?? throw new InvalidOperationException("The calendar event was not found.");

        _dbContext.SchoolCalendarEvents.Remove(eventItem);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureDefaultTermsAsync(int schoolId, CancellationToken cancellationToken)
    {
        var existingNumbers = await _dbContext.AcademicTerms.AsNoTracking()
            .Where(x => x.SchoolId == schoolId)
            .Select(x => x.TermNumber)
            .ToListAsync(cancellationToken);

        var missingTerms = Enumerable.Range(1, 3)
            .Where(termNumber => !existingNumbers.Contains(termNumber))
            .Select(termNumber => new AcademicTerm
            {
                SchoolId = schoolId,
                TermNumber = termNumber,
                Name = $"Term {termNumber}",
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (missingTerms.Count > 0)
        {
            _dbContext.AcademicTerms.AddRange(missingTerms);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private int ResolveSchoolId(int? schoolId = null)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before loading calendar data.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return resolvedSchoolId;
    }

    private int RequireSchoolId() => _currentUserContext.SchoolId is int schoolId
        ? schoolId
        : throw new UnauthorizedAccessException("A school-scoped user is required.");

    private void RequireEditableRole()
    {
        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only school admins can manage the school calendar.");
        }
    }

    private static void ValidateTermNumber(int termNumber)
    {
        if (termNumber is < 1 or > 3)
        {
            throw new InvalidOperationException("Only three terms are available in a calendar year.");
        }
    }
}
