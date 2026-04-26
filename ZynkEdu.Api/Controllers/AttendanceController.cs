using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
public sealed class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendanceService;

    public AttendanceController(IAttendanceService attendanceService)
    {
        _attendanceService = attendanceService;
    }

    [HttpGet("classes")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<AttendanceClassOptionResponse>>> GetClasses([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _attendanceService.GetClassOptionsAsync(schoolId, cancellationToken));
    }

    [HttpGet("register")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<AttendanceRegisterResponse>> GetRegister(
        [FromQuery] string className,
        [FromQuery] DateTime attendanceDate,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        var register = await _attendanceService.GetRegisterAsync(className, attendanceDate, schoolId, cancellationToken);
        return register is null ? NotFound() : Ok(register);
    }

    [HttpGet("daily")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<AttendanceDailySummaryResponse>>> GetDailySummaries(
        [FromQuery] DateTime attendanceDate,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _attendanceService.GetDailySummariesAsync(attendanceDate, schoolId, cancellationToken));
    }

    [HttpPost("register")]
    [Authorize(Roles = RoleNames.Teacher)]
    public async Task<ActionResult<AttendanceRegisterResponse>> SaveRegister(
        [FromBody] SaveAttendanceRegisterRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _attendanceService.SaveAsync(request, schoolId, cancellationToken));
    }
}
