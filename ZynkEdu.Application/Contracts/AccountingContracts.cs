using System.ComponentModel.DataAnnotations;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Contracts;

public sealed record CreateAccountantRequest(
    [Required, MinLength(3)] string Username,
    [Required, MinLength(8)] string Password,
    UserRole Role,
    string? DisplayName = null,
    [EmailAddress] string? ContactEmail = null);

public sealed record FeeStructureRequest(
    [Required, MinLength(1)] string GradeLevel,
    [Required, MinLength(1)] string Term,
    [Range(0, double.MaxValue)] decimal Amount,
    string? Description = null);

public sealed record FeeStructureResponse(
    int Id,
    int SchoolId,
    string GradeLevel,
    string Term,
    decimal Amount,
    string? Description,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateInvoiceRequest(
    int StudentId,
    [Required, MinLength(1)] string Term,
    [Range(0, double.MaxValue)] decimal TotalAmount,
    DateTime DueAt,
    string? Reference = null,
    string? Description = null);

public sealed record CreatePaymentRequest(
    int StudentId,
    [Range(0, double.MaxValue)] decimal Amount,
    PaymentMethod Method,
    string? Reference = null,
    DateTime? ReceivedAt = null,
    string? Description = null);

public sealed record CreateAdjustmentRequest(
    int StudentId,
    [Range(0, double.MaxValue)] decimal Amount,
    string? Reference = null,
    string? Description = null,
    DateTime? TransactionDate = null);

public sealed record CreateRefundRequest(
    int StudentId,
    [Range(0, double.MaxValue)] decimal Amount,
    string? Reference = null,
    string? Description = null,
    DateTime? TransactionDate = null);

public sealed record AccountingTransactionResponse(
    int Id,
    int SchoolId,
    int StudentId,
    int StudentAccountId,
    AccountingTransactionType Type,
    AccountingTransactionStatus Status,
    decimal Amount,
    DateTime TransactionDate,
    string? Reference,
    string? Description,
    int CreatedByUserId,
    int? ApprovedByUserId,
    DateTime CreatedAt,
    DateTime? ApprovedAt);

public sealed record StatementLineResponse(
    int TransactionId,
    AccountingTransactionType Type,
    AccountingTransactionStatus Status,
    decimal Amount,
    DateTime TransactionDate,
    string? Reference,
    string? Description,
    decimal Debit,
    decimal Credit,
    decimal RunningBalance);

public sealed record StudentStatementResponse(
    int StudentId,
    string StudentName,
    int SchoolId,
    string Currency,
    decimal OpeningBalance,
    decimal ClosingBalance,
    IReadOnlyList<StatementLineResponse> Transactions);

public sealed record CollectionReportResponse(
    int SchoolId,
    decimal TotalBilled,
    decimal TotalCollected,
    decimal Outstanding,
    int InvoiceCount,
    int PaymentCount);

public sealed record AgingBucketResponse(
    string Bucket,
    decimal Amount,
    int InvoiceCount);

public sealed record AgingReportResponse(
    int SchoolId,
    DateTime AsOf,
    IReadOnlyList<AgingBucketResponse> Buckets);

public sealed record DailyCashMethodResponse(
    PaymentMethod Method,
    decimal Amount,
    int PaymentCount);

public sealed record DailyCashReportResponse(
    int SchoolId,
    DateTime Date,
    decimal TotalAmount,
    IReadOnlyList<DailyCashMethodResponse> Methods);

public sealed record RevenueByClassResponse(
    string ClassName,
    string GradeLevel,
    decimal Billed,
    decimal Collected,
    decimal Outstanding);

public sealed record RevenueByClassReportResponse(
    int SchoolId,
    IReadOnlyList<RevenueByClassResponse> Classes);

public sealed record DefaulterResponse(
    int StudentId,
    string StudentName,
    string ClassName,
    string GradeLevel,
    decimal Balance,
    DateTime? LastPaymentAt,
    DateTime? LastInvoiceAt);

public sealed record DefaulterReportResponse(
    int SchoolId,
    IReadOnlyList<DefaulterResponse> Students);
