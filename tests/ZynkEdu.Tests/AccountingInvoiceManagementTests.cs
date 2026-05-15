using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;
using ZynkEdu.Infrastructure.Services.Accounting;

namespace ZynkEdu.Tests;

public sealed class AccountingInvoiceManagementTests
{
    [Fact]
    public async Task InvoiceLifecycle_AllowsListingAmendingAndDeletingStudentInvoices()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.AccountantSuper, SchoolId = 21, UserId = 210, UserName = "school.accountant" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;

        var studentId = SeedSchoolAndStudent(context, 21, "Invoice Academy", "IA", "IA-0001", "Daisy Invoice");

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = new AccountingService(
                queryContext,
                currentUser,
                new StubAuditLogService(),
                new StubNotificationService());

            var created = await service.PostInvoiceAsync(new CreateInvoiceRequest(
                studentId,
                "Term 1",
                200m,
                new DateTime(2026, 6, 15),
                "INV-200",
                "Initial invoice"), 21);

            var invoices = await service.GetStudentInvoicesAsync(studentId, 21);
            Assert.Single(invoices);
            Assert.Equal(200m, invoices[0].TotalAmount);
            Assert.Equal(InvoiceStatus.Issued, invoices[0].Status);
            Assert.Equal(created.Id, invoices[0].AccountingTransactionId);

            var updated = await service.UpdateInvoiceAsync(
                invoices[0].Id,
                new UpdateInvoiceRequest(
                    "Term 1",
                    350m,
                    new DateTime(2026, 6, 22),
                    "INV-350",
                    "Amended invoice"),
                21);

            Assert.Equal(350m, updated.TotalAmount);
            Assert.Equal("INV-350", updated.Reference);
            Assert.Equal(new DateTime(2026, 6, 22), updated.DueAt.Date);

            var refreshedInvoices = await service.GetStudentInvoicesAsync(studentId, 21);
            Assert.Single(refreshedInvoices);
            Assert.Equal(350m, refreshedInvoices[0].TotalAmount);
            Assert.Equal("INV-350", refreshedInvoices[0].Reference);

            var account = await queryContext.StudentAccounts.FirstAsync(x => x.StudentId == studentId);
            Assert.Equal(350m, account.Balance);

            await service.DeleteInvoiceAsync(updated.Id, 21);

            var remainingInvoices = await service.GetStudentInvoicesAsync(studentId, 21);
            Assert.Empty(remainingInvoices);

            var remainingAccount = await queryContext.StudentAccounts.FirstAsync(x => x.StudentId == studentId);
            Assert.Equal(0m, remainingAccount.Balance);
        }
    }

    private static int SeedSchoolAndStudent(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, int schoolId, string schoolName, string schoolCode, string studentNumber, string studentName)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = schoolCode,
            Name = schoolName,
            Address = "1 Invoice Road",
            CreatedAt = DateTime.UtcNow
        });

        var student = new Student
        {
            SchoolId = schoolId,
            StudentNumber = studentNumber,
            FullName = studentName,
            Class = "Form 2A",
            Level = "Form 2",
            Status = "Active",
            EnrollmentYear = 2026,
            ParentEmail = "guardian@example.com",
            ParentPhone = "+263770000001",
            ParentPasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };

        context.Students.Add(student);
        context.SaveChanges();

        context.StudentAccounts.Add(new StudentAccount
        {
            SchoolId = schoolId,
            StudentId = student.Id,
            Balance = 0m,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        context.SaveChanges();

        return student.Id;
    }
}
