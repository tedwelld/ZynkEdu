using ZynkEdu.Application.Contracts;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class ReportEmailTemplateServiceTests
{
    [Fact]
    public void BuildParentResultSlip_IncludesStudentAndSchoolDetails()
    {
        var service = new ReportEmailTemplateService();
        var report = new ParentPreviewReportResponse(
            1,
            "Jane Doe",
            "SCH001-0007",
            "Form 1A",
            "ZGC Level",
            2024,
            "North Academy",
            78.4m,
            new[]
            {
                new ParentReportSubjectResponse(10, "Math", 80m, 84m, "A", "Mr. Nkosi", "Great work", "Term 2", DateTime.UtcNow),
                new ParentReportSubjectResponse(11, "English", 76m, 72m, "B", "Mrs. Moyo", null, "Term 2", DateTime.UtcNow)
            });

        var template = service.BuildParentResultSlip(report);

        Assert.Contains("Jane Doe", template.Subject);
        Assert.Contains("North Academy", template.TextBody);
        Assert.Contains("SCH001-0007", template.TextBody);
        Assert.Contains("Form 1A", template.HtmlBody);
        Assert.Contains("Math", template.HtmlBody);
        Assert.Contains("Overall average", template.HtmlBody);
    }
}
