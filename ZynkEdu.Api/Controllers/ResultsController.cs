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
}
