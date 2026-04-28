using System.Text;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Infrastructure.Services;

public sealed class ReportEmailTemplateService : IReportEmailTemplateService
{
    public ReportEmailTemplate BuildParentResultSlip(ParentPreviewReportResponse report)
    {
        var emailSubject = $"ZynkEdu results - {report.StudentName}";
        var overallAverage = report.OverallAverageMark.ToString("0.0");

        var text = new StringBuilder()
            .AppendLine($"Hello {report.StudentName},")
            .AppendLine()
            .AppendLine("Your latest result slip is attached.")
            .AppendLine()
            .AppendLine($"School: {report.SchoolName}")
            .AppendLine($"Student number: {report.StudentNumber}")
            .AppendLine($"Class: {report.Class}")
            .AppendLine($"Level: {report.Level}")
            .AppendLine($"Enrollment year: {report.EnrollmentYear}")
            .AppendLine($"Overall average: {overallAverage}%")
            .AppendLine()
            .AppendLine("Subjects:")
            .ToString();

        foreach (var item in report.Subjects.OrderBy(x => x.SubjectName))
        {
            text += $"{item.SubjectName}: {item.ActualMark?.ToString("0.0") ?? "N/A"}%";
            if (!string.IsNullOrWhiteSpace(item.Grade))
            {
                text += $" ({item.Grade})";
            }

            if (!string.IsNullOrWhiteSpace(item.TeacherName))
            {
                text += $" - {item.TeacherName}";
            }

            if (!string.IsNullOrWhiteSpace(item.Term))
            {
                text += $" - {item.Term}";
            }

            text += Environment.NewLine;
        }

        text += Environment.NewLine + "Please log in to view the full report.";

        var htmlBuilder = new StringBuilder();
        htmlBuilder.AppendLine("<div style=\"font-family:Arial,sans-serif;color:#0f172a;line-height:1.6\">");
        htmlBuilder.AppendLine($"<h2 style=\"margin:0 0 12px\">Results for {Escape(report.StudentName)}</h2>");
        htmlBuilder.AppendLine("<p>Your latest result slip is attached.</p>");
        htmlBuilder.AppendLine("<table style=\"border-collapse:collapse;margin:16px 0;width:100%\">");
        AddRow(htmlBuilder, "School", report.SchoolName);
        AddRow(htmlBuilder, "Student number", report.StudentNumber);
        AddRow(htmlBuilder, "Class", report.Class);
        AddRow(htmlBuilder, "Level", report.Level);
        AddRow(htmlBuilder, "Enrollment year", report.EnrollmentYear.ToString());
        AddRow(htmlBuilder, "Overall average", $"{overallAverage}%");
        htmlBuilder.AppendLine("</table>");
        htmlBuilder.AppendLine("<h3 style=\"margin:20px 0 8px\">Subjects</h3>");
        htmlBuilder.AppendLine("<table style=\"border-collapse:collapse;width:100%;border:1px solid #e2e8f0\">");
        htmlBuilder.AppendLine("<thead><tr style=\"background:#2563eb;color:#fff;text-align:left\">");
        htmlBuilder.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Subject</th>");
        htmlBuilder.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Actual</th>");
        htmlBuilder.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Grade</th>");
        htmlBuilder.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Teacher</th>");
        htmlBuilder.AppendLine("<th style=\"padding:10px;border:1px solid #2563eb\">Term</th>");
        htmlBuilder.AppendLine("</tr></thead><tbody>");

        foreach (var item in report.Subjects.OrderBy(x => x.SubjectName))
        {
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(item.SubjectName)}</td>");
            htmlBuilder.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(item.ActualMark?.ToString("0.0") ?? "N/A")}%</td>");
            htmlBuilder.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(item.Grade ?? "N/A")}</td>");
            htmlBuilder.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(item.TeacherName ?? "N/A")}</td>");
            htmlBuilder.AppendLine($"<td style=\"padding:10px;border:1px solid #e2e8f0\">{Escape(item.Term ?? "N/A")}</td>");
            htmlBuilder.AppendLine("</tr>");
        }

        htmlBuilder.AppendLine("</tbody></table>");
        htmlBuilder.AppendLine("<p style=\"margin-top:16px\">Please log in to view the full report.</p>");
        htmlBuilder.AppendLine("</div>");

        return new ReportEmailTemplate(emailSubject, text.Trim(), htmlBuilder.ToString());
    }

    private static void AddRow(StringBuilder builder, string label, string value)
    {
        builder.AppendLine("<tr>");
        builder.AppendLine($"<td style=\"padding:6px 10px;border:1px solid #e2e8f0;font-weight:700;width:180px\">{Escape(label)}</td>");
        builder.AppendLine($"<td style=\"padding:6px 10px;border:1px solid #e2e8f0\">{Escape(value)}</td>");
        builder.AppendLine("</tr>");
    }

    private static string Escape(string value)
        => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);
}
