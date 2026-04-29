using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Infrastructure.Persistence;
using System.Net.Mail;

namespace ZynkEdu.Infrastructure.Services;

public sealed class TimetableDispatchService : ITimetableDispatchService
{
    private static readonly string[] DayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    private readonly ZynkEduDbContext _dbContext;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<TimetableDispatchService> _logger;

    public TimetableDispatchService(ZynkEduDbContext dbContext, IEmailSender emailSender, ILogger<TimetableDispatchService> logger)
    {
        _dbContext = dbContext;
        _emailSender = emailSender;
        _logger = logger;
    }

    public async Task DispatchDueTimetablesAsync(CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var publications = await _dbContext.TimetablePublications
            .AsTracking()
            .OrderBy(x => x.SchoolId)
            .ThenBy(x => x.Term)
            .ToListAsync(cancellationToken);

        foreach (var publication in publications)
        {
            var academicTerm = await _dbContext.AcademicTerms.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SchoolId == publication.SchoolId && x.Name == publication.Term, cancellationToken);

            if (academicTerm?.StartDate is DateOnly startDate && startDate > today)
            {
                continue;
            }

            if (publication.DispatchedAt is not null && publication.DispatchedAt >= publication.PublishedAt)
            {
                continue;
            }

            var schoolName = await _dbContext.Schools.AsNoTracking()
                .Where(x => x.Id == publication.SchoolId)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken) ?? $"School {publication.SchoolId}";

            var slots = await _dbContext.TimetableSlots.AsNoTracking()
                .Include(x => x.Teacher)
                .Include(x => x.Subject)
                .Where(x => x.SchoolId == publication.SchoolId && x.Term == publication.Term)
                .ToListAsync(cancellationToken);

            if (slots.Count == 0)
            {
                continue;
            }

