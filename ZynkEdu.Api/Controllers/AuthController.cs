using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.LoginAsync(request, cancellationToken));
    }

    [HttpPost("parent-otp")]
    [AllowAnonymous]
    public async Task<ActionResult<ParentOtpResponse>> RequestParentOtp([FromBody] ParentOtpRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.RequestParentOtpAsync(request, cancellationToken));
    }

    [HttpPost("verify-otp")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> VerifyParentOtp([FromBody] VerifyParentOtpRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.VerifyParentOtpAsync(request, cancellationToken));
    }

    [HttpGet("schools")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<SchoolResponse>>> GetSchools(CancellationToken cancellationToken)
    {
        return Ok(await _authService.GetPublicSchoolsAsync(cancellationToken));
    }
}
