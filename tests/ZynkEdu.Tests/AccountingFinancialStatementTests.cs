using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Services;
using ZynkEdu.Infrastructure.Services.Accounting;

namespace ZynkEdu.Tests;

public sealed class AccountingFinancialStatementTests
{
    [Fact]
    public async Task GetFinancialStatementAsync_ReturnsIncomeStatementWithPeriodVariance()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 11, UserId = 110, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        SeedSchoolAndStudent(context, 11, "North Academy", "NA", "NA-0001", "Alice North");
        await SeedIncomeStatementTransactionsAsync(context);

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var statement = await service.GetFinancialStatementAsync(11, new FinancialStatementRequest(
                FinancialStatementType.IncomeStatement,
                FinancialStatementPeriodMode.Month,
                Month: "2026-05",
                Year: 2026));

            Assert.Equal("Income Statement", statement.Title);
            Assert.Equal("From 2026-05-01 to 2026-05-31", statement.PeriodLabel);
            Assert.Equal("From 2026-04-01 to 2026-04-30", statement.ComparisonLabel);

            var rows = statement.Rows.ToDictionary(x => x.Key);
            Assert.Equal(200m, rows["revenue"].Actual);
            Assert.Equal(50m, rows["revenue"].PriorPeriod);
            Assert.Equal(150m, rows["revenue"].Variance);

