using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class AuditLogsController : ControllerBase
{
    private readonly IAuditLogService _auditLogService;

    public AuditLogsController(IAuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogResponse>>> Get([FromQuery] int? schoolId, [FromQuery] int take = 10, CancellationToken cancellationToken = default)
    {
        return Ok(await _auditLogService.GetRecentAsync(schoolId, take, cancellationToken));
    }
}
