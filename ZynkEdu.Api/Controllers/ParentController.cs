using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/parent")]
[Authorize(Roles = RoleNames.ParentOrPlatformAdmin)]
public sealed class ParentController : ControllerBase
{
    private readonly IResultService _resultService;
    private readonly ICurrentUserContext _currentUserContext;

    public ParentController(IResultService resultService, ICurrentUserContext currentUserContext)
    {
        _resultService = resultService;
        _currentUserContext = currentUserContext;
    }

    [HttpGet("results")]
    public async Task<ActionResult<IReadOnlyList<StudentCommentResponse>>> GetMyResults(CancellationToken cancellationToken)
    {
        var destination = _currentUserContext.ParentPhone ?? _currentUserContext.ParentEmail;
        if (string.IsNullOrWhiteSpace(destination))
        {
            return Forbid();
        }

        return Ok(await _resultService.GetParentResultsAsync(destination, cancellationToken));
    }

    [HttpGet("report-preview")]
    public async Task<ActionResult<IReadOnlyList<ParentPreviewReportResponse>>> GetReportPreview(CancellationToken cancellationToken)
    {
        var destination = _currentUserContext.ParentPhone ?? _currentUserContext.ParentEmail;
        if (string.IsNullOrWhiteSpace(destination))
        {
            return Forbid();
        }

        return Ok(await _resultService.GetParentReportPreviewAsync(destination, cancellationToken));
    }
}
