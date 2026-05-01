using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Application.Security;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Api.Controllers;

[ApiController]
[Route("api/library")]
[Authorize(Roles = RoleNames.AdminLibraryOrPlatformAdmin)]
public sealed class LibraryController : ControllerBase
{
    private readonly ILibraryService _libraryService;

    public LibraryController(ILibraryService libraryService)
    {
        _libraryService = libraryService;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<LibraryDashboardResponse>> GetDashboard([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.GetDashboardAsync(schoolId, cancellationToken));
    }

    [HttpGet("books")]
    public async Task<ActionResult<IReadOnlyList<LibraryBookResponse>>> GetBooks([FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.GetBooksAsync(schoolId, cancellationToken));
    }

    [HttpGet("books/{id:int}")]
    public async Task<ActionResult<LibraryBookResponse>> GetBook(int id, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        var book = await _libraryService.GetBookAsync(id, schoolId, cancellationToken);
        return book is null ? NotFound() : Ok(book);
    }

    [HttpPost("books")]
    public async Task<ActionResult<LibraryBookResponse>> CreateBook([FromBody] CreateLibraryBookRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.CreateBookAsync(request, schoolId, cancellationToken));
    }

    [HttpPut("books/{id:int}")]
    public async Task<ActionResult<LibraryBookResponse>> UpdateBook(int id, [FromBody] UpdateLibraryBookRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.UpdateBookAsync(id, request, cancellationToken));
    }

    [HttpDelete("books/{id:int}")]
    public async Task<IActionResult> DeleteBook(int id, CancellationToken cancellationToken)
    {
        await _libraryService.DeleteBookAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("books/{bookId:int}/copies")]
    public async Task<ActionResult<IReadOnlyList<LibraryBookCopyResponse>>> GetCopies(int bookId, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.GetCopiesAsync(bookId, schoolId, cancellationToken));
    }

    [HttpPost("books/{bookId:int}/copies")]
    public async Task<ActionResult<LibraryBookCopyResponse>> AddCopy(int bookId, [FromBody] CreateLibraryBookCopyRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.AddCopyAsync(bookId, request, cancellationToken));
    }

    [HttpPut("copies/{id:int}")]
    public async Task<ActionResult<LibraryBookCopyResponse>> UpdateCopy(int id, [FromBody] UpdateLibraryBookCopyRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.UpdateCopyAsync(id, request, cancellationToken));
    }

    [HttpDelete("copies/{id:int}")]
    public async Task<IActionResult> DeleteCopy(int id, CancellationToken cancellationToken)
    {
        await _libraryService.DeleteCopyAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("loans")]
    public async Task<ActionResult<IReadOnlyList<LibraryLoanResponse>>> GetLoans([FromQuery] int? schoolId, [FromQuery] bool activeOnly = false, CancellationToken cancellationToken = default)
    {
        return Ok(await _libraryService.GetLoansAsync(schoolId, activeOnly, cancellationToken));
    }

    [HttpGet("loans/overdue")]
    public async Task<ActionResult<IReadOnlyList<LibraryLoanResponse>>> GetOverdueLoans([FromQuery] int? schoolId, CancellationToken cancellationToken = default)
    {
        return Ok(await _libraryService.GetOverdueLoansAsync(schoolId, cancellationToken));
    }

    [HttpGet("borrowers")]
    public async Task<ActionResult<IReadOnlyList<LibraryBorrowerSummaryResponse>>> GetBorrowers([FromQuery] int? schoolId, CancellationToken cancellationToken = default)
    {
        return Ok(await _libraryService.GetBorrowerSummariesAsync(schoolId, cancellationToken));
    }

    [HttpGet("borrowers/{borrowerType}/loans")]
    public async Task<ActionResult<IReadOnlyList<LibraryLoanResponse>>> GetBorrowerLoans([FromRoute] LibraryBorrowerType borrowerType, [FromQuery] int borrowerId, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.GetBorrowerLoansAsync(borrowerType, borrowerId, schoolId, cancellationToken));
    }

    [HttpPost("loans/issue")]
    public async Task<ActionResult<LibraryLoanResponse>> Issue([FromBody] IssueLibraryBookRequest request, [FromQuery] int? schoolId, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.IssueAsync(request, schoolId, cancellationToken));
    }

    [HttpPost("loans/{id:int}/return")]
    public async Task<ActionResult<LibraryLoanResponse>> Return(int id, [FromBody] ReturnLibraryBookRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.ReturnAsync(id, request, cancellationToken));
    }

    [HttpPost("loans/{id:int}/renew")]
    public async Task<ActionResult<LibraryLoanResponse>> Renew(int id, [FromBody] RenewLibraryLoanRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _libraryService.RenewAsync(id, request, cancellationToken));
    }
}