            var dispatchedAllTeachers = true;
            foreach (var teacherGroup in slots.GroupBy(x => x.TeacherId).OrderBy(x => x.First().Teacher.DisplayName))
            {
                var teacher = teacherGroup.First().Teacher;
                if (!TryResolveEmailDestination(teacher.Username, out var destination))
                {
                    _logger.LogWarning("Skipping timetable dispatch for teacher {TeacherId} because username {Username} is not a valid email address.", teacher.Id, teacher.Username);

                    var skippedDispatchLog = await _dbContext.TimetableDispatchLogs.FirstOrDefaultAsync(x =>
                        x.SchoolId == publication.SchoolId &&
                        x.TeacherId == teacher.Id &&
                        x.Term == publication.Term, cancellationToken);

                    if (skippedDispatchLog is null)
                    {
                        skippedDispatchLog = new TimetableDispatchLog
                        {
                            SchoolId = publication.SchoolId,
                            TeacherId = teacher.Id,
                            Term = publication.Term,
                            PublishedAt = publication.PublishedAt,
                            Attempts = 1,
                            LastError = "Skipped: teacher username is not a valid email address.",
                            DispatchedAt = DateTime.UtcNow,
                            CreatedAt = DateTime.UtcNow
                        };
                        _dbContext.TimetableDispatchLogs.Add(skippedDispatchLog);
                    }
                    else
                    {
                        skippedDispatchLog.PublishedAt = publication.PublishedAt;
                        skippedDispatchLog.Attempts++;
                        skippedDispatchLog.LastError = "Skipped: teacher username is not a valid email address.";
                        skippedDispatchLog.DispatchedAt = DateTime.UtcNow;
                    }

                    await _dbContext.SaveChangesAsync(cancellationToken);
                    continue;
                }

                var dispatchLog = await _dbContext.TimetableDispatchLogs.FirstOrDefaultAsync(x =>
                    x.SchoolId == publication.SchoolId &&
                    x.TeacherId == teacher.Id &&
                    x.Term == publication.Term, cancellationToken);

                if (dispatchLog is not null && dispatchLog.DispatchedAt is not null && dispatchLog.DispatchedAt >= publication.PublishedAt)
                {
                    continue;
                }

                if (dispatchLog is null)
                {
                    dispatchLog = new TimetableDispatchLog
                    {
                        SchoolId = publication.SchoolId,
                        TeacherId = teacher.Id,
                        Term = publication.Term,
                        PublishedAt = publication.PublishedAt,
                        Attempts = 0,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.TimetableDispatchLogs.Add(dispatchLog);
                }
                else
                {
                    dispatchLog.PublishedAt = publication.PublishedAt;
                }

                dispatchLog.Attempts++;
                dispatchLog.LastError = null;
                await _dbContext.SaveChangesAsync(cancellationToken);

                try
                {
                    var subject = $"Timetable for {schoolName} - {publication.Term}";
                    var body = BuildTextBody(schoolName, publication.Term, teacher.DisplayName, teacherGroup.ToList());
                    var html = BuildHtmlBody(schoolName, publication.Term, teacher.DisplayName, teacherGroup.ToList());

                    await _emailSender.SendAsync(destination, subject, body, html, cancellationToken);

                    dispatchLog.DispatchedAt = DateTime.UtcNow;
                    dispatchLog.LastError = null;
                    await _dbContext.SaveChangesAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    dispatchedAllTeachers = false;
                    dispatchLog.LastError = ex.Message;
                    await _dbContext.SaveChangesAsync(cancellationToken);
                    _logger.LogError(ex, "Failed to dispatch timetable for teacher {TeacherId} in school {SchoolId} term {Term}", teacher.Id, publication.SchoolId, publication.Term);
                }
            }

            if (dispatchedAllTeachers)
            {
                publication.DispatchedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
    }

    private static string BuildTextBody(string schoolName, string term, string teacherName, IReadOnlyList<TimetableSlot> slots)
    {
        var lines = new List<string>
        {
            $"Hello {teacherName},",
            string.Empty,
            $"Your timetable for {schoolName} ({term}) is ready.",
            string.Empty
        };

        foreach (var dayGroup in slots.OrderBy(slot => Array.IndexOf(DayOrder, slot.DayOfWeek)).ThenBy(slot => slot.StartTime).GroupBy(slot => slot.DayOfWeek))
        {
            lines.Add(dayGroup.Key + ":");
            foreach (var slot in dayGroup.OrderBy(slot => slot.StartTime))
            {
                lines.Add($"- {slot.StartTime:HH:mm}-{slot.EndTime:HH:mm} {slot.Subject.Name} ({slot.Class})");
            }
            lines.Add(string.Empty);
        }

        lines.Add("Please log in to view the timetable online.");
        return string.Join(Environment.NewLine, lines.Where(line => line is not null));
    }

    private static string BuildHtmlBody(string schoolName, string term, string teacherName, IReadOnlyList<TimetableSlot> slots)
    {
        var html = new System.Text.StringBuilder();
        html.AppendLine("<div style=\"font-family:Arial,sans-serif;color:#0f172a;line-height:1.6\">");
        html.AppendLine($"<h2 style=\"margin:0 0 12px\">Timetable for {Escape(schoolName)}</h2>");
        html.AppendLine($"<p>Hello {Escape(teacherName)}, your timetable for <strong>{Escape(term)}</strong> is ready.</p>");

        foreach (var dayGroup in slots.OrderBy(slot => Array.IndexOf(DayOrder, slot.DayOfWeek)).ThenBy(slot => slot.StartTime).GroupBy(slot => slot.DayOfWeek))
        {
            html.AppendLine($"<h3 style=\"margin:20px 0 8px\">{Escape(dayGroup.Key)}</h3>");
            html.AppendLine("<table style=\"border-collapse:collapse;width:100%;border:1px solid #e2e8f0\">");
            html.AppendLine("<thead><tr style=\"background:#2563eb;color:#fff;text-align:left\">");
            html.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Time</th>");
            html.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Subject</th>");
            html.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Class</th>");
            html.AppendLine("</tr></thead><tbody>");
            foreach (var slot in dayGroup.OrderBy(slot => slot.StartTime))
            {
                html.AppendLine("<tr>");
                html.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{slot.StartTime:HH\\:mm}-{slot.EndTime:HH\\:mm}</td>");
                html.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(slot.Subject.Name)}</td>");
                html.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(slot.Class)}</td>");
                html.AppendLine("</tr>");
            }
            html.AppendLine("</tbody></table>");
        }

        html.AppendLine("<p style=\"margin-top:16px\">Please log in to view the timetable online.</p>");
        html.AppendLine("</div>");
        return html.ToString();
    }

    private static bool TryResolveEmailDestination(string? username, out string destination)
    {
        destination = string.Empty;
        if (string.IsNullOrWhiteSpace(username))
        {
            return false;
        }

        var trimmed = username.Trim();
        if (!MailAddress.TryCreate(trimmed, out var mailAddress))
        {
            return false;
        }

        destination = mailAddress.Address.Trim();
        return destination.Contains('@', StringComparison.Ordinal) && destination.Contains('.', StringComparison.Ordinal);
    }

    private static string Escape(string value) => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);
}
