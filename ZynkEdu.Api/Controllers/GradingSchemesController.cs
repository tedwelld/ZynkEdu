using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/grading-schemes")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class GradingSchemesController : ControllerBase
{
    private readonly IGradingSchemeService _gradingSchemeService;

    public GradingSchemesController(IGradingSchemeService gradingSchemeService)
    {
        _gradingSchemeService = gradingSchemeService;
    }

    [HttpGet]
    public async Task<ActionResult<GradingSchemeResponse>> Get([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _gradingSchemeService.GetAsync(schoolId, cancellationToken));
    }

    [HttpPut]
    public async Task<ActionResult<GradingSchemeResponse>> Save([FromBody] SaveGradingSchemeRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _gradingSchemeService.SaveAsync(request, schoolId, cancellationToken));
    }
}
