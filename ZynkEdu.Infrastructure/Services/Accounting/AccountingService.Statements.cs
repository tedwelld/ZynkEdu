using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed partial class AccountingService
{
    // ──────────────────────────────────────────────────────────────────────
    // Student statements
    // ──────────────────────────────────────────────────────────────────────

    public async Task<StudentStatementResponse> GetStudentStatementAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken, createIfMissing: false);

        var transactions = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .OrderBy(x => x.TransactionDate)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var runningBalance = 0m;
        var lines = new List<StatementLineResponse>(transactions.Count);
        foreach (var transaction in transactions)
        {
            var delta = GetBalanceDelta(transaction.Type, transaction.Amount);
            if (transaction.Status == AccountingTransactionStatus.Pending)
            {
                delta = 0m;
            }

            runningBalance += delta;
            var debit = transaction.Type is AccountingTransactionType.Payment or AccountingTransactionType.Discount ? 0m : transaction.Amount;
            var credit = transaction.Type is AccountingTransactionType.Payment or AccountingTransactionType.Discount ? transaction.Amount : 0m;

            lines.Add(new StatementLineResponse(
                transaction.Id,
                transaction.Type,
                transaction.Status,
                transaction.Amount,
                transaction.TransactionDate,
                transaction.Reference,
                transaction.Description,
                debit,
                credit,
                runningBalance));
        }

        return new StudentStatementResponse(
            student.Id,
            student.FullName,
            student.SchoolId,
            null,
            account?.Currency ?? "USD",
            0m,
            runningBalance,
            lines);
    }

    public async Task<StudentStatementResponse> GetStudentStatementByTermAsync(int studentId, string term, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken, createIfMissing: false);

        decimal openingBalance = 0m;
        IQueryable<Domain.Entities.Accounting.AccountingTransaction> transactionQuery;

        if (!string.IsNullOrEmpty(term))
        {
            var termStartDate = await _dbContext.Invoices.AsNoTracking()
                .Where(i => i.StudentId == student.Id && i.SchoolId == student.SchoolId && i.Term == term)
                .Select(i => (DateTime?)i.IssuedAt)
                .MinAsync(cancellationToken);

            if (termStartDate.HasValue)
            {
                var priorTransactions = await _dbContext.AccountingTransactions.AsNoTracking()
                    .Where(t => t.StudentId == student.Id
                                && t.SchoolId == student.SchoolId
                                && t.Status == AccountingTransactionStatus.Approved
                                && t.TransactionDate < termStartDate.Value)
                    .Select(t => new { t.Type, t.Amount })
                    .ToListAsync(cancellationToken);

                openingBalance = priorTransactions.Sum(t => GetBalanceDelta(t.Type, t.Amount));
            }

            var termStartOrMin = termStartDate ?? DateTime.MinValue;
            transactionQuery = _dbContext.AccountingTransactions.AsNoTracking()
                .Where(t => t.StudentId == student.Id
                            && t.SchoolId == student.SchoolId
                            && t.Status == AccountingTransactionStatus.Approved
                            && t.TransactionDate >= termStartOrMin);
        }
        else
        {
            transactionQuery = _dbContext.AccountingTransactions.AsNoTracking()
                .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId);
        }

        var transactions = await transactionQuery
            .OrderBy(x => x.TransactionDate)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var runningBalance = openingBalance;
        var lines = new List<StatementLineResponse>(transactions.Count);
        foreach (var transaction in transactions)
        {
            var delta = GetBalanceDelta(transaction.Type, transaction.Amount);
            if (transaction.Status == AccountingTransactionStatus.Pending)
            {
                delta = 0m;
            }

            runningBalance += delta;
            var debit = transaction.Type is AccountingTransactionType.Payment or AccountingTransactionType.Discount ? 0m : transaction.Amount;
            var credit = transaction.Type is AccountingTransactionType.Payment or AccountingTransactionType.Discount ? transaction.Amount : 0m;

            lines.Add(new StatementLineResponse(
                transaction.Id,
                transaction.Type,
                transaction.Status,
                transaction.Amount,
                transaction.TransactionDate,
                transaction.Reference,
                transaction.Description,
                debit,
                credit,
                runningBalance));
        }

        return new StudentStatementResponse(
            student.Id,
            student.FullName,
            student.SchoolId,
            term,
            account?.Currency ?? "USD",
            openingBalance,
            runningBalance,
            lines);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Overdue and financial flags
    // ──────────────────────────────────────────────────────────────────────

    public async Task<DefaulterReportResponse> GetDefaultersAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var now = DateTime.UtcNow;

        var overdueStudentIds = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId
                        && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial)
                        && x.DueAt < now)
            .Select(x => x.StudentId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (overdueStudentIds.Count == 0)
        {
            return new DefaulterReportResponse(resolvedSchoolId, []);
        }

        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.Id) && x.SchoolId == resolvedSchoolId)
            .ToListAsync(cancellationToken);

        var balances = await _dbContext.StudentAccounts.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId)
            .ToDictionaryAsync(x => x.StudentId, x => x.Balance, cancellationToken);

        var lastPayments = await _dbContext.Payments.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId)
            .GroupBy(x => x.StudentId)
            .Select(g => new { StudentId = g.Key, LastAt = g.Max(p => p.ReceivedAt) })
            .ToDictionaryAsync(x => x.StudentId, x => x.LastAt, cancellationToken);

        var lastInvoices = await _dbContext.Invoices.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId)
            .GroupBy(x => x.StudentId)
            .Select(g => new { StudentId = g.Key, LastAt = g.Max(i => i.IssuedAt) })
            .ToDictionaryAsync(x => x.StudentId, x => x.LastAt, cancellationToken);

        var defaulters = students.Select(s =>
        {
            balances.TryGetValue(s.Id, out var balance);
            lastPayments.TryGetValue(s.Id, out var lastPayment);
            lastInvoices.TryGetValue(s.Id, out var lastInvoice);
            return new DefaulterResponse(s.Id, s.FullName, s.Class ?? string.Empty, s.Level ?? string.Empty, balance, lastPayment, lastInvoice);
        }).ToList();

        return new DefaulterReportResponse(resolvedSchoolId, defaulters);
    }

    public async Task<StudentFinancialFlagResponse> GetStudentFinancialFlagAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);
        var now = DateTime.UtcNow;

        var balance = await _dbContext.StudentAccounts.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .Select(x => x.Balance)
            .FirstOrDefaultAsync(cancellationToken);

        var oldestOverdue = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId
                        && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial)
                        && x.DueAt < now)
            .OrderBy(x => x.DueAt)
            .Select(x => (DateTime?)x.DueAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new StudentFinancialFlagResponse(
            student.Id,
            student.FullName,
            balance,
            oldestOverdue.HasValue,
            oldestOverdue);
    }

    public async Task<IReadOnlyList<StudentFinancialFlagResponse>> GetStudentsWithOverdueInvoicesAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var now = DateTime.UtcNow;

        var overdueStudentIds = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId
                        && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial)
                        && x.DueAt < now)
            .Select(x => x.StudentId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (overdueStudentIds.Count == 0)
        {
            return [];
        }

        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.Id) && x.SchoolId == resolvedSchoolId)
            .ToListAsync(cancellationToken);

        var balances = await _dbContext.StudentAccounts.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId)
            .ToDictionaryAsync(x => x.StudentId, x => x.Balance, cancellationToken);

        var oldestOverdues = await _dbContext.Invoices.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId
                        && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial)
                        && x.DueAt < now)
            .GroupBy(x => x.StudentId)
            .Select(g => new { StudentId = g.Key, OldestDue = g.Min(i => i.DueAt) })
            .ToDictionaryAsync(x => x.StudentId, x => (DateTime?)x.OldestDue, cancellationToken);

        return students.Select(s =>
        {
            balances.TryGetValue(s.Id, out var balance);
            oldestOverdues.TryGetValue(s.Id, out var oldest);
            return new StudentFinancialFlagResponse(s.Id, s.FullName, balance, true, oldest);
        }).ToList();
    }
}
