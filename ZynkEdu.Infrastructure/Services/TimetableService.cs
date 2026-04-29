using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class TimetableService : ITimetableService
{
    private static readonly string[] Weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    private const int SessionCount = 9;
    private const int LessonMinutes = 35;
    private const int BreakMinutes = 5;
    private static readonly TimeOnly FirstSessionStart = new(7, 20);
    private static readonly IReadOnlyList<(TimeOnly Start, TimeOnly End)> SessionTemplates = BuildSessionTemplates();

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public TimetableService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<TimetableResponse>> GetMyTimetableAsync(string? term = null, CancellationToken cancellationToken = default)
    {
        var schoolId = RequireCurrentSchoolId();
        var query = BuildTimetableQuery(schoolId, term);

        if (_currentUserContext.Role == UserRole.Teacher && _currentUserContext.UserId is int teacherId)
        {
            query = query.Where(x => x.TeacherId == teacherId);
        }

        return await MapTimetableAsync(query, schoolId, cancellationToken);
    }

    public async Task<IReadOnlyList<TimetableResponse>> GetAllAsync(int? schoolId = null, string? term = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveViewSchoolId(schoolId);
        var query = BuildTimetableQuery(resolvedSchoolId, term);
        return await MapTimetableAsync(query, resolvedSchoolId, cancellationToken);
    }

    public async Task<IReadOnlyList<TimetableResponse>> GenerateAsync(GenerateTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var term = NormalizeTerm(request.Term);
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var plans = await LoadGenerationPlansAsync(resolvedSchoolId, cancellationToken);
            if (plans.Count == 0)
            {
                throw new InvalidOperationException("Assign subjects and teachers before generating the timetable.");
            }

            var existingSlots = await _dbContext.TimetableSlots
                .Where(x => x.SchoolId == resolvedSchoolId && x.Term == term)
                .ToListAsync(cancellationToken);

            _dbContext.TimetableSlots.RemoveRange(existingSlots);

            var generatedSlots = GenerateSlots(resolvedSchoolId, term, plans);
            _dbContext.TimetableSlots.AddRange(generatedSlots);

            await UpsertPublicationAsync(resolvedSchoolId, term, DateTime.UtcNow, null, createApprovalNotification: false, cancellationToken: cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return await MapTimetableAsync(BuildTimetableQuery(resolvedSchoolId, term), resolvedSchoolId, cancellationToken);
        });
    }

    public async Task<TimetableResponse> CreateAsync(UpsertTimetableSlotRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var term = NormalizeTerm(request.Term);
        var dayOfWeek = NormalizeDay(request.DayOfWeek);
        var (startTime, endTime) = NormalizeTimeSlot(request.StartTime, request.EndTime);

        await ValidateManualSlotAsync(resolvedSchoolId, request.TeacherId, request.SubjectId, request.Class, term, dayOfWeek, startTime, endTime, null, cancellationToken);

        var slot = new TimetableSlot
        {
            SchoolId = resolvedSchoolId,
            TeacherId = request.TeacherId,
            SubjectId = request.SubjectId,
            Class = request.Class.Trim(),
            Term = term,
            DayOfWeek = dayOfWeek,
            StartTime = startTime,
            EndTime = endTime
        };

        _dbContext.TimetableSlots.Add(slot);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await MapTimetableSlotAsync(slot.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task<TimetableResponse> UpdateAsync(int id, UpsertTimetableSlotRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var slot = await _dbContext.TimetableSlots.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("The timetable slot was not found in this school.");

        var term = NormalizeTerm(request.Term);
        var dayOfWeek = NormalizeDay(request.DayOfWeek);
        var (startTime, endTime) = NormalizeTimeSlot(request.StartTime, request.EndTime);

        await ValidateManualSlotAsync(resolvedSchoolId, request.TeacherId, request.SubjectId, request.Class, term, dayOfWeek, startTime, endTime, id, cancellationToken);

        slot.TeacherId = request.TeacherId;
        slot.SubjectId = request.SubjectId;
        slot.Class = request.Class.Trim();
        slot.Term = term;
        slot.DayOfWeek = dayOfWeek;
        slot.StartTime = startTime;
        slot.EndTime = endTime;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await MapTimetableSlotAsync(slot.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var slot = await _dbContext.TimetableSlots.FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("The timetable slot was not found in this school.");

        _dbContext.TimetableSlots.Remove(slot);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<TimetablePublicationResponse> PublishAsync(PublishTimetableRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var term = NormalizeTerm(request.Term);
        return await UpsertPublicationAsync(resolvedSchoolId, term, DateTime.UtcNow, null, createApprovalNotification: true, cancellationToken: cancellationToken);
    }

    private async Task<IReadOnlyList<TimetableResponse>> MapTimetableAsync(IQueryable<TimetableSlot> query, int? schoolId, CancellationToken cancellationToken)
    {
        var classLevels = await LoadClassLevelLookupAsync(schoolId, cancellationToken);
        var slots = await query
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .ToListAsync(cancellationToken);

        return slots
            .OrderBy(x => GetLevelSortOrder(ResolveGradeLevel(x.SchoolId, x.Class, classLevels)))
            .ThenBy(x => x.Class)
            .ThenBy(x => x.Term)
            .ThenBy(x => Array.IndexOf(Weekdays, x.DayOfWeek))
            .ThenBy(x => x.StartTime)
            .Select(x => new TimetableResponse(
                x.Id,
                x.SchoolId,
                x.TeacherId,
                x.Teacher.DisplayName,
                x.SubjectId,
                x.Subject.Name,
                x.Class,
                ResolveGradeLevel(x.SchoolId, x.Class, classLevels),
                x.Term,
                x.DayOfWeek,
                x.StartTime.ToString("HH:mm"),
                x.EndTime.ToString("HH:mm")))
            .ToList();
    }

    private async Task<TimetableResponse> MapTimetableSlotAsync(int slotId, int? schoolId, CancellationToken cancellationToken)
    {
        var classLevels = await LoadClassLevelLookupAsync(schoolId, cancellationToken);
        var slot = await _dbContext.TimetableSlots.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .FirstAsync(x => x.Id == slotId, cancellationToken);

        return new TimetableResponse(
            slot.Id,
            slot.SchoolId,
            slot.TeacherId,
            slot.Teacher.DisplayName,
            slot.SubjectId,
            slot.Subject.Name,
            slot.Class,
            ResolveGradeLevel(slot.SchoolId, slot.Class, classLevels),
            slot.Term,
            slot.DayOfWeek,
            slot.StartTime.ToString("HH:mm"),
            slot.EndTime.ToString("HH:mm"));
    }

    private IQueryable<TimetableSlot> BuildTimetableQuery(int? schoolId, string? term)
    {
        IQueryable<TimetableSlot> query = _dbContext.TimetableSlots.AsNoTracking();

        if (schoolId is not null)
        {
            query = query.Where(x => x.SchoolId == schoolId);
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => x.Term == NormalizeTerm(term));
        }

        return query;
    }

    private async Task<IReadOnlyList<ClassTimetablePlan>> LoadGenerationPlansAsync(int schoolId, CancellationToken cancellationToken)
    {
        var classes = await _dbContext.SchoolClasses.AsNoTracking()
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .Where(x => x.SchoolId == schoolId && x.IsActive)
            .ToListAsync(cancellationToken);

        classes = classes
            .OrderBy(x => GetLevelSortOrder(x.GradeLevel))
            .ThenBy(x => x.Name)
            .ToList();

        var activeTeachers = await _dbContext.Users.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.Role == UserRole.Teacher && x.IsActive)
            .OrderBy(x => x.DisplayName)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        if (activeTeachers.Count == 0)
        {
            throw new InvalidOperationException("Add at least one active teacher before generating the timetable.");
        }

        var assignments = await _dbContext.TeacherAssignments.AsNoTracking()
            .Include(x => x.Teacher)
            .Include(x => x.Subject)
            .Where(x => x.SchoolId == schoolId)
            .ToListAsync(cancellationToken);

        var teacherLoad = assignments
            .GroupBy(x => x.TeacherId)
            .ToDictionary(group => group.Key, group => group.Count());

        var subjectTeacherHistory = assignments
            .GroupBy(x => x.SubjectId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .Select(x => x.TeacherId)
                    .Distinct()
                    .ToHashSet());

        var assignmentLookup = assignments
            .GroupBy(x => BuildAssignmentKey(x.SubjectId, x.Class), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var plans = new List<ClassTimetablePlan>();

        foreach (var schoolClass in classes)
        {
            var normalizedLevel = SchoolLevelCatalog.NormalizeLevel(schoolClass.GradeLevel);
            var subjectEntries = schoolClass.Subjects
                .Where(x => x.Subject is not null)
                .OrderBy(x => x.Subject.Name)
                .ToList();

            if (subjectEntries.Count == 0)
            {
                continue;
            }

            var classAssignments = new List<SubjectCoveragePlan>();
            foreach (var classSubject in subjectEntries)
            {
                var subject = classSubject.Subject ?? throw new InvalidOperationException("A selected class subject is missing its subject record.");
                var assignmentKey = BuildAssignmentKey(classSubject.SubjectId, schoolClass.Name);
                AppUser? assignmentTeacher = null;
                if (!assignmentLookup.TryGetValue(assignmentKey, out var assignment))
                {
                    assignmentTeacher = SelectAutoAssignedTeacher(activeTeachers, teacherLoad, subjectTeacherHistory, subject);
                    assignment = new TeacherAssignment
                    {
                        SchoolId = schoolId,
                        TeacherId = assignmentTeacher.Id,
                        SubjectId = classSubject.SubjectId,
                        Class = schoolClass.Name
                    };

                    _dbContext.TeacherAssignments.Add(assignment);
                    assignments.Add(assignment);
                    assignmentLookup[assignmentKey] = assignment;
                    teacherLoad[assignmentTeacher.Id] = teacherLoad.TryGetValue(assignmentTeacher.Id, out var currentLoad) ? currentLoad + 1 : 1;

                    if (!subjectTeacherHistory.TryGetValue(classSubject.SubjectId, out var teacherIds))
                    {
                        teacherIds = new HashSet<int>();
                        subjectTeacherHistory[classSubject.SubjectId] = teacherIds;
                    }

                    teacherIds.Add(assignmentTeacher.Id);
                }
                else
                {
                    assignmentTeacher = assignment.Teacher ?? activeTeachers.FirstOrDefault(teacher => teacher.Id == assignment.TeacherId)
                        ?? throw new InvalidOperationException("The selected teacher record could not be loaded.");
                }

                classAssignments.Add(new SubjectCoveragePlan(
                    normalizedLevel,
                    assignment.TeacherId,
                    assignmentTeacher.DisplayName,
                    classSubject.SubjectId,
                    subject.Name,
                    NormalizeWeeklyLoad(subject.WeeklyLoad)));
            }

            if (classAssignments.Count > 0)
            {
                plans.Add(new ClassTimetablePlan(schoolClass.Name, normalizedLevel, classAssignments));
            }
        }

        return plans;
    }

    private List<TimetableSlot> GenerateSlots(int schoolId, string term, IReadOnlyList<ClassTimetablePlan> plans)
    {
        var teacherOccupancy = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var generated = new List<TimetableSlot>();
        var schoolDayCounts = new int[Weekdays.Length];

        foreach (var plan in plans.OrderBy(x => GetLevelSortOrder(x.GradeLevel)).ThenBy(x => x.ClassName))
        {
            var classOccupancy = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var classDayCounts = new int[Weekdays.Length];
            var subjectLoads = plan.Subjects
                .OrderByDescending(x => x.WeeklyLoad)
                .ThenBy(x => x.SubjectName)
                .ToList();

            var totalSessions = subjectLoads.Sum(x => x.WeeklyLoad);
            if (totalSessions > SessionTemplates.Count * Weekdays.Length)
            {
                throw new InvalidOperationException($"The class {plan.ClassName} needs more timetable sessions than are available in a school week.");
            }

            foreach (var subject in subjectLoads)
            {
                for (var occurrence = 0; occurrence < subject.WeeklyLoad; occurrence++)
                {
                    var slot = FindAvailableSlot(plan.ClassName, subject, occurrence, schoolDayCounts, classDayCounts, classOccupancy, teacherOccupancy);
                    if (slot is null)
                    {
                        throw new InvalidOperationException($"Unable to place {subject.SubjectName} for {plan.ClassName} without a clash. Check teacher coverage and weekly load.");
                    }

                    generated.Add(new TimetableSlot
                    {
                        SchoolId = schoolId,
                        TeacherId = subject.TeacherId,
                        SubjectId = subject.SubjectId,
                        Class = plan.ClassName,
                        Term = term,
                        DayOfWeek = slot.DayOfWeek,
                        StartTime = slot.StartTime,
                        EndTime = slot.EndTime
                    });

                    classOccupancy.Add(BuildOccupancyKey(slot.DayOfWeek, slot.StartTime));
                    teacherOccupancy.Add(BuildTeacherOccupancyKey(subject.TeacherId, slot.DayOfWeek, slot.StartTime));
                    schoolDayCounts[Array.IndexOf(Weekdays, slot.DayOfWeek)]++;
                    classDayCounts[Array.IndexOf(Weekdays, slot.DayOfWeek)]++;
                }
            }
        }

        return generated;
    }

    private SlotTemplate? FindAvailableSlot(
        string className,
        SubjectCoveragePlan subject,
        int occurrence,
        int[] schoolDayCounts,
        int[] classDayCounts,
        HashSet<string> classOccupancy,
        HashSet<string> teacherOccupancy)
    {
        var preferredDays = GetPreferredDayOrder(className, subject.SubjectName, occurrence);
        var sessionOrder = GetPreferredSessionOrder(className, subject.SubjectName, occurrence);
        var dayRanks = preferredDays
            .Select((dayIndex, rank) => new { dayIndex, rank })
            .ToDictionary(item => item.dayIndex, item => item.rank);

        foreach (var dayIndex in preferredDays
                     .OrderBy(dayIndex => schoolDayCounts[dayIndex])
                     .ThenBy(dayIndex => classDayCounts[dayIndex])
                     .ThenBy(dayIndex => dayRanks[dayIndex]))
        {
            foreach (var sessionIndex in sessionOrder)
            {
                var template = SessionTemplates[sessionIndex];
                var dayName = Weekdays[dayIndex];
                var classKey = BuildOccupancyKey(dayName, template.Start);
                var teacherKey = BuildTeacherOccupancyKey(subject.TeacherId, dayName, template.Start);

                if (classOccupancy.Contains(classKey) || teacherOccupancy.Contains(teacherKey))
                {
                    continue;
                }

                return new SlotTemplate(dayName, template.Start, template.End);
            }
        }

        return null;
    }

    private async Task<IReadOnlyDictionary<string, string>> LoadClassLevelLookupAsync(int? schoolId, CancellationToken cancellationToken)
    {
        var query = _dbContext.SchoolClasses.AsNoTracking();
        if (schoolId is not null)
        {
            query = query.Where(x => x.SchoolId == schoolId);
        }

        var classes = await query
            .Select(x => new { x.SchoolId, x.Name, x.GradeLevel })
            .ToListAsync(cancellationToken);

        var lookup = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var schoolClass in classes)
        {
            lookup[BuildClassLookupKey(schoolClass.SchoolId, schoolClass.Name)] = SchoolLevelCatalog.NormalizeLevel(schoolClass.GradeLevel);
        }

        return lookup;
    }

    private static string ResolveGradeLevel(int schoolId, string className, IReadOnlyDictionary<string, string> classLevels)
    {
        return classLevels.TryGetValue(BuildClassLookupKey(schoolId, className), out var gradeLevel)
            ? gradeLevel
            : SchoolLevelCatalog.General;
    }

    private static IReadOnlyList<int> GetPreferredDayOrder(string className, string subjectName, int occurrence)
    {
        var seed = StableHash($"{className}|{subjectName}|{occurrence}");
        return Enumerable.Range(0, Weekdays.Length)
            .Select(index => (index + seed) % Weekdays.Length)
            .ToArray();
    }

    private static IReadOnlyList<int> GetPreferredSessionOrder(string className, string subjectName, int occurrence)
    {
        var seed = StableHash($"{className}|{subjectName}|{occurrence}");
        return Enumerable.Range(0, SessionTemplates.Count)
            .Select(index => (index + seed) % SessionTemplates.Count)
            .ToArray();
    }

    private async Task ValidateManualSlotAsync(
        int schoolId,
        int teacherId,
        int subjectId,
        string className,
        string term,
        string dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        int? excludeSlotId,
        CancellationToken cancellationToken)
    {
        var schoolClass = await _dbContext.SchoolClasses
            .Include(x => x.Subjects)
                .ThenInclude(x => x.Subject)
            .FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Name == className, cancellationToken)
            ?? throw new InvalidOperationException("The selected class was not found in this school.");

        if (!schoolClass.IsActive)
        {
            throw new InvalidOperationException("The selected class is not active.");
        }

        var teacher = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == teacherId && x.SchoolId == schoolId, cancellationToken);
        if (teacher is null || teacher.Role != UserRole.Teacher)
        {
            throw new InvalidOperationException("Teacher was not found in this school.");
        }

        var subject = await _dbContext.Subjects.FirstOrDefaultAsync(x => x.Id == subjectId && x.SchoolId == schoolId, cancellationToken);
        if (subject is null)
        {
            throw new InvalidOperationException("Subject was not found in this school.");
        }

        EnsureClassHasSubjects(schoolClass);
        EnsureSubjectMatchesClassLevel(subject.GradeLevel, schoolClass.GradeLevel);
        EnsureSubjectIsAssignedToClass(subjectId, schoolClass);
        await EnsureTeacherCoverageAsync(schoolId, teacherId, subjectId, className, cancellationToken);
        EnsureSessionTemplate(startTime, endTime);
        await EnsureNoSlotCollisionAsync(schoolId, term, dayOfWeek, startTime, teacherId, className, excludeSlotId, cancellationToken);
    }

    private async Task EnsureTeacherCoverageAsync(int schoolId, int teacherId, int subjectId, string className, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.TeacherAssignments.AsNoTracking()
            .AnyAsync(x => x.SchoolId == schoolId && x.TeacherId == teacherId && x.SubjectId == subjectId && x.Class == className, cancellationToken);

        if (!exists)
        {
            throw new InvalidOperationException("Assign the selected subject to the teacher before creating timetable slots.");
        }
    }

    private async Task EnsureNoSlotCollisionAsync(
        int schoolId,
        string term,
        string dayOfWeek,
        TimeOnly startTime,
        int teacherId,
        string className,
        int? excludeSlotId,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.TimetableSlots.AsNoTracking()
            .Where(x => x.SchoolId == schoolId && x.Term == term && x.DayOfWeek == dayOfWeek && x.StartTime == startTime);

        if (excludeSlotId is not null)
        {
            query = query.Where(x => x.Id != excludeSlotId.Value);
        }

        var teacherCollision = await query.AnyAsync(x => x.TeacherId == teacherId, cancellationToken);
        if (teacherCollision)
        {
            throw new InvalidOperationException("The teacher is already scheduled at this time.");
        }

        var classCollision = await query.AnyAsync(x => x.Class == className, cancellationToken);
        if (classCollision)
        {
            throw new InvalidOperationException("The class is already scheduled at this time.");
        }
    }

    private static void EnsureClassHasSubjects(SchoolClass schoolClass)
    {
        if (schoolClass.Subjects.Count == 0)
        {
            throw new InvalidOperationException("Assign subjects to the selected class before creating timetable slots.");
        }
    }

    private static void EnsureSubjectMatchesClassLevel(string subjectLevel, string classLevel)
    {
        var normalizedSubjectLevel = SchoolLevelCatalog.NormalizeLevel(subjectLevel);
        var normalizedClassLevel = SchoolLevelCatalog.NormalizeLevel(classLevel);

        if (normalizedSubjectLevel == SchoolLevelCatalog.General)
        {
            return;
        }

        if (!string.Equals(normalizedSubjectLevel, normalizedClassLevel, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"The selected subject is for {normalizedSubjectLevel}, which does not match the selected class level.");
        }
    }

    private static void EnsureSubjectIsAssignedToClass(int subjectId, SchoolClass schoolClass)
    {
        if (schoolClass.Subjects.All(link => link.SubjectId != subjectId))
        {
            throw new InvalidOperationException("The selected subject is not assigned to the selected class.");
        }
    }

    private static void EnsureSessionTemplate(TimeOnly startTime, TimeOnly endTime)
    {
        if (!SessionTemplates.Any(template => template.Start == startTime && template.End == endTime))
        {
            throw new InvalidOperationException("Timetable slots must use the school session template with 5-minute breaks.");
        }
    }

    private static string NormalizeTerm(string term)
    {
        var value = term.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException("Choose a timetable term.");
        }

        return value;
    }

    private static string NormalizeDay(string dayOfWeek)
    {
        var value = dayOfWeek.Trim();
        if (!Weekdays.Contains(value, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Choose a valid school day for the timetable slot.");
        }

        return Weekdays.First(day => string.Equals(day, value, StringComparison.OrdinalIgnoreCase));
    }

    private static (TimeOnly Start, TimeOnly End) NormalizeTimeSlot(string startTime, string endTime)
    {
        if (!TimeOnly.TryParseExact(startTime.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
        {
            throw new InvalidOperationException("Choose a valid start time for the timetable slot.");
        }

        if (!TimeOnly.TryParseExact(endTime.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
        {
            throw new InvalidOperationException("Choose a valid end time for the timetable slot.");
        }

        return (start, end);
    }

    private async Task<TimetablePublicationResponse> UpsertPublicationAsync(
        int schoolId,
        string term,
        DateTime publishedAt,
        DateTime? dispatchedAt,
        bool createApprovalNotification,
        CancellationToken cancellationToken)
    {
        var publication = await _dbContext.TimetablePublications.FirstOrDefaultAsync(x => x.SchoolId == schoolId && x.Term == term, cancellationToken);
        if (publication is null)
        {
            publication = new TimetablePublication
            {
                SchoolId = schoolId,
                Term = term,
                PublishedAt = publishedAt,
                DispatchedAt = dispatchedAt,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.TimetablePublications.Add(publication);
        }
        else
        {
            publication.PublishedAt = publishedAt;
            publication.DispatchedAt = dispatchedAt;
        }

        if (createApprovalNotification)
        {
            await UpsertTimetableApprovalNotificationAsync(schoolId, term, publishedAt, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new TimetablePublicationResponse(publication.SchoolId, publication.Term, publication.PublishedAt, publication.DispatchedAt);
    }

    private async Task UpsertTimetableApprovalNotificationAsync(int schoolId, string term, DateTime publishedAt, CancellationToken cancellationToken)
    {
        var title = $"Timetable approved for {term}";
        var message = $"The timetable for {term} has been approved and is now available in your profile and notifications.";

        var notification = await _dbContext.Notifications.FirstOrDefaultAsync(x =>
            x.SchoolId == schoolId &&
            x.Type == NotificationType.System &&
            x.Title == title, cancellationToken);

        if (notification is null)
        {
            notification = new Notification
            {
                SchoolId = schoolId,
                Title = title,
                Message = message,
                Type = NotificationType.System,
                CreatedBy = _currentUserContext.UserId ?? 0,
                CreatedAt = publishedAt
            };

            _dbContext.Notifications.Add(notification);
            return;
        }

        notification.Message = message;
        notification.CreatedBy = _currentUserContext.UserId ?? notification.CreatedBy;
        notification.CreatedAt = publishedAt;
    }

    private int ResolveEditableSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving the timetable.");
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId || _currentUserContext.Role is not UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Only school admins and platform admins can edit timetables.");
        }

        return resolvedSchoolId;
    }

    private int? ResolveViewSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId;
        }

        if (_currentUserContext.SchoolId is not int resolvedSchoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return resolvedSchoolId;
    }

    private int RequireCurrentSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return schoolId;
    }

    private static string BuildOccupancyKey(string dayOfWeek, TimeOnly startTime) => $"{dayOfWeek.Trim().ToUpperInvariant()}|{startTime:HH\\:mm}";

    private static string BuildTeacherOccupancyKey(int teacherId, string dayOfWeek, TimeOnly startTime) => $"{teacherId}|{BuildOccupancyKey(dayOfWeek, startTime)}";

    private static string BuildAssignmentKey(int subjectId, string className) => $"{subjectId}|{className.Trim()}";

    private static AppUser SelectAutoAssignedTeacher(
        IReadOnlyList<AppUser> activeTeachers,
        IReadOnlyDictionary<int, int> teacherLoad,
        IReadOnlyDictionary<int, HashSet<int>> subjectTeacherHistory,
        Subject subject)
    {
        var candidateTeachers = activeTeachers.Select(teacher =>
        {
            var load = teacherLoad.TryGetValue(teacher.Id, out var currentLoad) ? currentLoad : 0;
            var subjectAffinity = subjectTeacherHistory.TryGetValue(subject.Id, out var teachersForSubject) && teachersForSubject.Contains(teacher.Id) ? 1 : 0;

            return new
            {
                Teacher = teacher,
                Load = load,
                SubjectAffinity = subjectAffinity
            };
        });

        return candidateTeachers
            .OrderByDescending(x => x.SubjectAffinity)
            .ThenBy(x => x.Load)
            .ThenBy(x => x.Teacher.DisplayName)
            .ThenBy(x => x.Teacher.Id)
            .Select(x => x.Teacher)
            .First();
    }

    private static int StableHash(string value)
    {
        unchecked
        {
            var hash = 23;
            foreach (var character in value)
            {
                hash = (hash * 31) + character;
            }

            return Math.Abs(hash);
        }
    }

    private static int NormalizeWeeklyLoad(int weeklyLoad)
    {
        if (weeklyLoad is < 1 or > 9)
        {
            throw new InvalidOperationException("The subject weekly load must be between 1 and 9.");
        }

        return weeklyLoad;
    }

    private sealed record ClassTimetablePlan(string ClassName, string GradeLevel, IReadOnlyList<SubjectCoveragePlan> Subjects);

    private sealed record SubjectCoveragePlan(string GradeLevel, int TeacherId, string TeacherName, int SubjectId, string SubjectName, int WeeklyLoad);

    private sealed record SlotTemplate(string DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);

    private static int GetLevelSortOrder(string? level)
    {
        return SchoolLevelCatalog.NormalizeLevel(level) switch
        {
            var value when value == SchoolLevelCatalog.ZgcLevel => 0,
            var value when value == SchoolLevelCatalog.OLevel => 1,
            var value when value == SchoolLevelCatalog.ALevel => 2,
            var value when value == SchoolLevelCatalog.General => 3,
            _ => 4
        };
    }

    private static IReadOnlyList<(TimeOnly Start, TimeOnly End)> BuildSessionTemplates()
    {
        return new[]
        {
            (new TimeOnly(7, 20), new TimeOnly(7, 55)),
            (new TimeOnly(7, 55), new TimeOnly(8, 30)),
            (new TimeOnly(8, 30), new TimeOnly(9, 5)),
            (new TimeOnly(9, 5), new TimeOnly(9, 40)),
            (new TimeOnly(9, 40), new TimeOnly(10, 15)),
            (new TimeOnly(10, 50), new TimeOnly(11, 25)),
            (new TimeOnly(11, 25), new TimeOnly(12, 0)),
            (new TimeOnly(12, 0), new TimeOnly(12, 35)),
            (new TimeOnly(12, 35), new TimeOnly(13, 10))
        };
    }

    private static string BuildClassLookupKey(int schoolId, string className) => $"{schoolId}|{className.Trim().ToUpperInvariant()}";
}
