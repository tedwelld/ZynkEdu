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
    private readonly IAuditLogService _auditLogService;
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;
    private readonly IReportEmailTemplateService _reportEmailTemplateService;
    private readonly IGradingSchemeService _gradingSchemeService;

    public ResultService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        INotificationService notificationService,
        IAuditLogService auditLogService,
        IEmailSender emailSender,
        ISmsSender smsSender,
        IReportEmailTemplateService reportEmailTemplateService,
        IGradingSchemeService gradingSchemeService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _notificationService = notificationService;
        _auditLogService = auditLogService;
        _emailSender = emailSender;
        _smsSender = smsSender;
        _reportEmailTemplateService = reportEmailTemplateService;
        _gradingSchemeService = gradingSchemeService;
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

        if (!string.Equals(student.Status, "Active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(student.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The selected student is not active in this class.");
        }

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
            Grade = await _gradingSchemeService.ResolveGradeAsync(schoolId, student.Level, request.Score, cancellationToken),
            Term = request.Term.Trim(),
            Comment = request.Comment?.Trim(),
            ApprovalStatus = "Pending",
            IsLocked = false,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Results.Add(result);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(schoolId, "Created", "Result", result.Id.ToString(), $"Created result for {student.FullName} in {subject.Name} with score {result.Score}.", cancellationToken);

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
            student.Class,
            subject.Id,
            subject.Name,
            teacher.Id,
            teacher.DisplayName,
            result.Score,
            result.Grade,
            result.Term,
            result.Comment,
            result.ApprovalStatus,
            result.IsLocked,
            result.CreatedAt,
            result.CreatedAt.Year);
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
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.Student.Class, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.ApprovalStatus, x.IsLocked, x.CreatedAt, x.CreatedAt.Year))
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
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.Student.Class, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.ApprovalStatus, x.IsLocked, x.CreatedAt, x.CreatedAt.Year))
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
            .Select(x => new ResultResponse(x.Id, x.SchoolId, x.StudentId, x.Student.FullName, x.Student.StudentNumber, x.Student.Class, x.SubjectId, x.Subject.Name, x.TeacherId, x.Teacher.DisplayName, x.Score, x.Grade, x.Term, x.Comment, x.ApprovalStatus, x.IsLocked, x.CreatedAt, x.CreatedAt.Year))
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

        return await BuildParentPreviewReportsAsync(students, cancellationToken);
    }

    public async Task<ResultSlipSendResponse> SendSlipAsync(
        int studentId,
        SendResultSlipRequest request,
        byte[] slipPdf,
        string slipFileName,
        int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        if (!request.SendEmail && !request.SendSms)
        {
            throw new InvalidOperationException("Choose at least one delivery channel.");
        }

        if (slipPdf.Length == 0)
        {
            throw new InvalidOperationException("A result slip PDF is required.");
        }

        var schoolFilter = ResolveSchoolScope(schoolId);
        var studentQuery = _dbContext.Students.AsNoTracking().Where(x => x.Id == studentId);
        if (schoolFilter is not null)
        {
            studentQuery = studentQuery.Where(x => x.SchoolId == schoolFilter);
        }

        var student = await studentQuery.FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        var preview = await BuildParentPreviewReportForStudentAsync(student.Id, cancellationToken);
        var emailTemplate = _reportEmailTemplateService.BuildParentResultSlip(preview);
        var guardianContacts = await LoadPreferredGuardianContactsAsync(student.Id, cancellationToken);

        var emailSent = false;
        var smsSent = false;

        if (request.SendEmail)
        {
            var emailRecipients = guardianContacts.Select(x => x.Email).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (emailRecipients.Length == 0)
            {
                throw new InvalidOperationException("The selected student does not have a guardian email on file.");
            }

            foreach (var destination in emailRecipients)
            {
                await _emailSender.SendAsync(
                    destination,
                    emailTemplate.Subject,
                    emailTemplate.TextBody,
                    emailTemplate.HtmlBody,
                    slipPdf,
                    string.IsNullOrWhiteSpace(slipFileName) ? $"result-slip-{student.StudentNumber}.pdf" : slipFileName,
                    "application/pdf",
                    cancellationToken);
            }
            emailSent = true;
        }

        if (request.SendSms)
        {
            var smsRecipients = guardianContacts.Select(x => x.Phone).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (smsRecipients.Length == 0)
            {
                throw new InvalidOperationException("The selected student does not have a guardian phone on file.");
            }

            foreach (var destination in smsRecipients)
            {
                await _smsSender.SendAsync(
                    destination,
                    $"ZynkEdu results for {student.FullName} are ready. Please check your email or log in to view the slip.",
                    cancellationToken);
            }

            smsSent = smsRecipients.Length > 0;
        }

        return new ResultSlipSendResponse(
            student.Id,
            student.FullName,
            student.ParentEmail,
            student.ParentPhone,
            guardianContacts.Select(x => x.Email).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
            guardianContacts.Select(x => x.Phone).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
            emailSent,
            smsSent);
    }

    public async Task<ResultResponse> ApproveAsync(int id, CancellationToken cancellationToken = default)
    {
        return await UpdateApprovalStateAsync(id, "Approved", lockResult: true, cancellationToken);
    }

    public async Task<ResultResponse> RejectAsync(int id, CancellationToken cancellationToken = default)
    {
        return await UpdateApprovalStateAsync(id, "Rejected", lockResult: true, cancellationToken);
    }

    public async Task<ResultResponse> ReopenAsync(int id, CancellationToken cancellationToken = default)
    {
        return await UpdateApprovalStateAsync(id, "Pending", lockResult: false, cancellationToken);
    }

    public async Task<ResultResponse> LockAsync(int id, CancellationToken cancellationToken = default)
    {
        return await UpdateApprovalStateAsync(id, "Pending", lockResult: true, cancellationToken);
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

    private int? ResolveSchoolScope(int? requestedSchoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return requestedSchoolId;
        }

        var schoolId = RequireSchoolId();
        if (requestedSchoolId is not null && requestedSchoolId != schoolId)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return schoolId;
    }

    private async Task<ResultResponse> UpdateApprovalStateAsync(int id, string approvalStatus, bool lockResult, CancellationToken cancellationToken)
    {
        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only school admins can manage result approvals.");
        }

        var schoolId = RequireSchoolId();
        var result = await _dbContext.Results
            .Include(x => x.Student)
            .Include(x => x.Subject)
            .Include(x => x.Teacher)
            .FirstOrDefaultAsync(x => x.Id == id && x.SchoolId == schoolId, cancellationToken)
            ?? throw new InvalidOperationException("Result was not found in this school.");

        result.ApprovalStatus = approvalStatus;
        result.IsLocked = lockResult;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditLogService.LogAsync(result.SchoolId, approvalStatus, "Result", result.Id.ToString(), $"Result {result.Id} for {result.Student.FullName} in {result.Subject.Name} is {approvalStatus.ToLowerInvariant()}.", cancellationToken);

        return new ResultResponse(
            result.Id,
            result.SchoolId,
            result.StudentId,
            result.Student.FullName,
            result.Student.StudentNumber,
            result.Student.Class,
            result.SubjectId,
            result.Subject.Name,
            result.TeacherId,
            result.Teacher.DisplayName,
            result.Score,
            result.Grade,
            result.Term,
            result.Comment,
            result.ApprovalStatus,
            result.IsLocked,
            result.CreatedAt,
            result.CreatedAt.Year);
    }

    private async Task<IReadOnlyList<(string Email, string Phone)>> LoadPreferredGuardianContactsAsync(int studentId, CancellationToken cancellationToken)
    {
        var guardians = await _dbContext.Guardians.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.IsActive)
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        if (guardians.Count == 0)
        {
            return Array.Empty<(string Email, string Phone)>();
        }

        var preferredGuardian = guardians.FirstOrDefault(guardian =>
                guardian.IsPrimary && (!string.IsNullOrWhiteSpace(guardian.ParentEmail) || !string.IsNullOrWhiteSpace(guardian.ParentPhone)))
            ?? guardians.FirstOrDefault(guardian => !string.IsNullOrWhiteSpace(guardian.ParentEmail) || !string.IsNullOrWhiteSpace(guardian.ParentPhone))
            ?? guardians[0];

        return [(preferredGuardian.ParentEmail, preferredGuardian.ParentPhone)];
    }

    private async Task<IReadOnlyList<ParentPreviewReportResponse>> BuildParentPreviewReportsAsync(IEnumerable<Student> students, CancellationToken cancellationToken)
    {
        var schoolNames = await _dbContext.Schools.AsNoTracking()
            .Where(x => students.Select(student => student.SchoolId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var reports = new List<ParentPreviewReportResponse>();
        foreach (var student in students)
        {
            reports.Add(BuildParentPreviewReport(student, schoolNames));
        }

        return reports;
    }

    private async Task<ParentPreviewReportResponse> BuildParentPreviewReportForStudentAsync(int studentId, CancellationToken cancellationToken)
    {
        var student = await _dbContext.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Include(x => x.SubjectEnrollments)
                .ThenInclude(x => x.Subject)
            .Include(x => x.Results)
                .ThenInclude(x => x.Subject)
            .Include(x => x.Results)
                .ThenInclude(x => x.Teacher)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        var schoolName = await _dbContext.Schools.AsNoTracking()
            .Where(x => x.Id == student.SchoolId)
            .Select(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? $"School {student.SchoolId}";

        return BuildParentPreviewReport(student, new Dictionary<int, string> { [student.SchoolId] = schoolName });
    }

    private static ParentPreviewReportResponse BuildParentPreviewReport(Student student, IReadOnlyDictionary<int, string> schoolNames)
    {
        var studentLevel = SchoolLevelCatalog.NormalizeLevel(student.Level);
        var subjectRows = student.SubjectEnrollments
            .Select(enrollment => enrollment.Subject)
            .Where(subject => subject is not null)
            .Where(subject => SubjectMatchesStudentLevel(subject!, studentLevel))
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
                .Where(result => SubjectMatchesStudentLevel(result.Subject, studentLevel))
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
    }

    private static bool SubjectMatchesStudentLevel(Subject subject, string studentLevel)
    {
        var subjectLevel = SchoolLevelCatalog.NormalizeLevel(subject.GradeLevel);
        return subjectLevel == SchoolLevelCatalog.General || subjectLevel == studentLevel;
    }
}
