using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/expenses")]
public sealed class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;

    public ExpensesController(IExpenseService expenseService)
    {
        _expenseService = expenseService;
    }

    [HttpGet("categories")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<IReadOnlyList<ExpenseCategoryResponse>>> GetCategories([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.GetCategoriesAsync(schoolId, cancellationToken));
    }

    [HttpPost("categories")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<ExpenseCategoryResponse>> CreateCategory([FromBody] SaveExpenseCategoryRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.CreateCategoryAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("categories/{id:int}")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<ExpenseCategoryResponse>> UpdateCategory(int id, [FromBody] SaveExpenseCategoryRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.UpdateCategoryAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("categories/{id:int}")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<IActionResult> DeleteCategory(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _expenseService.DeleteCategoryAsync(id, schoolId, cancellationToken);
        return NoContent();
    }

    [HttpGet]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<IReadOnlyList<SchoolExpenseResponse>>> GetExpenses(
        [FromQuery] int? schoolId,
        [FromQuery] int? categoryId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.GetExpensesAsync(schoolId, categoryId, from, to, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<SchoolExpenseResponse>> CreateExpense([FromBody] CreateSchoolExpenseRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.CreateExpenseAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<SchoolExpenseResponse>> UpdateExpense(int id, [FromBody] UpdateSchoolExpenseRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.UpdateExpenseAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<IActionResult> DeleteExpense(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _expenseService.DeleteExpenseAsync(id, schoolId, cancellationToken);
        return NoContent();
    }

    [HttpGet("summary")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<ActionResult<ExpenseSummaryResponse>> GetSummary([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _expenseService.GetSummaryAsync(schoolId, cancellationToken));
    }
}
