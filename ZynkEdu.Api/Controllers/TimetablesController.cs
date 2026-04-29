using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/timetables")]
public sealed class TimetablesController : ControllerBase
{
    private readonly ITimetableService _timetableService;

    public TimetablesController(ITimetableService timetableService)
    {
        _timetableService = timetableService;
    }

    [HttpGet("me")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<TimetableResponse>>> GetMine([FromQuery] string? term, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.GetMyTimetableAsync(term, cancellationToken));
    }

    [HttpGet]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<TimetableResponse>>> GetAll([FromQuery] int? schoolId, [FromQuery] string? term, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.GetAllAsync(schoolId, term, cancellationToken));
    }

    [HttpPost("generate")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<TimetableResponse>>> Generate([FromBody] GenerateTimetableRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.GenerateAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("publish")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<TimetablePublicationResponse>> Publish([FromBody] PublishTimetableRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.PublishAsync(request, schoolId, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<TimetableResponse>> Create([FromBody] UpsertTimetableSlotRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<TimetableResponse>> Update(int id, [FromBody] UpsertTimetableSlotRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _timetableService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
