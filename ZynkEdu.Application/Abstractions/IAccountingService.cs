using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IAccountingService
{
    Task<IReadOnlyList<FeeStructureResponse>> GetFeeStructuresAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<FeeStructureResponse> SaveFeeStructureAsync(int? schoolId, FeeStructureRequest request, CancellationToken cancellationToken = default);
    Task DeleteFeeStructureAsync(int id, CancellationToken cancellationToken = default);
    Task SendFeeStructureNewsletterAsync(
        int? schoolId,
        SendFeeStructureNewsletterRequest request,
        byte[]? newsletterPdf = null,
        string? newsletterFileName = null,
        CancellationToken cancellationToken = default);
    Task<StudentStatementResponse> GetStudentStatementAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<StudentStatementResponse> GetStudentStatementByTermAsync(int studentId, string term, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InvoiceResponse>> GetStudentInvoicesAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<FinancialStatementResponse> GetFinancialStatementAsync(int? schoolId, FinancialStatementRequest request, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostInvoiceAsync(CreateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<InvoiceResponse> UpdateInvoiceAsync(int invoiceId, UpdateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteInvoiceAsync(int invoiceId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostPaymentAsync(CreatePaymentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostAdjustmentAsync(CreateAdjustmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostRefundAsync(CreateRefundRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> ApproveTransactionAsync(int transactionId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<CollectionReportResponse> GetCollectionReportAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AgingReportResponse> GetAgingReportAsync(int? schoolId = null, DateTime? asOf = null, CancellationToken cancellationToken = default);
    Task<DailyCashReportResponse> GetDailyCashReportAsync(int? schoolId = null, DateTime? date = null, CancellationToken cancellationToken = default);
    Task<RevenueByClassReportResponse> GetRevenueByClassReportAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<DefaulterReportResponse> GetDefaultersAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostFineAsync(CreateFineRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<StudentFinancialFlagResponse> GetStudentFinancialFlagAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentFinancialFlagResponse>> GetStudentsWithOverdueInvoicesAsync(int? schoolId = null, CancellationToken cancellationToken = default);
}
