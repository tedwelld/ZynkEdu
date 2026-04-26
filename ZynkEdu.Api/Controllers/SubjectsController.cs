using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/subjects")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class SubjectsController : ControllerBase
{
    private readonly ISubjectService _subjectService;

    public SubjectsController(ISubjectService subjectService)
    {
        _subjectService = subjectService;
    }

    [HttpPost]
    public async Task<ActionResult<SubjectResponse>> Create([FromBody] CreateSubjectRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _subjectService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SubjectResponse>>> GetAll([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _subjectService.GetAllAsync(schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SubjectResponse>> Update(int id, [FromBody] UpdateSubjectRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _subjectService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _subjectService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
