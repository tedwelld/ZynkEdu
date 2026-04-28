using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/classes")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class ClassesController : ControllerBase
{
    private readonly ISchoolClassService _schoolClassService;

    public ClassesController(ISchoolClassService schoolClassService)
    {
        _schoolClassService = schoolClassService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SchoolClassResponse>>> GetAll([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _schoolClassService.GetAllAsync(schoolId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<SchoolClassResponse>> Create([FromBody] CreateSchoolClassRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _schoolClassService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SchoolClassResponse>> Update(int id, [FromBody] UpdateSchoolClassRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _schoolClassService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}/subjects")]
    public async Task<ActionResult<SchoolClassResponse>> AssignSubjects(int id, [FromBody] AssignClassSubjectsRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _schoolClassService.AssignSubjectsAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _schoolClassService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
