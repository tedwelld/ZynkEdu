using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/students/lifecycle")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class StudentLifecycleController : ControllerBase
{
    private readonly IStudentLifecycleService _studentLifecycleService;

    public StudentLifecycleController(IStudentLifecycleService studentLifecycleService)
    {
        _studentLifecycleService = studentLifecycleService;
    }

    [HttpPost("transfer")]
    public async Task<ActionResult<StudentMovementResponse>> Transfer([FromBody] StudentMovementRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentLifecycleService.MoveAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("promotion-runs")]
    public async Task<ActionResult<StudentPromotionRunResponse>> CommitPromotionRun([FromBody] StudentPromotionRunRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentLifecycleService.CommitPromotionRunAsync(request, schoolId, cancellationToken));
    }
}
