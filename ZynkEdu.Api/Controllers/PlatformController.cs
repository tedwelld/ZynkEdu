using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/platform")]
[Authorize(Roles = RoleNames.PlatformAdmin)]
public sealed class PlatformController : ControllerBase
{
    private readonly ISchoolService _schoolService;

    public PlatformController(ISchoolService schoolService)
    {
        _schoolService = schoolService;
    }

    [HttpPost("schools/with-admin")]
    public async Task<ActionResult<SchoolResponse>> CreateSchoolWithAdmin([FromBody] SchoolCreateWithAdminRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _schoolService.CreateWithAdminAsync(request, cancellationToken));
    }

    [HttpPost("schools")]
    public async Task<ActionResult<SchoolResponse>> CreateSchool([FromBody] SchoolCreateRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _schoolService.CreateAsync(request, cancellationToken));
    }

    [HttpGet("schools")]
    public async Task<ActionResult<IReadOnlyList<SchoolResponse>>> GetSchools(CancellationToken cancellationToken)
    {
        return Ok(await _schoolService.GetAllAsync(cancellationToken));
    }

    [HttpPut("schools/{id:int}")]
    public async Task<ActionResult<SchoolResponse>> UpdateSchool(int id, [FromBody] UpdateSchoolRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _schoolService.UpdateAsync(id, request, cancellationToken));
    }

    [HttpDelete("schools/{id:int}")]
    public async Task<IActionResult> DeleteSchool(int id, CancellationToken cancellationToken)
    {
        await _schoolService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
