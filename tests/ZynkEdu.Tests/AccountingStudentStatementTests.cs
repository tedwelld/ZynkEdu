using Xunit;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services.Accounting;
using ZynkEdu.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Domain.Entities.Accounting;

namespace ZynkEdu.Tests;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services.Accounting;
using ZynkEdu.Infrastructure.Services;
using ZynkEdu.Tests;
using Moq;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;


public class AccountingStudentStatementTests
{
    [Fact]
    public async Task GetStudentStatementByTermAsync_FiltersTermTransactionsAndComputesOpeningBalance()
    {
        // Create in-memory context
        var (connection, dbContext) = await TestDatabase.CreateContextAsync(TestDatabase.CreateDatabasePath(), new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 99, UserId = 1 });
        await using var _conn = connection;
        await using var _ctx = dbContext;

        var serviceProvider = new ServiceCollection()
            .AddScoped<ZynkEduDbContext>(_ => dbContext)
            .AddScoped<ICurrentUserContext>(_ => new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 99, UserId = 1 })
            .AddScoped<IAuditLogService, NoOpAuditLogService>()
            .AddScoped<INotificationService>(_ => new Mock<INotificationService>().Object)
            .AddScoped<IAccountingService, AccountingService>()
            .BuildServiceProvider();

        var service = serviceProvider.GetRequiredService<IAccountingService>() as AccountingService;

        // Seed school, student, account
        var schoolId = 99;
        var studentId = await SeedTestDataAsync(dbContext, schoolId);

        // Prior transaction (before term)
        dbContext.AccountingTransactions.Add(new Domain.Entities.Accounting.AccountingTransaction
        {
            Id = 1,
            SchoolId = schoolId,
            StudentId = studentId,
            Type = AccountingTransactionType.Invoice,
            Status = AccountingTransactionStatus.Approved,
            Amount = 100m,
            TransactionDate = DateTime.UtcNow.AddMonths(-2)
        });
        await dbContext.SaveChangesAsync();

        // Term invoice
        var account = await dbContext.StudentAccounts.FirstAsync(x => x.StudentId == studentId);
        var termTransaction = new Domain.Entities.Accounting.AccountingTransaction
        {
            Id = 2,
            SchoolId = schoolId,
            StudentId = studentId,
            Type = AccountingTransactionType.Invoice,
            Status = AccountingTransactionStatus.Approved,
            Amount = 500m,
            TransactionDate = DateTime.UtcNow.AddDays(-10)
        };
        dbContext.AccountingTransactions.Add(termTransaction);

        var invoice = new Invoice
        {
            SchoolId = schoolId,
            StudentId = studentId,
            StudentAccountId = account.Id,
            Term = "Term1",
            TotalAmount = 500m,
            Status = InvoiceStatus.Issued,
            IssuedAt = DateTime.UtcNow.AddDays(-10),
            DueAt = DateTime.UtcNow.AddDays(10),
            CreatedByUserId = 1,
            AccountingTransactionId = termTransaction.Id
        };
        dbContext.Invoices.Add(invoice);

        // Term payment
        var paymentTransaction = new Domain.Entities.Accounting.AccountingTransaction
        {
            Id = 3,
            SchoolId = schoolId,
            StudentId = studentId,
            Type = AccountingTransactionType.Payment,
            Status = AccountingTransactionStatus.Approved,
            Amount = 200m,
            TransactionDate = DateTime.UtcNow.AddDays(-5)
        };
        dbContext.AccountingTransactions.Add(paymentTransaction);
        await dbContext.SaveChangesAsync();

        var response = await service!.GetStudentStatementByTermAsync(studentId, "Term1");

        Assert.NotNull(response);
        Assert.Equal("Term1", response.StatementTerm);
        Assert.Single(response.Transactions.Where(t => t.TransactionId == 2)); // term invoice
        Assert.Single(response.Transactions.Where(t => t.TransactionId == 3)); // payment
        Assert.Equal(100m, response.OpeningBalance); // prior
        Assert.Equal(400m, response.ClosingBalance); // 100 +500 -200
    }

    private static async Task<int> SeedTestDataAsync(ZynkEduDbContext context, int schoolId)
    {
        var school = new School { Id = schoolId, SchoolCode = "TS", Name = "Test School", Address = "Test", CreatedAt = DateTime.UtcNow };
        context.Schools.Add(school);

        var student = new Student
        {
            Id = 1,
            SchoolId = schoolId,
            StudentNumber = "TS-0001",
            FullName = "Test Student",
            Class = "Form 1A",
            Level = "Form 1",
            Status = "Active",
            EnrollmentYear = DateTime.UtcNow.Year,
            CreatedAt = DateTime.UtcNow
        };
        context.Students.Add(student);

        var account = new StudentAccount
        {
            Id = 1,
            SchoolId = schoolId,
            StudentId = student.Id,
            Balance = 0m,
            Currency = "USD"
        };
        context.StudentAccounts.Add(account);

        await context.SaveChangesAsync();
        return student.Id;
    }
}
