using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/results")]
[Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
public sealed class ResultsController : ControllerBase
{
    private readonly IResultService _resultService;

    public ResultsController(IResultService resultService)
    {
        _resultService = resultService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ResultResponse>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await _resultService.GetAllAsync(cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.TeacherOrPlatformAdmin)]
    public async Task<ActionResult<ResultResponse>> Create([FromBody] CreateResultRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.CreateAsync(request, cancellationToken));
    }

    [HttpGet("student/{id:int}")]
    public async Task<ActionResult<IReadOnlyList<ResultResponse>>> GetStudentResults(int id, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.GetStudentResultsAsync(id, cancellationToken));
    }

    [HttpGet("class/{className}")]
    public async Task<ActionResult<IReadOnlyList<ResultResponse>>> GetClassResults(string className, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.GetClassResultsAsync(className, cancellationToken));
    }

    [HttpPost("{id:int}/send-slip")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ResultSlipSendResponse>> SendSlip(
        int id,
        [FromForm] SendResultSlipRequest request,
        [FromForm] IFormFile slipPdf,
        [FromForm] IFormFile? newsletterPdf,
        [FromForm] IFormFile? statementPdf,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        await using var stream = new MemoryStream();
        await slipPdf.CopyToAsync(stream, cancellationToken);

        byte[]? newsletterBytes = null;
        string? newsletterFileName = null;
        if (newsletterPdf is not null)
        {
            await using var newsletterStream = new MemoryStream();
            await newsletterPdf.CopyToAsync(newsletterStream, cancellationToken);
            newsletterBytes = newsletterStream.ToArray();
            newsletterFileName = newsletterPdf.FileName;
        }

        byte[]? statementBytes = null;
        string? statementFileName = null;
        if (statementPdf is not null)
        {
            await using var statementStream = new MemoryStream();
            await statementPdf.CopyToAsync(statementStream, cancellationToken);
            statementBytes = statementStream.ToArray();
            statementFileName = statementPdf.FileName;
        }

        return Ok(await _resultService.SendSlipAsync(id, request, stream.ToArray(), slipPdf.FileName, newsletterBytes, newsletterFileName, statementBytes, statementFileName, schoolId, cancellationToken));
    }

    [HttpPost("send-term-slips")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<BulkSlipSendResponse>> SendTermSlips(
        [FromQuery] string className,
        [FromQuery] string term,
        [FromQuery] bool includeStatement = false,
        [FromQuery] bool sendEmail = true,
        [FromQuery] bool sendSms = true,
        [FromQuery] int? schoolId = null,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _resultService.SendTermSlipsAsync(className, term, includeStatement, sendEmail, sendSms, schoolId, cancellationToken));
    }

    [HttpGet("report-card")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<ReportCardResponse>> GetReportCard(
        [FromQuery] int studentId,
        [FromQuery] string term,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _resultService.GetReportCardAsync(studentId, term, schoolId, cancellationToken));
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ResultResponse>> Approve(int id, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.ApproveAsync(id, cancellationToken));
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ResultResponse>> Reject(int id, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.RejectAsync(id, cancellationToken));
    }

    [HttpPost("{id:int}/reopen")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ResultResponse>> Reopen(int id, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.ReopenAsync(id, cancellationToken));
    }

    [HttpPost("{id:int}/lock")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ResultResponse>> Lock(int id, CancellationToken cancellationToken)
    {
        return Ok(await _resultService.LockAsync(id, cancellationToken));
    }
}
