using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class AdminAccountingController : ControllerBase
{
    private readonly IUserManagementService _userManagementService;

    public AdminAccountingController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpPost("accountants")]
    public async Task<ActionResult<UserResponse>> CreateAccountant([FromBody] CreateAccountantRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateAccountantAsync(request, null, cancellationToken));
    }

    [HttpGet("accountants")]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetAccountants([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.GetAccountantsAsync(schoolId, cancellationToken));
    }
}
