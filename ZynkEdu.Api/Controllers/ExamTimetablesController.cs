using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/exam-timetables")]
public sealed class ExamTimetablesController : ControllerBase
{
    private readonly IExamTimetableService _examTimetableService;

    public ExamTimetablesController(IExamTimetableService examTimetableService)
    {
        _examTimetableService = examTimetableService;
    }

    [HttpGet]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<ExamTimetableEntryResponse>>> GetAll(
        [FromQuery] int? schoolId,
        [FromQuery] string? term,
        [FromQuery] string? @class,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.GetAllAsync(schoolId, term, @class, cancellationToken));
    }

    [HttpGet("me")]
    [Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<ExamTimetableEntryResponse>>> GetMine(
        [FromQuery] string? term,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.GetMyAsync(term, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ExamTimetableEntryResponse>> Create(
        [FromBody] CreateExamTimetableEntryRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("bulk")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<ExamTimetableEntryResponse>>> BulkCreate(
        [FromBody] BulkCreateExamTimetableRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.BulkCreateAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("publish")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<ExamTimetableEntryResponse>>> Publish(
        [FromBody] PublishExamTimetableRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.PublishAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<ExamTimetableEntryResponse>> Update(
        int id,
        [FromBody] UpdateExamTimetableEntryRequest request,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _examTimetableService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _examTimetableService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
