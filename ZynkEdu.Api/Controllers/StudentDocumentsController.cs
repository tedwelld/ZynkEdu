using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/student-documents")]
public sealed class StudentDocumentsController : ControllerBase
{
    private readonly IStudentDocumentService _studentDocumentService;

    public StudentDocumentsController(IStudentDocumentService studentDocumentService)
    {
        _studentDocumentService = studentDocumentService;
    }

    [HttpGet("{studentId:int}")]
    [Authorize(Roles = RoleNames.AdminTeacherAccountingOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<StudentDocumentResponse>>> GetByStudent(
        int studentId,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        return Ok(await _studentDocumentService.GetByStudentAsync(studentId, schoolId, cancellationToken));
    }

    [HttpPost("upload")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<StudentDocumentResponse>> Upload(
        [FromForm] int studentId,
        [FromForm] string documentType,
        [FromForm] string? notes,
        [FromForm] IFormFile file,
        [FromQuery] int? schoolId,
        CancellationToken cancellationToken)
    {
        var request = new UploadStudentDocumentRequest(studentId, documentType, notes);
        await using var stream = file.OpenReadStream();
        var result = await _studentDocumentService.UploadAsync(request, stream, file.FileName, file.ContentType, schoolId, cancellationToken);
        return Ok(result);
    }

    [HttpGet("download/{id:int}")]
    [Authorize(Roles = RoleNames.AdminTeacherAccountingOrPlatformAdmin)]
    public async Task<IActionResult> Download(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        var (content, contentType, fileName) = await _studentDocumentService.DownloadAsync(id, schoolId, cancellationToken);
        return File(content, contentType, fileName);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = RoleNames.AccountingOperators)]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        await _studentDocumentService.DeleteAsync(id, schoolId, cancellationToken);
        return NoContent();
    }
}
