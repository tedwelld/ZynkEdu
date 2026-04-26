using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/teacher-assignments")]
[Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
public sealed class TeacherAssignmentsController : ControllerBase
{
    private readonly ITeacherAssignmentService _assignmentService;
    private readonly ICurrentUserContext _currentUserContext;

    public TeacherAssignmentsController(ITeacherAssignmentService assignmentService, ICurrentUserContext currentUserContext)
    {
        _assignmentService = assignmentService;
        _currentUserContext = currentUserContext;
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<TeacherAssignmentResponse>> Create([FromBody] CreateTeacherAssignmentRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _assignmentService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TeacherAssignmentResponse>>> GetAll([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _assignmentService.GetAllAsync(schoolId, cancellationToken));
    }

    [HttpGet("teacher/{id:int}")]
    public async Task<ActionResult<IReadOnlyList<TeacherAssignmentResponse>>> GetByTeacher(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        if (_currentUserContext.Role == UserRole.Teacher && _currentUserContext.UserId != id)
        {
            return Forbid();
        }

        return Ok(await _assignmentService.GetByTeacherAsync(id, schoolId, cancellationToken));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<TeacherAssignmentResponse>> Update(int id, [FromBody] UpdateTeacherAssignmentRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _assignmentService.UpdateAsync(id, request, schoolId, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _assignmentService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
