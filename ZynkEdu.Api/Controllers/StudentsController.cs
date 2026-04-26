using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/students")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class StudentsController : ControllerBase
{
    private readonly IStudentService _studentService;

    public StudentsController(IStudentService studentService)
    {
        _studentService = studentService;
    }

    [HttpPost]
    public async Task<ActionResult<StudentResponse>> Create([FromBody] CreateStudentRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.CreateAsync(request, schoolId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentResponse>>> GetAll([FromQuery] string? classFilter, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.GetAllAsync(classFilter, schoolId, cancellationToken));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<StudentResponse>> GetById(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        var student = await _studentService.GetByIdAsync(id, schoolId, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<StudentResponse>> Update(int id, [FromBody] UpdateStudentRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateAsync(id, request, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _studentService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
