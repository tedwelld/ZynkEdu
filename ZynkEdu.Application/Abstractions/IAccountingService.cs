using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IAccountingService
{
    Task<IReadOnlyList<FeeStructureResponse>> GetFeeStructuresAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<FeeStructureResponse> SaveFeeStructureAsync(int? schoolId, FeeStructureRequest request, CancellationToken cancellationToken = default);
    Task<StudentStatementResponse> GetStudentStatementAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostInvoiceAsync(CreateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostPaymentAsync(CreatePaymentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostAdjustmentAsync(CreateAdjustmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> PostRefundAsync(CreateRefundRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AccountingTransactionResponse> ApproveTransactionAsync(int transactionId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<CollectionReportResponse> GetCollectionReportAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AgingReportResponse> GetAgingReportAsync(int? schoolId = null, DateTime? asOf = null, CancellationToken cancellationToken = default);
    Task<DailyCashReportResponse> GetDailyCashReportAsync(int? schoolId = null, DateTime? date = null, CancellationToken cancellationToken = default);
    Task<RevenueByClassReportResponse> GetRevenueByClassReportAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<DefaulterReportResponse> GetDefaultersAsync(int? schoolId = null, CancellationToken cancellationToken = default);
}
