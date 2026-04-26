using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
public sealed class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpPost("send")]
    public async Task<ActionResult<NotificationResponse>> Send([FromBody] SendNotificationRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _notificationService.SendAsync(request, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationResponse>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await _notificationService.GetAllAsync(cancellationToken));
    }
}
