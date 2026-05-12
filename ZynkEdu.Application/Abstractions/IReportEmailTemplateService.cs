using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IReportEmailTemplateService
{
    ReportEmailTemplate BuildParentResultSlip(ParentPreviewReportResponse report);
    ReportEmailTemplate BuildFeeStructureNewsletter(string schoolName, IReadOnlyList<FeeStructureResponse> feeStructures, string? note = null);
}
