using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IReportEmailTemplateService
{
    ReportEmailTemplate BuildParentResultSlip(ParentPreviewReportResponse report);
}
