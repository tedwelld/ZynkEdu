using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController : ControllerBase
{
    private readonly IUserManagementService _userManagementService;

    public UsersController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpPost("teachers")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<UserResponse>> CreateTeacher([FromBody] CreateSchoolUserRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateTeacherAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("teachers-with-assignment")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<UserResponse>> CreateTeacherWithAssignment([FromBody] CreateTeacherWithAssignmentRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateTeacherWithAssignmentAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("admins")]
    [Authorize(Roles = RoleNames.PlatformAdmin)]
    public async Task<ActionResult<UserResponse>> CreateAdmin([FromQuery] int schoolId, [FromBody] CreateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateAdminAsync(schoolId, request, cancellationToken));
    }

    [HttpPost("library-admins")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<UserResponse>> CreateLibraryAdmin([FromQuery] int schoolId, [FromBody] CreateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.CreateLibraryAdminAsync(schoolId, request, cancellationToken));
    }

    [HttpGet("teachers")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetTeachers([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.GetTeachersAsync(schoolId, cancellationToken));
    }

    [HttpGet("admins")]
    [Authorize(Roles = RoleNames.PlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetAdmins([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.GetAdminsAsync(schoolId, cancellationToken));
    }

    [HttpGet("library-admins")]
    [Authorize(Roles = RoleNames.LibraryAdminAdminOrPlatformAdmin)]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetLibraryAdmins([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.GetLibraryAdminsAsync(schoolId, cancellationToken));
    }

    [HttpPut("teachers/{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<ActionResult<UserResponse>> UpdateTeacher(int id, [FromBody] UpdateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.UpdateTeacherAsync(id, request, cancellationToken));
    }

    [HttpDelete("teachers/{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> DeleteTeacher(int id, CancellationToken cancellationToken)
    {
        await _userManagementService.DeleteTeacherAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPut("admins/{id:int}")]
    [Authorize(Roles = RoleNames.PlatformAdmin)]
    public async Task<ActionResult<UserResponse>> UpdateAdmin(int id, [FromBody] UpdateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.UpdateAdminAsync(id, request, cancellationToken));
    }

    [HttpDelete("admins/{id:int}")]
    [Authorize(Roles = RoleNames.PlatformAdmin)]
    public async Task<IActionResult> DeleteAdmin(int id, CancellationToken cancellationToken)
    {
        await _userManagementService.DeleteAdminAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPut("library-admins/{id:int}")]
    [Authorize(Roles = RoleNames.LibraryAdminAdminOrPlatformAdmin)]
    public async Task<ActionResult<UserResponse>> UpdateLibraryAdmin(int id, [FromBody] UpdateSchoolUserRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _userManagementService.UpdateLibraryAdminAsync(id, request, cancellationToken));
    }

    [HttpDelete("library-admins/{id:int}")]
    [Authorize(Roles = RoleNames.AdminOrPlatformAdmin)]
    public async Task<IActionResult> DeleteLibraryAdmin(int id, CancellationToken cancellationToken)
    {
        await _userManagementService.DeleteLibraryAdminAsync(id, cancellationToken);
        return NoContent();
    }
}
