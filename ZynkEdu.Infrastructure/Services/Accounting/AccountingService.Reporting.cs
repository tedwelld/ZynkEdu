using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed partial class AccountingService
{
    // ──────────────────────────────────────────────────────────────────────
    // Financial statements
    // ──────────────────────────────────────────────────────────────────────

    public async Task<FinancialStatementResponse> GetFinancialStatementAsync(int? schoolId, FinancialStatementRequest request, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);

        var title = request.StatementType switch
        {
            FinancialStatementType.IncomeStatement => "Income Statement",
            FinancialStatementType.BalanceSheet => "Balance Sheet",
            FinancialStatementType.CashFlowStatement => "Cash Flow Statement",
            _ => request.StatementType.ToString()
        };

        var (from, to) = ResolvePeriodWindow(request);
        var isBalanceSheet = request.StatementType == FinancialStatementType.BalanceSheet;
        var (priorFrom, priorTo) = ResolvePriorPeriodWindow(request, from, to, isBalanceSheet);

        var periodLabel = isBalanceSheet
            ? $"As of {to:yyyy-MM-dd}"
            : $"From {from:yyyy-MM-dd} to {to:yyyy-MM-dd}";

        var comparisonLabel = isBalanceSheet
            ? $"As of {priorTo:yyyy-MM-dd}"
            : $"From {priorFrom:yyyy-MM-dd} to {priorTo:yyyy-MM-dd}";

        var columns = new List<FinancialStatementColumnResponse>
        {
            new("actual", "Actual", FinancialStatementColumnKind.Actual),
            new("prior", isBalanceSheet ? "Prior Year End" : "Prior Period", FinancialStatementColumnKind.PriorPeriod),
            new("variance", "Variance", FinancialStatementColumnKind.Variance)
        };

        IReadOnlyList<FinancialStatementRowResponse> rows = request.StatementType switch
        {
            FinancialStatementType.IncomeStatement =>
                await BuildIncomeStatementRowsAsync(resolvedSchoolId, from, to, priorFrom, priorTo, cancellationToken),
            FinancialStatementType.BalanceSheet =>
                await BuildBalanceSheetRowsAsync(resolvedSchoolId, to, priorTo, cancellationToken),
            FinancialStatementType.CashFlowStatement =>
                await BuildCashFlowRowsAsync(resolvedSchoolId, from, to, priorFrom, priorTo, cancellationToken),
            _ => []
        };

        return new FinancialStatementResponse(
            resolvedSchoolId,
            request.StatementType,
            title,
            "USD",
            to,
            periodLabel,
            comparisonLabel,
            columns,
            rows);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Operational reports
    // ──────────────────────────────────────────────────────────────────────

    public async Task<CollectionReportResponse> GetCollectionReportAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);

        var totalBilled = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .SumAsync(x => x.TotalAmount, cancellationToken);

        var invoiceCount = await _dbContext.Invoices.AsNoTracking()
            .CountAsync(x => x.SchoolId == resolvedSchoolId, cancellationToken);

        var totalCollected = await _dbContext.Payments.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .SumAsync(x => x.Amount, cancellationToken);

        var paymentCount = await _dbContext.Payments.AsNoTracking()
            .CountAsync(x => x.SchoolId == resolvedSchoolId, cancellationToken);

        var outstanding = totalBilled - totalCollected;

        return new CollectionReportResponse(resolvedSchoolId, totalBilled, totalCollected, outstanding, invoiceCount, paymentCount);
    }

    public async Task<AgingReportResponse> GetAgingReportAsync(int? schoolId = null, DateTime? asOf = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var now = asOf ?? DateTime.UtcNow;

        var invoices = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial))
            .Select(x => new { x.TotalAmount, x.DueAt })
            .ToListAsync(cancellationToken);

        var buckets = new List<AgingBucketResponse>
        {
            new("Current", invoices.Where(x => x.DueAt >= now).Sum(x => x.TotalAmount), invoices.Count(x => x.DueAt >= now)),
            new("1-30 days", invoices.Where(x => x.DueAt < now && x.DueAt >= now.AddDays(-30)).Sum(x => x.TotalAmount), invoices.Count(x => x.DueAt < now && x.DueAt >= now.AddDays(-30))),
            new("31-60 days", invoices.Where(x => x.DueAt < now.AddDays(-30) && x.DueAt >= now.AddDays(-60)).Sum(x => x.TotalAmount), invoices.Count(x => x.DueAt < now.AddDays(-30) && x.DueAt >= now.AddDays(-60))),
            new("61-90 days", invoices.Where(x => x.DueAt < now.AddDays(-60) && x.DueAt >= now.AddDays(-90)).Sum(x => x.TotalAmount), invoices.Count(x => x.DueAt < now.AddDays(-60) && x.DueAt >= now.AddDays(-90))),
            new("Over 90 days", invoices.Where(x => x.DueAt < now.AddDays(-90)).Sum(x => x.TotalAmount), invoices.Count(x => x.DueAt < now.AddDays(-90)))
        };

        return new AgingReportResponse(resolvedSchoolId, now, buckets);
    }

    public async Task<DailyCashReportResponse> GetDailyCashReportAsync(int? schoolId = null, DateTime? date = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var reportDate = (date ?? DateTime.UtcNow).Date;
        var nextDay = reportDate.AddDays(1);

        var payments = await _dbContext.Payments.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && x.ReceivedAt >= reportDate && x.ReceivedAt < nextDay)
            .ToListAsync(cancellationToken);

        var methods = payments
            .GroupBy(x => x.Method)
            .Select(g => new DailyCashMethodResponse(g.Key, g.Sum(x => x.Amount), g.Count()))
            .ToList();

        return new DailyCashReportResponse(resolvedSchoolId, reportDate, payments.Sum(x => x.Amount), methods);
    }

    public async Task<RevenueByClassReportResponse> GetRevenueByClassReportAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);

        var invoicesByClass = await _dbContext.Invoices.AsNoTracking()
            .Join(_dbContext.Students.AsNoTracking(),
                inv => inv.StudentId,
                s => s.Id,
                (inv, s) => new { inv, s })
            .Where(x => x.s.SchoolId == resolvedSchoolId)
            .GroupBy(x => new { x.s.Class, x.s.Level })
            .Select(g => new
            {
                g.Key.Class,
                g.Key.Level,
                Billed = g.Sum(x => x.inv.TotalAmount)
            })
            .ToListAsync(cancellationToken);

        var paymentsByClass = await _dbContext.Payments.AsNoTracking()
            .Join(_dbContext.Students.AsNoTracking(),
                p => p.StudentId,
                s => s.Id,
                (p, s) => new { p, s })
            .Where(x => x.s.SchoolId == resolvedSchoolId)
            .GroupBy(x => new { x.s.Class, x.s.Level })
            .Select(g => new
            {
                g.Key.Class,
                g.Key.Level,
                Collected = g.Sum(x => x.p.Amount)
            })
            .ToDictionaryAsync(x => (x.Class, x.Level), x => x.Collected, cancellationToken);

        var classes = invoicesByClass.Select(x =>
        {
            paymentsByClass.TryGetValue((x.Class, x.Level), out var collected);
            return new RevenueByClassResponse(x.Class ?? string.Empty, x.Level ?? string.Empty, x.Billed, collected, x.Billed - collected);
        }).ToList();

        return new RevenueByClassReportResponse(resolvedSchoolId, classes);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Private helpers for financial statements
    // ──────────────────────────────────────────────────────────────────────

    private static (DateTime From, DateTime To) ResolvePeriodWindow(FinancialStatementRequest request)
    {
        if (request.PeriodMode == FinancialStatementPeriodMode.Month && !string.IsNullOrEmpty(request.Month))
        {
            var parts = request.Month.Split('-');
            var year = int.Parse(parts[0], CultureInfo.InvariantCulture);
            var month = int.Parse(parts[1], CultureInfo.InvariantCulture);
            return (new DateTime(year, month, 1), new DateTime(year, month, DateTime.DaysInMonth(year, month)));
        }
        if (request.PeriodMode == FinancialStatementPeriodMode.Year && request.Year.HasValue)
            return (new DateTime(request.Year.Value, 1, 1), new DateTime(request.Year.Value, 12, 31));
        if (request.PeriodMode == FinancialStatementPeriodMode.Date && request.Date.HasValue)
            return (request.Date.Value.Date, request.Date.Value.Date);
        if (request.PeriodMode == FinancialStatementPeriodMode.Range && request.StartDate.HasValue && request.EndDate.HasValue)
            return (request.StartDate.Value.Date, request.EndDate.Value.Date);
        var now = DateTime.UtcNow.Date;
        return (new DateTime(now.Year, 1, 1), now);
    }

    private static (DateTime From, DateTime To) ResolvePriorPeriodWindow(
        FinancialStatementRequest request, DateTime from, DateTime to, bool isBalanceSheet)
    {
        if (isBalanceSheet)
        {
            var priorYearEnd = new DateTime(to.Year - 1, 12, 31);
            return (new DateTime(priorYearEnd.Year, 1, 1), priorYearEnd);
        }
        if (request.PeriodMode == FinancialStatementPeriodMode.Month)
        {
            var prev = from.AddMonths(-1);
            return (new DateTime(prev.Year, prev.Month, 1),
                    new DateTime(prev.Year, prev.Month, DateTime.DaysInMonth(prev.Year, prev.Month)));
        }
        if (request.PeriodMode == FinancialStatementPeriodMode.Year)
            return (new DateTime(from.Year - 1, 1, 1), new DateTime(from.Year - 1, 12, 31));
        return (from.AddYears(-1), to.AddYears(-1));
    }

    private async Task<Dictionary<string, (decimal Credits, decimal Debits)>> GetAccountLedgerAsync(
        int schoolId, DateTime from, DateTime to, CancellationToken ct)
    {
        var toExclusive = to.AddDays(1);
        var transactionIds = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(t => t.SchoolId == schoolId
                        && t.Status == AccountingTransactionStatus.Approved
                        && t.TransactionDate >= from
                        && t.TransactionDate < toExclusive)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (transactionIds.Count == 0)
            return new Dictionary<string, (decimal, decimal)>();

        var grouped = await _dbContext.LedgerEntries.AsNoTracking()
            .Where(le => le.SchoolId == schoolId && transactionIds.Contains(le.TransactionId))
            .GroupBy(le => le.AccountCode)
            .Select(g => new { Code = g.Key, Credits = g.Sum(x => x.Credit), Debits = g.Sum(x => x.Debit) })
            .ToListAsync(ct);

        return grouped.ToDictionary(x => x.Code, x => (x.Credits, x.Debits));
    }

    private async Task<Dictionary<string, (decimal Credits, decimal Debits)>> GetCumulativeAccountLedgerAsync(
        int schoolId, DateTime asOf, CancellationToken ct)
    {
        var toExclusive = asOf.AddDays(1);
        var transactionIds = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(t => t.SchoolId == schoolId
                        && t.Status == AccountingTransactionStatus.Approved
                        && t.TransactionDate < toExclusive)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (transactionIds.Count == 0)
            return new Dictionary<string, (decimal, decimal)>();

        var grouped = await _dbContext.LedgerEntries.AsNoTracking()
            .Where(le => le.SchoolId == schoolId && transactionIds.Contains(le.TransactionId))
            .GroupBy(le => le.AccountCode)
            .Select(g => new { Code = g.Key, Credits = g.Sum(x => x.Credit), Debits = g.Sum(x => x.Debit) })
            .ToListAsync(ct);

        return grouped.ToDictionary(x => x.Code, x => (x.Credits, x.Debits));
    }

    private async Task<IReadOnlyList<FinancialStatementRowResponse>> BuildIncomeStatementRowsAsync(
        int schoolId, DateTime from, DateTime to, DateTime priorFrom, DateTime priorTo, CancellationToken ct)
    {
        var current = await GetAccountLedgerAsync(schoolId, from, to, ct);
        var prior = await GetAccountLedgerAsync(schoolId, priorFrom, priorTo, ct);

        var revenue = current.TryGetValue("REVENUE", out var rc) ? rc.Credits : 0m;
        var revenuePrior = prior.TryGetValue("REVENUE", out var rp) ? rp.Credits : 0m;
        var expenses = current.Where(kv => kv.Key.EndsWith("EXPENSE")).Sum(kv => kv.Value.Debits);
        var expensesPrior = prior.Where(kv => kv.Key.EndsWith("EXPENSE")).Sum(kv => kv.Value.Debits);
        var netProfit = revenue - expenses;
        var netProfitPrior = revenuePrior - expensesPrior;

        return
        [
            StatementRow("revenue", "Revenue", FinancialStatementRowKind.LineItem, revenue, revenuePrior),
            StatementRow("operating-expenses", "Operating Expenses", FinancialStatementRowKind.LineItem, expenses, expensesPrior),
            StatementRow("net-profit", "Net Profit", FinancialStatementRowKind.Total, netProfit, netProfitPrior)
        ];
    }

    private async Task<IReadOnlyList<FinancialStatementRowResponse>> BuildBalanceSheetRowsAsync(
        int schoolId, DateTime asOf, DateTime priorAsOf, CancellationToken ct)
    {
        var current = await GetCumulativeAccountLedgerAsync(schoolId, asOf, ct);
        var prior = await GetCumulativeAccountLedgerAsync(schoolId, priorAsOf, ct);

        decimal NetDebitBalance(Dictionary<string, (decimal Credits, decimal Debits)> ledger, string code)
            => ledger.TryGetValue(code, out var e) ? e.Debits - e.Credits : 0m;

        var cash = NetDebitBalance(current, "CASH");
        var cashPrior = NetDebitBalance(prior, "CASH");
        var ar = NetDebitBalance(current, "ACCOUNTS_RECEIVABLE");
        var arPrior = NetDebitBalance(prior, "ACCOUNTS_RECEIVABLE");
        var totalAssets = cash + ar;
        var totalAssetsPrior = cashPrior + arPrior;

        return
        [
            StatementRow("cash", "Cash", FinancialStatementRowKind.LineItem, cash, cashPrior),
            StatementRow("accounts-receivable", "Accounts Receivable", FinancialStatementRowKind.LineItem, ar, arPrior),
            StatementRow("total-assets", "Total Assets", FinancialStatementRowKind.Total, totalAssets, totalAssetsPrior),
            StatementRow("total-liabilities-and-equity", "Total Liabilities & Equity", FinancialStatementRowKind.Total, totalAssets, totalAssetsPrior)
        ];
    }

    private async Task<IReadOnlyList<FinancialStatementRowResponse>> BuildCashFlowRowsAsync(
        int schoolId, DateTime from, DateTime to, DateTime priorFrom, DateTime priorTo, CancellationToken ct)
    {
        var current = await GetAccountLedgerAsync(schoolId, from, to, ct);
        var prior = await GetAccountLedgerAsync(schoolId, priorFrom, priorTo, ct);

        var currentCash = current.TryGetValue("CASH", out var cc) ? cc : (Credits: 0m, Debits: 0m);
        var cashReceived = currentCash.Debits;
        var cashRefunds = currentCash.Credits;
        var netCash = cashReceived - cashRefunds;

        var priorCash = prior.TryGetValue("CASH", out var pc) ? pc : (Credits: 0m, Debits: 0m);
        var cashReceivedPrior = priorCash.Debits;
        var cashRefundsPrior = priorCash.Credits;
        var netCashPrior = cashReceivedPrior - cashRefundsPrior;

        return
        [
            StatementRow("operating-activities", "Operating Activities", FinancialStatementRowKind.Subtotal, netCash, netCashPrior),
            StatementRow("cash-received", "Cash Received", FinancialStatementRowKind.LineItem, cashReceived, cashReceivedPrior),
            StatementRow("cash-refunds", "Refunds Paid", FinancialStatementRowKind.LineItem, -cashRefunds, -cashRefundsPrior),
            StatementRow("net-increase-in-cash", "Net Increase in Cash", FinancialStatementRowKind.Total, netCash, netCashPrior)
        ];
    }

    private static FinancialStatementRowResponse StatementRow(
        string key, string label, FinancialStatementRowKind kind, decimal actual, decimal priorPeriod)
    {
        var variance = actual - priorPeriod;
        return new FinancialStatementRowResponse(key, label, 0, kind, actual, priorPeriod, variance, null, null);
    }
}
