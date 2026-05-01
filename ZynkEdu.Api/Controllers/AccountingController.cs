using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/accounting")]
[Authorize(Roles = RoleNames.AccountingOperators)]
public sealed class AccountingController : ControllerBase
{
    private readonly IAccountingService _accountingService;

    public AccountingController(IAccountingService accountingService)
    {
        _accountingService = accountingService;
    }

    [HttpGet("fee-structures")]
    public async Task<ActionResult<IReadOnlyList<FeeStructureResponse>>> GetFeeStructures([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetFeeStructuresAsync(schoolId, cancellationToken));
    }

    [HttpPost("fee-structures")]
    public async Task<ActionResult<FeeStructureResponse>> SaveFeeStructure([FromQuery] int? schoolId, [FromBody] FeeStructureRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.SaveFeeStructureAsync(schoolId, request, cancellationToken));
    }

    [HttpGet("students/{id:int}/statement")]
    public async Task<ActionResult<StudentStatementResponse>> GetStudentStatement(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetStudentStatementAsync(id, schoolId, cancellationToken));
    }

    [HttpPost("payments")]
    public async Task<ActionResult<AccountingTransactionResponse>> PostPayment([FromQuery] int? schoolId, [FromBody] CreatePaymentRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.PostPaymentAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("invoices")]
    public async Task<ActionResult<AccountingTransactionResponse>> PostInvoice([FromQuery] int? schoolId, [FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.PostInvoiceAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("adjustments")]
    public async Task<ActionResult<AccountingTransactionResponse>> PostAdjustment([FromQuery] int? schoolId, [FromBody] CreateAdjustmentRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.PostAdjustmentAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("refunds")]
    public async Task<ActionResult<AccountingTransactionResponse>> PostRefund([FromQuery] int? schoolId, [FromBody] CreateRefundRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.PostRefundAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("transactions/{transactionId:int}/approve")]
    public async Task<ActionResult<AccountingTransactionResponse>> ApproveTransaction(int transactionId, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.ApproveTransactionAsync(transactionId, schoolId, cancellationToken));
    }

    [HttpGet("reports/collection")]
    public async Task<ActionResult<CollectionReportResponse>> GetCollectionReport([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetCollectionReportAsync(schoolId, cancellationToken));
    }

    [HttpGet("reports/aging")]
    public async Task<ActionResult<AgingReportResponse>> GetAgingReport([FromQuery] int? schoolId, [FromQuery] DateTime? asOf, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetAgingReportAsync(schoolId, asOf, cancellationToken));
    }

    [HttpGet("reports/daily-cash")]
    public async Task<ActionResult<DailyCashReportResponse>> GetDailyCashReport([FromQuery] int? schoolId, [FromQuery] DateTime? date, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetDailyCashReportAsync(schoolId, date, cancellationToken));
    }

    [HttpGet("reports/revenue-by-class")]
    public async Task<ActionResult<RevenueByClassReportResponse>> GetRevenueByClassReport([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetRevenueByClassReportAsync(schoolId, cancellationToken));
    }

    [HttpGet("reports/defaulters")]
    public async Task<ActionResult<DefaulterReportResponse>> GetDefaulters([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetDefaultersAsync(schoolId, cancellationToken));
    }
}
