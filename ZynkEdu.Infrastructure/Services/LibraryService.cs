using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services;

public sealed class LibraryService : ILibraryService
{
    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public LibraryService(ZynkEduDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<LibraryDashboardResponse> GetDashboardAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var books = Scope(_dbContext.LibraryBooks.AsNoTracking(), schoolId);
        var loans = Scope(_dbContext.LibraryLoans.AsNoTracking(), schoolId);

        var bookCount = await books.CountAsync(cancellationToken);
        var copyCount = await Scope(_dbContext.LibraryBookCopies.AsNoTracking(), schoolId).CountAsync(cancellationToken);
        var issuedLoanCount = await loans.CountAsync(x => x.ReturnedAt == null, cancellationToken);
        var overdueLoanCount = await loans.CountAsync(x => x.ReturnedAt == null && x.DueAt < DateTime.UtcNow, cancellationToken);
        var borrowerCount = await loans
            .Where(x => x.ReturnedAt == null)
            .Select(x => new { x.BorrowerType, BorrowerId = x.BorrowerType == LibraryBorrowerType.Student ? x.StudentId : x.TeacherId })
            .Distinct()
            .CountAsync(cancellationToken);

        return new LibraryDashboardResponse(ResolveDashboardSchoolId(schoolId), bookCount, copyCount, issuedLoanCount, overdueLoanCount, borrowerCount);
    }

