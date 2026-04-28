using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/platform/subjects")]
[Authorize(Roles = RoleNames.PlatformAdmin)]
public sealed class PlatformSubjectsController : ControllerBase
{
    private readonly IPlatformSubjectCatalogService _platformSubjectCatalogService;

    public PlatformSubjectsController(IPlatformSubjectCatalogService platformSubjectCatalogService)
    {
        _platformSubjectCatalogService = platformSubjectCatalogService;
    }

    [HttpGet("catalog")]
    public async Task<ActionResult<IReadOnlyList<PlatformSubjectCatalogResponse>>> GetCatalog(CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.GetAllAsync(cancellationToken));
    }

    [HttpPost("catalog")]
    public async Task<ActionResult<PlatformSubjectCatalogResponse>> CreateCatalogSubject([FromBody] CreateSubjectRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.CreateAsync(request, cancellationToken));
    }

    [HttpPut("catalog/{id:int}")]
    public async Task<ActionResult<PlatformSubjectCatalogResponse>> UpdateCatalogSubject(int id, [FromBody] UpdateSubjectRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.UpdateAsync(id, request, cancellationToken));
    }

    [HttpDelete("catalog/{id:int}")]
    public async Task<IActionResult> DeleteCatalogSubject(int id, CancellationToken cancellationToken)
    {
        await _platformSubjectCatalogService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("import/from-school-to-catalog")]
    public async Task<ActionResult<ImportSubjectsResultResponse>> ImportFromSchoolToCatalog([FromBody] ImportSchoolSubjectsRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.ImportFromSchoolToCatalogAsync(request, cancellationToken));
    }

    [HttpPost("import/from-school-to-school/{targetSchoolId:int}")]
    public async Task<ActionResult<ImportSubjectsResultResponse>> ImportFromSchoolToSchool(int targetSchoolId, [FromBody] ImportSchoolSubjectsRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.ImportFromSchoolToSchoolAsync(targetSchoolId, request, cancellationToken));
    }

    [HttpPost("publish-all/{targetSchoolId:int}")]
    public async Task<ActionResult<ImportSubjectsResultResponse>> PublishAllToSchool(int targetSchoolId, CancellationToken cancellationToken)
    {
        return Ok(await _platformSubjectCatalogService.PublishAllCatalogToSchoolAsync(targetSchoolId, cancellationToken));
    }
}
