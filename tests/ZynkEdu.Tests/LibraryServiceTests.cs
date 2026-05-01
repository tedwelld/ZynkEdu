using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;

namespace ZynkEdu.Tests;

public sealed class LibraryServiceTests
{
    [Fact]
    public async Task DeleteBookAsync_PhysicallyRemovesMasterData_ButKeepsLoanSnapshots()
    {
        var currentUser = new TestCurrentUserContext
        {
            Role = UserRole.LibraryAdmin,
            SchoolId = 10,
            UserId = 100,
            UserName = "library.admin",
            DisplayName = "Library Admin"
        };

        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        await using (context)
        {
            context.Schools.Add(new School
            {
                Id = 10,
                SchoolCode = "HA",
                Name = "Harare Academy",
                Address = "10 Example Road",
                CreatedAt = DateTime.UtcNow
            });

            context.Students.Add(new Student
            {
                SchoolId = 10,
                StudentNumber = "HA-0001",
                FullName = "Student One",
                Class = "Form 1A",
                Level = "ZGC Level",
                Status = "Active",
                EnrollmentYear = 2026,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();

            var service = new LibraryService(context, currentUser);
            var book = await service.CreateBookAsync(new CreateLibraryBookRequest(
                Title: "Mathematics Grade 10",
                Author: "T. Teacher",
                Isbn: "978000000001",
                AccessionNumber: "ACC-001",
                Publisher: "Zim Press",
                Category: "Textbook",
                Subject: "Math",
                Genre: "Education",
                Edition: "2nd",
                PublicationYear: 2024,
                ShelfLocation: "A1",
                Condition: "Good",
                InitialCopies: 1,
                IsActive: true));

            var copy = await context.LibraryBookCopies.AsNoTracking().SingleAsync(x => x.LibraryBookId == book.Id);

            var loan = await service.IssueAsync(new IssueLibraryBookRequest(
                BorrowerType: LibraryBorrowerType.Student,
                BorrowerId: context.Students.Single().Id,
                BookCopyId: copy.Id,
                DueAt: DateTime.UtcNow.AddDays(14),
                Notes: "End of term"));

            Assert.Equal(book.Title, loan.BookTitle);
            Assert.Equal("Student One", loan.BorrowerDisplayName);

            var returned = await service.ReturnAsync(loan.Id, new ReturnLibraryBookRequest("Returned on time"));
            Assert.NotNull(returned.ReturnedAt);

            await service.DeleteBookAsync(book.Id);

            Assert.False(await context.LibraryBooks.AsNoTracking().AnyAsync(x => x.Id == book.Id));
            Assert.False(await context.LibraryBookCopies.AsNoTracking().AnyAsync(x => x.Id == copy.Id));

            var savedLoan = await context.LibraryLoans.AsNoTracking().SingleAsync(x => x.Id == loan.Id);
            Assert.Equal("Mathematics Grade 10", savedLoan.BookTitleSnapshot);
            Assert.Equal("Student One", savedLoan.BorrowerDisplayNameSnapshot);
            Assert.Equal("ACC-001", savedLoan.CopyAccessionNumberSnapshot);
            Assert.Equal("library.admin", savedLoan.IssuedByUserNameSnapshot);
        }
    }
}