    public async Task<IReadOnlyList<LibraryBookResponse>> GetBooksAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        return await Scope(_dbContext.LibraryBooks.AsNoTracking(), schoolId)
            .OrderBy(x => x.Title)
            .Select(x => ToBookResponse(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<LibraryBookResponse?> GetBookAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var book = await Scope(_dbContext.LibraryBooks.AsNoTracking(), schoolId)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return book is null ? null : ToBookResponse(book);
    }

    public async Task<LibraryBookResponse> CreateBookAsync(CreateLibraryBookRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var targetSchoolId = ResolveWriteSchoolId(schoolId);
        var title = request.Title.Trim();
        var author = request.Author.Trim();

        var book = new LibraryBook
        {
            SchoolId = targetSchoolId,
            Title = title,
            Author = author,
            Isbn = Normalize(request.Isbn),
            AccessionNumber = Normalize(request.AccessionNumber),
            Publisher = Normalize(request.Publisher),
            Category = Normalize(request.Category),
            Subject = Normalize(request.Subject),
            Genre = Normalize(request.Genre),
            Edition = Normalize(request.Edition),
            PublicationYear = request.PublicationYear,
            ShelfLocation = Normalize(request.ShelfLocation),
            Condition = Normalize(request.Condition),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.LibraryBooks.Add(book);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var copies = new List<LibraryBookCopy>();
        var copyCount = request.InitialCopies < 1 ? 1 : request.InitialCopies;
        for (var index = 0; index < copyCount; index++)
        {
            copies.Add(new LibraryBookCopy
            {
                SchoolId = targetSchoolId,
                LibraryBookId = book.Id,
                AccessionNumber = index == 0 ? Normalize(request.AccessionNumber) : null,
                ShelfLocation = Normalize(request.ShelfLocation),
                Condition = Normalize(request.Condition),
                Status = LibraryCopyStatus.Available,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        if (copies.Count > 0)
        {
            _dbContext.LibraryBookCopies.AddRange(copies);
            book.TotalCopies = copies.Count;
            book.AvailableCopies = copies.Count;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return ToBookResponse(book);
    }

    public async Task<LibraryBookResponse> UpdateBookAsync(int id, UpdateLibraryBookRequest request, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var book = await Scope(_dbContext.LibraryBooks, null).FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library book was not found.");

        book.Title = request.Title.Trim();
        book.Author = request.Author.Trim();
        book.Isbn = Normalize(request.Isbn);
        book.AccessionNumber = Normalize(request.AccessionNumber);
        book.Publisher = Normalize(request.Publisher);
        book.Category = Normalize(request.Category);
        book.Subject = Normalize(request.Subject);
        book.Genre = Normalize(request.Genre);
        book.Edition = Normalize(request.Edition);
        book.PublicationYear = request.PublicationYear;
        book.ShelfLocation = Normalize(request.ShelfLocation);
        book.Condition = Normalize(request.Condition);
        book.IsActive = request.IsActive;
        book.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToBookResponse(book);
    }

    public async Task DeleteBookAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var book = await _dbContext.LibraryBooks
            .Include(x => x.Copies)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library book was not found.");

        if (await _dbContext.LibraryLoans.AnyAsync(x => x.LibraryBookId == book.Id && x.ReturnedAt == null, cancellationToken))
        {
            throw new InvalidOperationException("Return all active loans before deleting the book.");
        }

        var loans = await _dbContext.LibraryLoans
            .Where(x => x.LibraryBookId == book.Id)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var loan in loans)
        {
            loan.LibraryBookId = null;
            loan.UpdatedAt = now;
        }

        if (loans.Count > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _dbContext.LibraryBooks.Remove(book);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LibraryBookCopyResponse>> GetCopiesAsync(int bookId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var book = await Scope(_dbContext.LibraryBooks.AsNoTracking(), schoolId)
            .FirstOrDefaultAsync(x => x.Id == bookId, cancellationToken)
            ?? throw new InvalidOperationException("Library book was not found.");

        return await _dbContext.LibraryBookCopies.AsNoTracking()
            .Where(x => x.LibraryBookId == book.Id)
            .OrderBy(x => x.Id)
            .Select(x => new LibraryBookCopyResponse(x.Id, x.SchoolId, x.LibraryBookId, book.Title, x.AccessionNumber, x.ShelfLocation, x.Condition, x.Status, x.IsActive, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<LibraryBookCopyResponse> AddCopyAsync(int bookId, CreateLibraryBookCopyRequest request, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var book = await Scope(_dbContext.LibraryBooks, null).FirstOrDefaultAsync(x => x.Id == bookId, cancellationToken)
            ?? throw new InvalidOperationException("Library book was not found.");

        var copy = new LibraryBookCopy
        {
            SchoolId = book.SchoolId,
            LibraryBookId = book.Id,
            AccessionNumber = Normalize(request.AccessionNumber),
            ShelfLocation = Normalize(request.ShelfLocation) ?? book.ShelfLocation,
            Condition = Normalize(request.Condition) ?? book.Condition,
            Status = LibraryCopyStatus.Available,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.LibraryBookCopies.Add(copy);
        book.TotalCopies++;
        book.AvailableCopies++;
        book.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new LibraryBookCopyResponse(copy.Id, copy.SchoolId, copy.LibraryBookId, book.Title, copy.AccessionNumber, copy.ShelfLocation, copy.Condition, copy.Status, copy.IsActive, copy.CreatedAt, copy.UpdatedAt);
    }

    public async Task<LibraryBookCopyResponse> UpdateCopyAsync(int id, UpdateLibraryBookCopyRequest request, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var copy = await _dbContext.LibraryBookCopies
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library copy was not found.");

        copy.AccessionNumber = Normalize(request.AccessionNumber);
        copy.ShelfLocation = Normalize(request.ShelfLocation) ?? copy.Book?.ShelfLocation;
        copy.Condition = Normalize(request.Condition) ?? copy.Book?.Condition;
        copy.IsActive = request.IsActive;
        copy.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new LibraryBookCopyResponse(copy.Id, copy.SchoolId, copy.LibraryBookId, copy.Book?.Title ?? string.Empty, copy.AccessionNumber, copy.ShelfLocation, copy.Condition, copy.Status, copy.IsActive, copy.CreatedAt, copy.UpdatedAt);
    }

    public async Task DeleteCopyAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var copy = await _dbContext.LibraryBookCopies
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library copy was not found.");

        if (await _dbContext.LibraryLoans.AnyAsync(x => x.LibraryBookCopyId == copy.Id && x.ReturnedAt == null, cancellationToken))
        {
            throw new InvalidOperationException("Return the active loan before deleting the copy.");
        }

        if (copy.Book is not null)
        {
            copy.Book.TotalCopies = Math.Max(0, copy.Book.TotalCopies - 1);
            if (copy.Status == LibraryCopyStatus.Available)
            {
                copy.Book.AvailableCopies = Math.Max(0, copy.Book.AvailableCopies - 1);
            }

            copy.Book.UpdatedAt = DateTime.UtcNow;
        }

        _dbContext.LibraryBookCopies.Remove(copy);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LibraryLoanResponse>> GetLoansAsync(int? schoolId = null, bool activeOnly = false, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var query = Scope(_dbContext.LibraryLoans.AsNoTracking(), schoolId);
        if (activeOnly)
        {
            query = query.Where(x => x.ReturnedAt == null);
        }

        var loans = await query
            .OrderByDescending(x => x.IssuedAt)
            .ToListAsync(cancellationToken);

        return loans.Select(ToLoanResponse).ToList();
    }

    public async Task<IReadOnlyList<LibraryLoanResponse>> GetOverdueLoansAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var loans = await Scope(_dbContext.LibraryLoans.AsNoTracking(), schoolId)
            .Where(x => x.ReturnedAt == null && x.DueAt < DateTime.UtcNow)
            .OrderBy(x => x.DueAt)
            .ToListAsync(cancellationToken);

        return loans.Select(ToLoanResponse).ToList();
    }

    public async Task<IReadOnlyList<LibraryLoanResponse>> GetBorrowerLoansAsync(LibraryBorrowerType borrowerType, int borrowerId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var query = Scope(_dbContext.LibraryLoans.AsNoTracking(), schoolId)
            .Where(x => x.BorrowerType == borrowerType);

        query = borrowerType switch
        {
            LibraryBorrowerType.Student => query.Where(x => x.StudentId == borrowerId),
            LibraryBorrowerType.Teacher => query.Where(x => x.TeacherId == borrowerId),
            _ => query
        };

        var loans = await query.OrderByDescending(x => x.IssuedAt).ToListAsync(cancellationToken);
        return loans.Select(ToLoanResponse).ToList();
    }

    public async Task<LibraryLoanResponse> IssueAsync(IssueLibraryBookRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var targetSchoolId = ResolveWriteSchoolId(schoolId);
        var bookCopy = await _dbContext.LibraryBookCopies
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.Id == request.BookCopyId, cancellationToken)
            ?? throw new InvalidOperationException("Library copy was not found.");

        if (bookCopy.SchoolId != targetSchoolId)
        {
            throw new InvalidOperationException("The selected copy does not belong to the selected school.");
        }

        if (bookCopy.Status != LibraryCopyStatus.Available)
        {
            throw new InvalidOperationException("This copy is already issued.");
        }

        if (request.DueAt <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("The due date must be in the future.");
        }

        var borrower = await ResolveBorrowerAsync(request.BorrowerType, request.BorrowerId, targetSchoolId, cancellationToken);
        var now = DateTime.UtcNow;
        var currentUserDisplayName = _currentUserContext.DisplayName ?? _currentUserContext.UserName ?? "System";
        var currentUserName = _currentUserContext.UserName ?? currentUserDisplayName;
        var currentUserRole = _currentUserContext.Role?.ToString() ?? "Unknown";

        var loan = new LibraryLoan
        {
            SchoolId = targetSchoolId,
            LibraryBookId = bookCopy.LibraryBookId,
            LibraryBookCopyId = bookCopy.Id,
            BorrowerType = request.BorrowerType,
            StudentId = request.BorrowerType == LibraryBorrowerType.Student ? borrower.Id : null,
            TeacherId = request.BorrowerType == LibraryBorrowerType.Teacher ? borrower.Id : null,
            BorrowerDisplayNameSnapshot = borrower.DisplayName,
            BorrowerReferenceSnapshot = borrower.Reference,
            IssuedByDisplayNameSnapshot = currentUserDisplayName,
            IssuedByUserNameSnapshot = currentUserName,
            IssuedByRoleSnapshot = currentUserRole,
            BookTitleSnapshot = bookCopy.Book?.Title ?? string.Empty,
            BookAuthorSnapshot = bookCopy.Book?.Author,
            BookIsbnSnapshot = bookCopy.Book?.Isbn,
            CopyAccessionNumberSnapshot = bookCopy.AccessionNumber,
            CopyShelfLocationSnapshot = bookCopy.ShelfLocation,
            CopyConditionSnapshot = bookCopy.Condition,
            IssuedAt = now,
            DueAt = request.DueAt,
            CreatedAt = now,
            UpdatedAt = now
        };

        bookCopy.Status = LibraryCopyStatus.Issued;
        bookCopy.UpdatedAt = now;
        if (bookCopy.Book is not null)
        {
            bookCopy.Book.AvailableCopies = Math.Max(0, bookCopy.Book.AvailableCopies - 1);
            bookCopy.Book.UpdatedAt = now;
        }

        _dbContext.LibraryLoans.Add(loan);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return ToLoanResponse(loan);
    }

    public async Task<LibraryLoanResponse> ReturnAsync(int id, ReturnLibraryBookRequest request, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var loan = await _dbContext.LibraryLoans
            .Include(x => x.BookCopy)
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library loan was not found.");

        if (loan.ReturnedAt is not null)
        {
            throw new InvalidOperationException("This book was already returned.");
        }

        var now = DateTime.UtcNow;
        loan.ReturnedAt = now;
        loan.ReturnedByDisplayNameSnapshot = _currentUserContext.DisplayName ?? _currentUserContext.UserName ?? "System";
        loan.ReturnedByUserNameSnapshot = _currentUserContext.UserName ?? loan.ReturnedByDisplayNameSnapshot;
        loan.ReturnNotes = Normalize(request.Notes);
        loan.UpdatedAt = now;

        if (loan.BookCopy is not null)
        {
            loan.BookCopy.Status = LibraryCopyStatus.Available;
            loan.BookCopy.UpdatedAt = now;
        }

        if (loan.Book is not null)
        {
            loan.Book.AvailableCopies = Math.Min(loan.Book.TotalCopies, loan.Book.AvailableCopies + 1);
            loan.Book.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToLoanResponse(loan);
    }

    public async Task<LibraryLoanResponse> RenewAsync(int id, RenewLibraryLoanRequest request, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var loan = await _dbContext.LibraryLoans
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Library loan was not found.");

        if (loan.ReturnedAt is not null)
        {
            throw new InvalidOperationException("This loan has already been closed.");
        }

        if (request.DueAt <= DateTime.UtcNow)
        {
            throw new InvalidOperationException("The renewed due date must be in the future.");
        }

        loan.DueAt = request.DueAt;
        loan.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToLoanResponse(loan);
    }

    public async Task<IReadOnlyList<LibraryBorrowerSummaryResponse>> GetBorrowerSummariesAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        EnsureLibraryAccess();
        var loans = await Scope(_dbContext.LibraryLoans.AsNoTracking(), schoolId)
            .Where(x => x.ReturnedAt == null)
            .OrderByDescending(x => x.DueAt)
            .ToListAsync(cancellationToken);

        return loans
            .GroupBy(x => new { x.BorrowerType, BorrowerId = x.BorrowerType == LibraryBorrowerType.Student ? x.StudentId : x.TeacherId, x.BorrowerDisplayNameSnapshot, x.BorrowerReferenceSnapshot })
            .Select(group => new LibraryBorrowerSummaryResponse(
                group.Key.BorrowerType,
                group.Key.BorrowerId ?? 0,
                group.Key.BorrowerDisplayNameSnapshot,
                group.Key.BorrowerReferenceSnapshot,
                group.Count(),
                group.Count(x => x.DueAt < DateTime.UtcNow)))
            .OrderByDescending(x => x.OverdueLoanCount)
            .ThenByDescending(x => x.ActiveLoanCount)
            .ThenBy(x => x.DisplayName)
            .ToList();
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private void EnsureLibraryAccess()
    {
        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.PlatformAdmin or UserRole.LibraryAdmin))
        {
            throw new UnauthorizedAccessException("Only library and school admins can manage the library.");
        }
    }

    private IQueryable<T> Scope<T>(IQueryable<T> query, int? schoolId)
        where T : class, ISchoolScoped
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin && schoolId is null)
        {
            return query;
        }

        var resolvedSchoolId = _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId ?? _currentUserContext.SchoolId
            : RequireSchoolId();

        if (resolvedSchoolId is null)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return query.Where(x => x.SchoolId == resolvedSchoolId);
    }

    private int ResolveWriteSchoolId(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? _currentUserContext.SchoolId ?? throw new InvalidOperationException("Choose a school before managing library records.");
        }

        return RequireSchoolId();
    }

    private int ResolveDashboardSchoolId(int? schoolId)
        => _currentUserContext.Role == UserRole.PlatformAdmin ? schoolId ?? _currentUserContext.SchoolId ?? 0 : RequireSchoolId();

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId || _currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher or UserRole.PlatformAdmin or UserRole.LibraryAdmin))
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        return schoolId;
    }

    private static LibraryBookResponse ToBookResponse(LibraryBook book)
        => new(
            book.Id,
            book.SchoolId,
            book.Title,
            book.Author,
            book.Isbn,
            book.AccessionNumber,
            book.Publisher,
            book.Category,
            book.Subject,
            book.Genre,
            book.Edition,
            book.PublicationYear,
            book.ShelfLocation,
            book.Condition,
            book.TotalCopies,
            book.AvailableCopies,
            book.IsActive,
            book.CreatedAt,
            book.UpdatedAt);

    private LibraryLoanResponse ToLoanResponse(LibraryLoan loan)
        => new(
            loan.Id,
            loan.SchoolId,
            loan.LibraryBookId,
            loan.LibraryBookCopyId,
            loan.BorrowerType,
            loan.BorrowerType == LibraryBorrowerType.Student ? loan.StudentId : loan.TeacherId,
            loan.BorrowerDisplayNameSnapshot,
            loan.BorrowerReferenceSnapshot,
            loan.IssuedByDisplayNameSnapshot,
            loan.IssuedByUserNameSnapshot,
            loan.IssuedByRoleSnapshot,
            loan.BookTitleSnapshot,
            loan.BookAuthorSnapshot,
            loan.BookIsbnSnapshot,
            loan.CopyAccessionNumberSnapshot,
            loan.CopyShelfLocationSnapshot,
            loan.CopyConditionSnapshot,
            loan.IssuedAt,
            loan.DueAt,
            loan.ReturnedAt,
            loan.ReturnedByDisplayNameSnapshot,
            loan.ReturnedByUserNameSnapshot,
            loan.ReturnNotes,
            loan.ReturnedAt is null && loan.DueAt < DateTime.UtcNow);

    private async Task<(int Id, string DisplayName, string? Reference)> ResolveBorrowerAsync(LibraryBorrowerType borrowerType, int borrowerId, int schoolId, CancellationToken cancellationToken)
    {
        return borrowerType switch
        {
            LibraryBorrowerType.Student => await ResolveStudentBorrowerAsync(borrowerId, schoolId, cancellationToken),
            LibraryBorrowerType.Teacher => await ResolveTeacherBorrowerAsync(borrowerId, schoolId, cancellationToken),
            _ => throw new InvalidOperationException("Unsupported borrower type.")
        };
    }

    private async Task<(int Id, string DisplayName, string? Reference)> ResolveStudentBorrowerAsync(int studentId, int schoolId, CancellationToken cancellationToken)
    {
        var student = await Scope(_dbContext.Students.AsNoTracking(), schoolId)
            .FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken)
            ?? throw new InvalidOperationException("Student borrower was not found.");

        return (student.Id, student.FullName, student.StudentNumber);
    }

    private async Task<(int Id, string DisplayName, string? Reference)> ResolveTeacherBorrowerAsync(int teacherId, int schoolId, CancellationToken cancellationToken)
    {
        var teacher = await Scope(_dbContext.TeacherUsers.AsNoTracking().Include(x => x.Account), schoolId)
            .FirstOrDefaultAsync(x => x.Id == teacherId, cancellationToken)
            ?? throw new InvalidOperationException("Teacher borrower was not found.");

        return (teacher.Id, teacher.DisplayName, teacher.Account.Username);
    }
}