            Assert.Equal(10m, rows["operating-expenses"].Actual);
            Assert.Equal(5m, rows["operating-expenses"].PriorPeriod);
            Assert.Equal(190m, rows["net-profit"].Actual);
            Assert.Equal(45m, rows["net-profit"].PriorPeriod);
        }
    }

    [Fact]
    public async Task GetFinancialStatementAsync_ReturnsBalanceSheetAgainstPriorYearEnd()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 12, UserId = 120, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        SeedSchoolAndStudent(context, 12, "South Academy", "SA", "SA-0001", "Brian South");
        await SeedBalanceSheetTransactionsAsync(context);

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var statement = await service.GetFinancialStatementAsync(12, new FinancialStatementRequest(
                FinancialStatementType.BalanceSheet,
                FinancialStatementPeriodMode.Month,
                Month: "2026-05",
                Year: 2026));

            Assert.Equal("Balance Sheet", statement.Title);
            Assert.Equal("As of 2026-05-31", statement.PeriodLabel);
            Assert.Equal("As of 2025-12-31", statement.ComparisonLabel);

            var rows = statement.Rows.ToDictionary(x => x.Key);
            Assert.Equal(170m, rows["cash"].Actual);
            Assert.Equal(30m, rows["cash"].PriorPeriod);
            Assert.Equal(130m, rows["accounts-receivable"].Actual);
            Assert.Equal(70m, rows["accounts-receivable"].PriorPeriod);
            Assert.Equal(300m, rows["total-assets"].Actual);
            Assert.Equal(100m, rows["total-assets"].PriorPeriod);
            Assert.Equal(rows["total-assets"].Actual, rows["total-liabilities-and-equity"].Actual);
        }
    }

    [Fact]
    public async Task GetFinancialStatementAsync_ReturnsCashFlowStatementWithOperatingCashMovement()
    {
        var currentUser = new TestCurrentUserContext { Role = UserRole.Admin, SchoolId = 13, UserId = 130, UserName = "school.admin" };
        var databasePath = TestDatabase.CreateDatabasePath();
        var (connection, context) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _ = connection;
        SeedSchoolAndStudent(context, 13, "West Academy", "WA", "WA-0001", "Carol West");
        await SeedCashFlowTransactionsAsync(context);

        var (queryConnection, queryContext) = await TestDatabase.CreateContextAsync(databasePath, currentUser);
        await using var _queryConnection = queryConnection;
        await using (queryContext)
        {
            var service = CreateService(queryContext, currentUser);

            var statement = await service.GetFinancialStatementAsync(13, new FinancialStatementRequest(
                FinancialStatementType.CashFlowStatement,
                FinancialStatementPeriodMode.Month,
                Month: "2026-05",
                Year: 2026));

            Assert.Equal("Cash Flow Statement", statement.Title);
            var rows = statement.Rows.ToDictionary(x => x.Key);
            Assert.Equal(120m, rows["operating-activities"].Actual);
            Assert.Equal(20m, rows["operating-activities"].PriorPeriod);
            Assert.Equal(140m, rows["cash-received"].Actual);
            Assert.Equal(-20m, rows["cash-refunds"].Actual);
            Assert.Equal(120m, rows["net-increase-in-cash"].Actual);
            Assert.Equal(20m, rows["net-increase-in-cash"].PriorPeriod);
        }
    }

    private static AccountingService CreateService(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, ICurrentUserContext currentUser)
    {
        return new AccountingService(
            context,
            currentUser,
            new StubAuditLogService(),
            new RecordingEmailSender(),
            new ReportEmailTemplateService(),
            new StubNotificationService());
    }

    private static void SeedSchoolAndStudent(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context, int schoolId, string schoolName, string schoolCode, string studentNumber, string studentName)
    {
        context.Schools.Add(new School
        {
            Id = schoolId,
            SchoolCode = schoolCode,
            Name = schoolName,
            Address = "1 Example Road",
            CreatedAt = DateTime.UtcNow
        });

        var student = new Student
        {
            SchoolId = schoolId,
            StudentNumber = studentNumber,
            FullName = studentName,
            Class = "Form 1A",
            Level = "Form 1",
            Status = "Active",
            EnrollmentYear = 2026,
            ParentEmail = $"{studentName.Replace(" ", string.Empty).ToLowerInvariant()}@example.com",
            ParentPhone = "+263770000000",
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
    }

    private static async Task SeedIncomeStatementTransactionsAsync(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context)
    {
        await AddApprovedTransactionAsync(context, 11, AccountingTransactionType.Invoice, 200m, new DateTime(2026, 5, 10), "NA-INV-200", "May invoice", "ACCOUNTS_RECEIVABLE", "REVENUE");
        await AddApprovedTransactionAsync(context, 11, AccountingTransactionType.Discount, 10m, new DateTime(2026, 5, 12), "NA-DIS-010", "May discount", "DISCOUNT_EXPENSE", "ACCOUNTS_RECEIVABLE");
        await AddApprovedTransactionAsync(context, 11, AccountingTransactionType.Invoice, 50m, new DateTime(2026, 4, 8), "NA-INV-050", "April invoice", "ACCOUNTS_RECEIVABLE", "REVENUE");
        await AddApprovedTransactionAsync(context, 11, AccountingTransactionType.Discount, 5m, new DateTime(2026, 4, 10), "NA-DIS-005", "April discount", "DISCOUNT_EXPENSE", "ACCOUNTS_RECEIVABLE");
    }

    private static async Task SeedBalanceSheetTransactionsAsync(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context)
    {
        await AddApprovedTransactionAsync(context, 12, AccountingTransactionType.Invoice, 100m, new DateTime(2025, 12, 10), "SA-INV-100", "Prior year invoice", "ACCOUNTS_RECEIVABLE", "REVENUE");
        await AddApprovedTransactionAsync(context, 12, AccountingTransactionType.Payment, 30m, new DateTime(2025, 12, 12), "SA-PAY-030", "Prior year payment", "CASH", "ACCOUNTS_RECEIVABLE");
        await AddApprovedTransactionAsync(context, 12, AccountingTransactionType.Invoice, 200m, new DateTime(2026, 5, 10), "SA-INV-200", "Current year invoice", "ACCOUNTS_RECEIVABLE", "REVENUE");
        await AddApprovedTransactionAsync(context, 12, AccountingTransactionType.Payment, 140m, new DateTime(2026, 5, 15), "SA-PAY-140", "Current year payment", "CASH", "ACCOUNTS_RECEIVABLE");
    }

    private static async Task SeedCashFlowTransactionsAsync(ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context)
    {
        await AddApprovedTransactionAsync(context, 13, AccountingTransactionType.Payment, 20m, new DateTime(2026, 4, 7), "WA-PAY-020", "April payment", "CASH", "ACCOUNTS_RECEIVABLE");
        await AddApprovedTransactionAsync(context, 13, AccountingTransactionType.Payment, 140m, new DateTime(2026, 5, 7), "WA-PAY-140", "May payment", "CASH", "ACCOUNTS_RECEIVABLE");
        await AddApprovedTransactionAsync(context, 13, AccountingTransactionType.Refund, 20m, new DateTime(2026, 5, 9), "WA-REF-020", "May refund", "REFUNDS", "CASH");
    }

    private static async Task AddApprovedTransactionAsync(
        ZynkEdu.Infrastructure.Persistence.ZynkEduDbContext context,
        int schoolId,
        AccountingTransactionType type,
        decimal amount,
        DateTime transactionDate,
        string reference,
        string description,
        string debitAccountCode,
        string creditAccountCode)
    {
        var student = await context.Students.FirstAsync(x => x.SchoolId == schoolId);
        var account = await context.StudentAccounts.FirstAsync(x => x.StudentId == student.Id);

        var transaction = new AccountingTransaction
        {
            SchoolId = schoolId,
            StudentId = student.Id,
            StudentAccountId = account.Id,
            Type = type,
            Status = AccountingTransactionStatus.Approved,
            Amount = amount,
            TransactionDate = transactionDate,
            Reference = reference,
            Description = description,
            CreatedByUserId = 1,
            ApprovedByUserId = 1,
            ApprovedAt = transactionDate,
            CreatedAt = transactionDate
        };

        context.AccountingTransactions.Add(transaction);
        await context.SaveChangesAsync();

        context.LedgerEntries.AddRange(
            new LedgerEntry
            {
                SchoolId = schoolId,
                TransactionId = transaction.Id,
                Debit = amount,
                Credit = 0m,
                AccountCode = debitAccountCode,
                CreatedAt = transactionDate
            },
            new LedgerEntry
            {
                SchoolId = schoolId,
                TransactionId = transaction.Id,
                Debit = 0m,
                Credit = amount,
                AccountCode = creditAccountCode,
                CreatedAt = transactionDate
            });

        account.Balance += type switch
        {
            AccountingTransactionType.Invoice => amount,
            AccountingTransactionType.Payment => -amount,
            AccountingTransactionType.Discount => -amount,
            AccountingTransactionType.Adjustment => amount,
            AccountingTransactionType.Refund => amount,
            _ => 0m
        };
        account.UpdatedAt = transactionDate;
        await context.SaveChangesAsync();
    }
}
