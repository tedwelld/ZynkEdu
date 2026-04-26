using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;

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
    public async Task<ActionResult<IReadOnlyList<TimetableResponse>>> GetMine([FromQuery] string? term, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.GetMyTimetableAsync(term, cancellationToken));
    }

    [HttpPost("generate")]
    public async Task<ActionResult<IReadOnlyList<TimetableResponse>>> Generate([FromBody] GenerateTimetableRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _timetableService.GenerateAsync(request, cancellationToken));
    }
}
