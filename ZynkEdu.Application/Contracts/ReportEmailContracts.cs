namespace ZynkEdu.Application.Contracts;

public sealed record ReportEmailTemplate(
    string Subject,
    string TextBody,
    string HtmlBody);
