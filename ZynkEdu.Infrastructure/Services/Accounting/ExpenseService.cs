using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed class ExpenseService : IExpenseService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;

    public ExpenseService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<ExpenseCategoryResponse>> GetCategoriesAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        var categories = await _dbContext.ExpenseCategories.AsNoTracking()
            .Where(c => c.SchoolId == resolvedSchoolId)
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var expenseTotals = await _dbContext.SchoolExpenses.AsNoTracking()
            .Where(e => e.SchoolId == resolvedSchoolId)
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(e => e.Amount), Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, cancellationToken);

        return categories.Select(c =>
        {
            expenseTotals.TryGetValue(c.Id, out var stats);
            return new ExpenseCategoryResponse(c.Id, c.SchoolId, c.Name, c.Description, c.IsActive, stats?.Count ?? 0, stats?.Total ?? 0, c.CreatedAt);
        }).ToList();
    }

    public async Task<ExpenseCategoryResponse> CreateCategoryAsync(SaveExpenseCategoryRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var category = new ExpenseCategory
        {
            SchoolId = resolvedSchoolId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim()
        };

        _dbContext.ExpenseCategories.Add(category);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "ExpenseCategory", category.Id.ToString(),
            $"Expense category created: {category.Name}.", cancellationToken);

        return new ExpenseCategoryResponse(category.Id, category.SchoolId, category.Name, category.Description, category.IsActive, 0, 0, category.CreatedAt);
    }

    public async Task<ExpenseCategoryResponse> UpdateCategoryAsync(int id, SaveExpenseCategoryRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var category = await _dbContext.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id && c.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense category not found.");

        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();

        await _dbContext.SaveChangesAsync(cancellationToken);

        var count = await _dbContext.SchoolExpenses.CountAsync(e => e.CategoryId == id, cancellationToken);
        var total = await _dbContext.SchoolExpenses.Where(e => e.CategoryId == id).SumAsync(e => e.Amount, cancellationToken);

        return new ExpenseCategoryResponse(category.Id, category.SchoolId, category.Name, category.Description, category.IsActive, count, total, category.CreatedAt);
    }

    public async Task DeleteCategoryAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var category = await _dbContext.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id && c.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense category not found.");

        var hasExpenses = await _dbContext.SchoolExpenses.AnyAsync(e => e.CategoryId == id, cancellationToken);
        if (hasExpenses)
            throw new InvalidOperationException("Cannot delete a category that has associated expenses. Deactivate it instead.");

        _dbContext.ExpenseCategories.Remove(category);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SchoolExpenseResponse>> GetExpensesAsync(
        int? schoolId = null,
        int? categoryId = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);

        IQueryable<SchoolExpense> query = _dbContext.SchoolExpenses.AsNoTracking()
            .Include(e => e.Category)
            .Include(e => e.RecordedBy)
            .Where(e => e.SchoolId == resolvedSchoolId);

        if (categoryId.HasValue)
            query = query.Where(e => e.CategoryId == categoryId.Value);

        if (from.HasValue)
            query = query.Where(e => e.ExpenseDate >= from.Value);

        if (to.HasValue)
            query = query.Where(e => e.ExpenseDate <= to.Value);

        var expenses = await query
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        var approvedByIds = expenses.Where(e => e.ApprovedByUserId.HasValue).Select(e => e.ApprovedByUserId!.Value).Distinct().ToList();
        var approvedByUsers = await _dbContext.Users.AsNoTracking()
            .Where(u => approvedByIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        return expenses.Select(e => MapExpense(e, approvedByUsers)).ToList();
    }

    public async Task<SchoolExpenseResponse> CreateExpenseAsync(CreateSchoolExpenseRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);
        var userId = _currentUserContext.UserId ?? throw new UnauthorizedAccessException("User context required.");

        var category = await _dbContext.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense category not found.");

        var expense = new SchoolExpense
        {
            SchoolId = resolvedSchoolId,
            CategoryId = request.CategoryId,
            Amount = request.Amount,
            Currency = request.Currency?.Trim().ToUpperInvariant() ?? "USD",
            ExpenseDate = request.ExpenseDate.Date,
            Reference = request.Reference?.Trim(),
            Description = request.Description?.Trim(),
            RecordedByUserId = userId
        };

        _dbContext.SchoolExpenses.Add(expense);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Created", "SchoolExpense", expense.Id.ToString(),
            $"Expense recorded: {expense.Amount} {expense.Currency} for {category.Name} on {expense.ExpenseDate:yyyy-MM-dd}.", cancellationToken);

        return await GetExpenseByIdAsync(expense.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task<SchoolExpenseResponse> UpdateExpenseAsync(int id, UpdateSchoolExpenseRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var expense = await _dbContext.SchoolExpenses.FirstOrDefaultAsync(e => e.Id == id && e.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense not found.");

        var category = await _dbContext.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense category not found.");

        expense.CategoryId = request.CategoryId;
        expense.Amount = request.Amount;
        expense.Currency = request.Currency?.Trim().ToUpperInvariant() ?? expense.Currency;
        expense.ExpenseDate = request.ExpenseDate.Date;
        expense.Reference = request.Reference?.Trim();
        expense.Description = request.Description?.Trim();
        expense.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Updated", "SchoolExpense", id.ToString(),
            $"Expense updated: {expense.Amount} {expense.Currency} for {category.Name}.", cancellationToken);

        return await GetExpenseByIdAsync(expense.Id, resolvedSchoolId, cancellationToken);
    }

    public async Task DeleteExpenseAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveEditableSchoolId(schoolId);

        var expense = await _dbContext.SchoolExpenses.FirstOrDefaultAsync(e => e.Id == id && e.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Expense not found.");

        _dbContext.SchoolExpenses.Remove(expense);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(resolvedSchoolId, "Deleted", "SchoolExpense", id.ToString(),
            $"Expense {id} deleted.", cancellationToken);
    }

    public async Task<ExpenseSummaryResponse> GetSummaryAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolId(schoolId);
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var startOfYear = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var expenses = await _dbContext.SchoolExpenses.AsNoTracking()
            .Include(e => e.Category)
            .Where(e => e.SchoolId == resolvedSchoolId)
            .ToListAsync(cancellationToken);

        var totalThisMonth = expenses.Where(e => e.ExpenseDate >= startOfMonth).Sum(e => e.Amount);
        var totalThisYear = expenses.Where(e => e.ExpenseDate >= startOfYear).Sum(e => e.Amount);
        var totalAllTime = expenses.Sum(e => e.Amount);
        var currency = expenses.FirstOrDefault()?.Currency ?? "USD";

        var byCategory = expenses
            .GroupBy(e => e.Category.Name)
            .Select(g => new ExpenseCategoryBreakdown(g.Key, g.Sum(e => e.Amount), g.Count()))
            .OrderByDescending(x => x.Total)
            .ToList();

        return new ExpenseSummaryResponse(totalThisMonth, totalThisYear, totalAllTime, currency, byCategory);
    }

    private async Task<SchoolExpenseResponse> GetExpenseByIdAsync(int id, int schoolId, CancellationToken cancellationToken)
    {
        var expense = await _dbContext.SchoolExpenses.AsNoTracking()
            .Include(e => e.Category)
            .Include(e => e.RecordedBy)
            .FirstAsync(e => e.Id == id, cancellationToken);

        string? approvedByName = null;
        if (expense.ApprovedByUserId.HasValue)
        {
            approvedByName = await _dbContext.Users.AsNoTracking()
                .Where(u => u.Id == expense.ApprovedByUserId.Value)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return MapExpense(expense, approvedByName is not null ? new Dictionary<int, string> { { expense.ApprovedByUserId!.Value, approvedByName } } : new Dictionary<int, string>());
    }

    private static SchoolExpenseResponse MapExpense(SchoolExpense expense, IReadOnlyDictionary<int, string> approvedByUsers)
    {
        approvedByUsers.TryGetValue(expense.ApprovedByUserId ?? -1, out var approvedByName);
        return new SchoolExpenseResponse(
            expense.Id,
            expense.SchoolId,
            expense.CategoryId,
            expense.Category.Name,
            expense.Amount,
            expense.Currency,
            expense.ExpenseDate,
            expense.Reference,
            expense.Description,
            expense.RecordedBy.DisplayName,
            approvedByName,
            expense.ApprovedAt,
            expense.CreatedAt,
            expense.UpdatedAt);
    }

    private int ResolveSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        return _currentUserContext.SchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required.");
    }

    private int ResolveEditableSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
            return schoolId ?? throw new InvalidOperationException("Choose a school.");

        if (_currentUserContext.SchoolId is not int resolvedSchoolId ||
            _currentUserContext.Role is not (UserRole.Admin or UserRole.AccountantSuper or UserRole.AccountantSenior))
            throw new UnauthorizedAccessException("Only admins and senior accountants can manage expenses.");

        return resolvedSchoolId;
    }
}
