using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;
using ZynkEdu.Infrastructure.Services;
using ZynkEdu.Infrastructure.Services.Accounting;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace ZynkEdu.Tests;

public class AccountingStudentStatementTests
{
    [Fact]
    public async Task GetStudentStatementByTermAsync_FiltersTermTransactionsAndComputesOpeningBalance()
    {
        var (connection, dbContext) = await TestDatabase.CreateContextAsync(
            TestDatabase.CreateDatabasePath(),
            new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 99, UserId = 1 });
        await using var _conn = connection;
        await using var _ctx = dbContext;

        var serviceProvider = new ServiceCollection()
            .AddScoped<ZynkEduDbContext>(_ => dbContext)
            .AddScoped<ICurrentUserContext>(_ => new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 99, UserId = 1 })
            .AddScoped<IAuditLogService, NoOpAuditLogService>()
            .AddScoped<INotificationService>(_ => new Mock<INotificationService>().Object)
            .AddScoped<IEmailSender>(_ => new StubEmailSender())
            .AddScoped<IAccountingService, AccountingService>()
            .BuildServiceProvider();

        var service = serviceProvider.GetRequiredService<IAccountingService>() as AccountingService;

        var schoolId = 99;
        var studentId = await SeedTestDataAsync(dbContext, schoolId);
        var account = await dbContext.StudentAccounts.FirstAsync(x => x.StudentId == studentId);

        var priorDate = DateTime.UtcNow.AddMonths(-2);
        var termDate = DateTime.UtcNow.AddDays(-10);
        var paymentDate = DateTime.UtcNow.AddDays(-5);

        // Prior transaction (before term) — must include StudentAccountId
        dbContext.AccountingTransactions.Add(new AccountingTransaction
        {
            Id = 1,
            SchoolId = schoolId,
            StudentId = studentId,
            StudentAccountId = account.Id,
            Type = AccountingTransactionType.Invoice,
            Status = AccountingTransactionStatus.Approved,
            Amount = 100m,
            TransactionDate = priorDate,
            CreatedByUserId = 1,
            ApprovedByUserId = 1,
            ApprovedAt = priorDate,
            CreatedAt = priorDate
        });
        await dbContext.SaveChangesAsync();

        // Term invoice transaction — saved before the Invoice row to satisfy FK
        var termTransaction = new AccountingTransaction
        {
            Id = 2,
            SchoolId = schoolId,
            StudentId = studentId,
            StudentAccountId = account.Id,
            Type = AccountingTransactionType.Invoice,
            Status = AccountingTransactionStatus.Approved,
            Amount = 500m,
            TransactionDate = termDate,
            CreatedByUserId = 1,
            ApprovedByUserId = 1,
            ApprovedAt = termDate,
            CreatedAt = termDate
        };
        dbContext.AccountingTransactions.Add(termTransaction);
        await dbContext.SaveChangesAsync();

        dbContext.Invoices.Add(new Invoice
        {
            SchoolId = schoolId,
            StudentId = studentId,
            StudentAccountId = account.Id,
            Term = "Term1",
            TotalAmount = 500m,
            Status = InvoiceStatus.Issued,
            IssuedAt = termDate,
            DueAt = DateTime.UtcNow.AddDays(10),
            CreatedByUserId = 1,
            AccountingTransactionId = termTransaction.Id
        });
        await dbContext.SaveChangesAsync();

        // Term payment
        dbContext.AccountingTransactions.Add(new AccountingTransaction
        {
            Id = 3,
            SchoolId = schoolId,
            StudentId = studentId,
            StudentAccountId = account.Id,
            Type = AccountingTransactionType.Payment,
            Status = AccountingTransactionStatus.Approved,
            Amount = 200m,
            TransactionDate = paymentDate,
            CreatedByUserId = 1,
            ApprovedByUserId = 1,
            ApprovedAt = paymentDate,
            CreatedAt = paymentDate
        });
        await dbContext.SaveChangesAsync();

        var response = await service!.GetStudentStatementByTermAsync(studentId, "Term1");

        Assert.NotNull(response);
        Assert.Equal("Term1", response.StatementTerm);
        Assert.Single(response.Transactions, t => t.TransactionId == 2); // term invoice
        Assert.Single(response.Transactions, t => t.TransactionId == 3); // payment in term window
        Assert.Equal(100m, response.OpeningBalance);   // prior invoice only
        Assert.Equal(400m, response.ClosingBalance);   // 100 + 500 - 200
    }

    private static async Task<int> SeedTestDataAsync(ZynkEduDbContext context, int schoolId)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = "TS",
            Name = "Test School",
            Address = "Test",
            CreatedAt = DateTime.UtcNow
        });

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

        context.StudentAccounts.Add(new StudentAccount
        {
            Id = 1,
            SchoolId = schoolId,
            StudentId = student.Id,
            Balance = 0m,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        return student.Id;
    }
}
