using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/assessment-structures")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class AssessmentStructuresController : ControllerBase
{
    private readonly IAssessmentStructureService _service;

    public AssessmentStructuresController(IAssessmentStructureService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AssessmentStructureResponse>>> GetAll([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _service.GetAsync(schoolId, cancellationToken));
    }

    [HttpGet("for-level")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<AssessmentStructureResponse>> GetForLevel(
        [FromQuery] string level,
        [FromQuery] int? subjectId,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _service.GetForLevelAsync(level, subjectId, schoolId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<AssessmentStructureResponse>> Create([FromQuery] int? schoolId, [FromBody] SaveAssessmentStructureRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _service.SaveAsync(request, null, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AssessmentStructureResponse>> Update(int id, [FromQuery] int? schoolId, [FromBody] SaveAssessmentStructureRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _service.SaveAsync(request, id, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
