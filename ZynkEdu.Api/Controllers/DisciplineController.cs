using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/discipline")]
public sealed class DisciplineController : ControllerBase
{
    private readonly IDisciplineService _disciplineService;

    public DisciplineController(IDisciplineService disciplineService)
    {
        _disciplineService = disciplineService;
    }

    [HttpGet]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<DisciplineIncidentResponse>>> GetAll(
        [FromQuery] int? schoolId,
        [FromQuery] int? studentId,
        [FromQuery] bool? isResolved,
        CancellationToken cancellationToken)
    {
        return Ok(await _disciplineService.GetAllAsync(schoolId, studentId, isResolved, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<DisciplineIncidentResponse>> Create(
        [FromBody] CreateDisciplineIncidentRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _disciplineService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<DisciplineIncidentResponse>> Update(
        int id,
        [FromBody] UpdateDisciplineIncidentRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _disciplineService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _disciplineService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
