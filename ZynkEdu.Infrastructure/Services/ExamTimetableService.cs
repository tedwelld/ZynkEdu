using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class ExamTimetableService : IExamTimetableService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;

    public ExamTimetableService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<ExamTimetableEntryResponse>> GetAllAsync(
        int? schoolId = null,
        string? term = null,
        string? @class = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveViewSchoolId(schoolId);
        var query = BuildBaseQuery(resolvedSchoolId, term, @class);
        return await MapAsync(query, cancellationToken);
    }

    public async Task<IReadOnlyList<ExamTimetableEntryResponse>> GetMyAsync(
        string? term = null,
        CancellationToken cancellationToken = default)
    {
        var schoolId = RequireCurrentSchoolId();
        var query = BuildBaseQuery(schoolId, term, null);

        if (_currentUserContext.Role == UserRole.Teacher)
        {
            var classes = await _dbContext.TeacherAssignments.AsNoTracking()
                .Where(a => a.SchoolId == schoolId && a.TeacherId == _currentUserContext.UserId)
                .Select(a => a.Class)
                .Distinct()
                .ToListAsync(cancellationToken);

            query = query.Where(x => classes.Contains(x.Class) && x.IsPublished);
        }
        else
        {
            query = query.Where(x => x.IsPublished);
        }

        return await MapAsync(query, cancellationToken);
    }

    public async Task<ExamTimetableEntryResponse> CreateAsync(
        CreateExamTimetableEntryRequest request,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var examDate = ParseDate(request.ExamDate);
        var startTime = ParseTime(request.StartTime);
        var endTime = ParseTime(request.EndTime);

        if (endTime <= startTime)
            throw new InvalidOperationException("End time must be after start time.");

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(s => s.Id == request.SubjectId && s.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject not found in this school.");

        var entry = new ExamTimetableEntry
        {
            SchoolId = resolvedSchoolId,
            Term = request.Term.Trim(),
            Class = request.Class.Trim(),
            SubjectId = request.SubjectId,
            ExamDate = examDate,
            StartTime = startTime,
            EndTime = endTime,
            Venue = request.Venue?.Trim(),
            Notes = request.Notes?.Trim(),
            IsPublished = false
        };

        _dbContext.ExamTimetableEntries.Add(entry);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "ExamTimetableEntry", entry.Id.ToString(),
            $"Exam entry created: {subject.Name} for {entry.Class} on {entry.ExamDate} (term {entry.Term}).", cancellationToken);

        return MapEntry(entry, subject.Name);
    }

    public async Task<ExamTimetableEntryResponse> UpdateAsync(
        int id,
        UpdateExamTimetableEntryRequest request,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var entry = await _dbContext.ExamTimetableEntries.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Exam timetable entry not found.");

        var examDate = ParseDate(request.ExamDate);
        var startTime = ParseTime(request.StartTime);
        var endTime = ParseTime(request.EndTime);

        if (endTime <= startTime)
            throw new InvalidOperationException("End time must be after start time.");

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(s => s.Id == request.SubjectId && s.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Subject not found in this school.");

        entry.Term = request.Term.Trim();
        entry.Class = request.Class.Trim();
        entry.SubjectId = request.SubjectId;
        entry.ExamDate = examDate;
        entry.StartTime = startTime;
        entry.EndTime = endTime;
        entry.Venue = request.Venue?.Trim();
        entry.Notes = request.Notes?.Trim();
        entry.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "ExamTimetableEntry", id.ToString(),
            $"Exam entry updated: {subject.Name} for {entry.Class} on {entry.ExamDate}.", cancellationToken);

        return MapEntry(entry, subject.Name);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var entry = await _dbContext.ExamTimetableEntries.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Exam timetable entry not found.");

        _dbContext.ExamTimetableEntries.Remove(entry);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Deleted", "ExamTimetableEntry", id.ToString(),
            $"Exam timetable entry {id} deleted.", cancellationToken);
    }

    public async Task<IReadOnlyList<ExamTimetableEntryResponse>> PublishAsync(
        PublishExamTimetableRequest request,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var term = request.Term.Trim();

        var query = _dbContext.ExamTimetableEntries
            .Where(x => x.SchoolId == resolvedSchoolId && x.Term == term);

        if (!string.IsNullOrWhiteSpace(request.Class))
        {
            query = query.Where(x => x.Class == request.Class.Trim());
        }

        var entries = await query.ToListAsync(cancellationToken);
        if (entries.Count == 0)
            throw new InvalidOperationException("No exam timetable entries found for the selected term/class.");

        foreach (var entry in entries)
        {
            entry.IsPublished = true;
            entry.UpdatedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Published", "ExamTimetable", term,
            $"Exam timetable published for term '{term}' ({entries.Count} entries).", cancellationToken);

        var resultQuery = BuildBaseQuery(resolvedSchoolId, term, request.Class);
        return await MapAsync(resultQuery, cancellationToken);
    }

    public async Task<IReadOnlyList<ExamTimetableEntryResponse>> BulkCreateAsync(
        BulkCreateExamTimetableRequest request,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var term = request.Term.Trim();

        var subjectIds = request.Entries.Select(e => e.SubjectId).Distinct().ToList();
        var subjects = await _dbContext.Subjects.AsNoTracking()
            .Where(s => s.SchoolId == resolvedSchoolId && subjectIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, cancellationToken);

        var newEntries = new List<ExamTimetableEntry>();
        foreach (var r in request.Entries)
        {
            if (!subjects.ContainsKey(r.SubjectId))
                throw new InvalidOperationException($"Subject {r.SubjectId} not found in this school.");

            var examDate = ParseDate(r.ExamDate);
            var startTime = ParseTime(r.StartTime);
            var endTime = ParseTime(r.EndTime);

            if (endTime <= startTime)
                throw new InvalidOperationException($"End time must be after start time for subject {r.SubjectId}.");

            newEntries.Add(new ExamTimetableEntry
            {
                SchoolId = resolvedSchoolId,
                Term = term,
                Class = r.Class.Trim(),
                SubjectId = r.SubjectId,
                ExamDate = examDate,
                StartTime = startTime,
                EndTime = endTime,
                Venue = r.Venue?.Trim(),
                Notes = r.Notes?.Trim(),
                IsPublished = false
            });
        }

        _dbContext.ExamTimetableEntries.AddRange(newEntries);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "BulkCreated", "ExamTimetable", term,
            $"Bulk created {newEntries.Count} exam timetable entries for term '{term}'.", cancellationToken);

        var resultQuery = BuildBaseQuery(resolvedSchoolId, term, null);
        return await MapAsync(resultQuery, cancellationToken);
    }

    private IQueryable<ExamTimetableEntry> BuildBaseQuery(int? schoolId, string? term, string? @class)
    {
        IQueryable<ExamTimetableEntry> query = _dbContext.ExamTimetableEntries.AsNoTracking();

        if (schoolId is not null)
            query = query.Where(x => x.SchoolId == schoolId);

        if (!string.IsNullOrWhiteSpace(term))
            query = query.Where(x => x.Term == term.Trim());

        if (!string.IsNullOrWhiteSpace(@class))
            query = query.Where(x => x.Class == @class.Trim());

        return query;
    }

    private static async Task<IReadOnlyList<ExamTimetableEntryResponse>> MapAsync(IQueryable<ExamTimetableEntry> query, CancellationToken cancellationToken)
    {
        var entries = await query
            .Include(x => x.Subject)
            .OrderBy(x => x.Term)
            .ThenBy(x => x.ExamDate)
            .ThenBy(x => x.StartTime)
            .ThenBy(x => x.Class)
            .ToListAsync(cancellationToken);

        return entries.Select(e => MapEntry(e, e.Subject.Name)).ToList();
    }

    private static ExamTimetableEntryResponse MapEntry(ExamTimetableEntry e, string subjectName) =>
        new(
            e.Id,
            e.SchoolId,
            e.Term,
            e.Class,
            e.SubjectId,
            subjectName,
            e.ExamDate.ToString("yyyy-MM-dd"),
            e.StartTime.ToString("HH:mm"),
            e.EndTime.ToString("HH:mm"),
            e.Venue,
            e.Notes,
            e.IsPublished,
            e.CreatedAt,
            e.UpdatedAt);

    private int ResolveEditableSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school before editing the exam timetable.");

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not UserRole.Admin)
            throw new UnauthorizedAccessException("Only school admins and platform admins can edit exam timetables.");

        return resolvedSchoolId;
    }

    private int? ResolveViewSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId;

        return _currentUserContext.SchoolId
            ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private int RequireCurrentSchoolId()
    {
        return _currentUserContext.SchoolId
            ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private static DateOnly ParseDate(string value)
    {
        if (!DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            throw new InvalidOperationException("Invalid exam date. Use yyyy-MM-dd format.");

        return date;
    }

    private static TimeOnly ParseTime(string value)
    {
        if (!TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            throw new InvalidOperationException("Invalid time. Use HH:mm format.");

        return time;
    }
}
