using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/academic-calendar")]
[Authorize]
public sealed class AcademicCalendarController : ControllerBase
{
    private readonly IAcademicCalendarService _calendarService;

    public AcademicCalendarController(IAcademicCalendarService calendarService)
    {
        _calendarService = calendarService;
    }

    [HttpGet("terms")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<AcademicTermResponse>>> GetTerms([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _calendarService.GetTermsAsync(schoolId, cancellationToken));
    }

    [HttpPut("terms/{termNumber:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<AcademicTermResponse>> UpdateTerm(int termNumber, [FromBody] UpsertAcademicTermRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _calendarService.UpsertTermAsync(termNumber, request, cancellationToken));
    }

    [HttpGet("events")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<SchoolCalendarEventResponse>>> GetEvents([FromQuery] int? termId, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _calendarService.GetEventsAsync(termId, schoolId, cancellationToken));
    }

    [HttpPost("events")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<SchoolCalendarEventResponse>> CreateEvent([FromBody] CreateSchoolCalendarEventRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _calendarService.CreateEventAsync(request, cancellationToken));
    }

    [HttpDelete("events/{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> DeleteEvent(int id, CancellationToken cancellationToken)
    {
        await _calendarService.DeleteEventAsync(id, cancellationToken);
        return NoContent();
    }
}
