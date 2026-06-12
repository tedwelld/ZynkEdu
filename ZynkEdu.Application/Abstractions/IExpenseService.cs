using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IExpenseService
{
    Task<IReadOnlyList<ExpenseCategoryResponse>> GetCategoriesAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<ExpenseCategoryResponse> CreateCategoryAsync(SaveExpenseCategoryRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<ExpenseCategoryResponse> UpdateCategoryAsync(int id, SaveExpenseCategoryRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteCategoryAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SchoolExpenseResponse>> GetExpensesAsync(int? schoolId = null, int? categoryId = null, DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<SchoolExpenseResponse> CreateExpenseAsync(CreateSchoolExpenseRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SchoolExpenseResponse> UpdateExpenseAsync(int id, UpdateSchoolExpenseRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteExpenseAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);

    Task<ExpenseSummaryResponse> GetSummaryAsync(int? schoolId = null, CancellationToken cancellationToken = default);
}
