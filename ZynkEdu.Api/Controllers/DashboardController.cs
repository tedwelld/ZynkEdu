using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Get([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _dashboardService.GetAsync(schoolId, cancellationToken));
    }
}
