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

    [HttpPost("fee-structures/newsletter")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> SendFeeStructureNewsletter(
        [FromQuery] int? schoolId,
        [FromForm] SendFeeStructureNewsletterRequest request,
        [FromForm] IFormFile? newsletterPdf,
        CancellationToken cancellationToken)
    {
        byte[]? pdfBytes = null;
        string? fileName = null;
        if (newsletterPdf is not null)
        {
            await using var stream = new MemoryStream();
            await newsletterPdf.CopyToAsync(stream, cancellationToken);
            pdfBytes = stream.ToArray();
            fileName = newsletterPdf.FileName;
        }

        await _accountingService.SendFeeStructureNewsletterAsync(schoolId, request, pdfBytes, fileName, cancellationToken);
        return NoContent();
    }

    [HttpGet("students/{id:int}/statement")]
    public async Task<ActionResult<StudentStatementResponse>> GetStudentStatement(int id, [FromQuery] int? schoolId, [FromQuery] string? term, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(term))
        {
            return Ok(await _accountingService.GetStudentStatementByTermAsync(id, term, schoolId, cancellationToken));
        }
        return Ok(await _accountingService.GetStudentStatementAsync(id, schoolId, cancellationToken));
    }

    [HttpGet("students/{id:int}/invoices")]
    public async Task<ActionResult<IReadOnlyList<InvoiceResponse>>> GetStudentInvoices(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetStudentInvoicesAsync(id, schoolId, cancellationToken));
    }

    [HttpGet("reports/statement")]
    public async Task<ActionResult<FinancialStatementResponse>> GetFinancialStatement(
        [FromQuery] int? schoolId,
        [FromQuery] FinancialStatementRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.GetFinancialStatementAsync(schoolId, request, cancellationToken));
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

    [HttpPut("invoices/{invoiceId:int}")]
    public async Task<ActionResult<InvoiceResponse>> UpdateInvoice(int invoiceId, [FromQuery] int? schoolId, [FromBody] UpdateInvoiceRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _accountingService.UpdateInvoiceAsync(invoiceId, request, schoolId, cancellationToken));
    }

    [HttpDelete("invoices/{invoiceId:int}")]
    public async Task<IActionResult> DeleteInvoice(int invoiceId, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _accountingService.DeleteInvoiceAsync(invoiceId, schoolId, cancellationToken);
        return NoContent();
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
