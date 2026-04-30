using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/students")]
[Authorize(Roles = RoleNames.AdminTeacherOrPlatformAdmin)]
public sealed class StudentsController : ControllerBase
{
    private readonly IStudentService _studentService;

    public StudentsController(IStudentService studentService)
    {
        _studentService = studentService;
    }

    [HttpPost]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<StudentResponse>> Create([FromBody] CreateStudentRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentResponse>>> GetAll([FromQuery] string? classFilter, [FromQuery] int? schoolId, [FromQuery] bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        return Ok(await _studentService.GetAllAsync(classFilter, schoolId, includeInactive, cancellationToken));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<StudentResponse>> GetById(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        var student = await _studentService.GetByIdAsync(id, schoolId, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<StudentResponse>> Update(int id, [FromBody] UpdateStudentRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateAsync(id, request, cancellationToken));
    }

    [HttpPut("{id:int}/status")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<StudentResponse>> UpdateStatus(int id, [FromBody] UpdateStudentStatusRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateStatusAsync(id, request, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _studentService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("enroll-all-subjects")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<BulkStudentSubjectEnrollmentResponse>> EnrollAllSubjects([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.EnrollAllSubjectsAsync(schoolId, cancellationToken));
    }
}
