using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/platform")]
[Authorize(Roles = RoleNames.PlatformAdmin)]
public sealed class PlatformAccountingController : ControllerBase
{
    private readonly IUserManagementService _userManagementService;

    public PlatformAccountingController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpPost("accountants")]
    public async Task<ActionResult<UserResponse>> CreateAccountant([FromQuery] int schoolId, [FromBody] CreateAccountantRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateAccountantAsync(request, schoolId, cancellationToken));
    }

    [HttpGet("accountants")]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetAccountants([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.GetAccountantsAsync(schoolId, cancellationToken));
    }
}
