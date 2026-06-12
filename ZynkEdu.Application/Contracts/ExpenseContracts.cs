using System.ComponentModel.DataAnnotations;

namespace ZynkEdu.Application.Contracts;

public sealed record ExpenseCategoryResponse(
    int Id,
    int SchoolId,
    string Name,
    string? Description,
    bool IsActive,
    int ExpenseCount,
    decimal TotalSpent,
    DateTime CreatedAt);

public sealed record SaveExpenseCategoryRequest(
    [Required, MinLength(1), MaxLength(200)] string Name,
    string? Description);

public sealed record SchoolExpenseResponse(
    int Id,
    int SchoolId,
    int CategoryId,
    string CategoryName,
    decimal Amount,
    string Currency,
    DateTime ExpenseDate,
    string? Reference,
    string? Description,
    string RecordedByName,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateSchoolExpenseRequest(
    [Required] int CategoryId,
    [Required, Range(0.01, double.MaxValue)] decimal Amount,
    string? Currency,
    [Required] DateTime ExpenseDate,
    string? Reference,
    string? Description);

public sealed record UpdateSchoolExpenseRequest(
    [Required] int CategoryId,
    [Required, Range(0.01, double.MaxValue)] decimal Amount,
    string? Currency,
    [Required] DateTime ExpenseDate,
    string? Reference,
    string? Description);

public sealed record ExpenseSummaryResponse(
    decimal TotalThisMonth,
    decimal TotalThisYear,
    decimal TotalAllTime,
    string Currency,
    IReadOnlyList<ExpenseCategoryBreakdown> ByCategory);

public sealed record ExpenseCategoryBreakdown(
    string CategoryName,
    decimal Total,
    int Count);
