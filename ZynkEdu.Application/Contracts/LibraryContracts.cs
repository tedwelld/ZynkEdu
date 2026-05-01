using System.ComponentModel.DataAnnotations;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Application.Contracts;

public sealed record LibraryDashboardResponse(
    int SchoolId,
    int BookCount,
    int CopyCount,
    int IssuedLoanCount,
    int OverdueLoanCount,
    int BorrowerCount);

public sealed record CreateLibraryBookRequest(
    [Required, MinLength(1)] string Title,
    [Required, MinLength(1)] string Author,
    string? Isbn = null,
    string? AccessionNumber = null,
    string? Publisher = null,
    string? Category = null,
    string? Subject = null,
    string? Genre = null,
    string? Edition = null,
    int? PublicationYear = null,
    string? ShelfLocation = null,
    string? Condition = null,
    [Range(1, 500)] int InitialCopies = 1,
    bool IsActive = true);

public sealed record UpdateLibraryBookRequest(
    [Required, MinLength(1)] string Title,
    [Required, MinLength(1)] string Author,
    string? Isbn = null,
    string? AccessionNumber = null,
    string? Publisher = null,
    string? Category = null,
    string? Subject = null,
    string? Genre = null,
    string? Edition = null,
    int? PublicationYear = null,
    string? ShelfLocation = null,
    string? Condition = null,
    bool IsActive = true);

public sealed record LibraryBookResponse(
    int Id,
    int SchoolId,
    string Title,
    string Author,
    string? Isbn,
    string? AccessionNumber,
    string? Publisher,
    string? Category,
    string? Subject,
    string? Genre,
    string? Edition,
    int? PublicationYear,
    string? ShelfLocation,
    string? Condition,
    int TotalCopies,
    int AvailableCopies,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateLibraryBookCopyRequest(
    string? AccessionNumber = null,
    string? ShelfLocation = null,
    string? Condition = null,
    bool IsActive = true);

public sealed record UpdateLibraryBookCopyRequest(
    string? AccessionNumber = null,
    string? ShelfLocation = null,
    string? Condition = null,
    bool IsActive = true);

public sealed record LibraryBookCopyResponse(
    int Id,
    int SchoolId,
    int LibraryBookId,
    string LibraryBookTitle,
    string? AccessionNumber,
    string? ShelfLocation,
    string? Condition,
    LibraryCopyStatus Status,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record IssueLibraryBookRequest(
    [Required] LibraryBorrowerType BorrowerType,
    int BorrowerId,
    int BookCopyId,
    [Required] DateTime DueAt,
    string? Notes = null);

public sealed record ReturnLibraryBookRequest(
    string? Notes = null);

public sealed record RenewLibraryLoanRequest(
    [Required] DateTime DueAt,
    string? Notes = null);

public sealed record LibraryLoanResponse(
    int Id,
    int SchoolId,
    int? LibraryBookId,
    int? LibraryBookCopyId,
    LibraryBorrowerType BorrowerType,
    int? BorrowerId,
    string BorrowerDisplayName,
    string? BorrowerReference,
    string IssuedByDisplayName,
    string IssuedByUserName,
    string IssuedByRole,
    string BookTitle,
    string? BookAuthor,
    string? BookIsbn,
    string? CopyAccessionNumber,
    string? CopyShelfLocation,
    string? CopyCondition,
    DateTime IssuedAt,
    DateTime DueAt,
    DateTime? ReturnedAt,
    string? ReturnedByDisplayName,
    string? ReturnedByUserName,
    string? ReturnNotes,
    bool IsOverdue);

public sealed record LibraryBorrowerSummaryResponse(
    LibraryBorrowerType BorrowerType,
    int BorrowerId,
    string DisplayName,
    string? Reference,
    int ActiveLoanCount,
    int OverdueLoanCount);
