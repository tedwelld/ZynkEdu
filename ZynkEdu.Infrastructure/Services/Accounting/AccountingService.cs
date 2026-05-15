using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using ZynkEdu.Infrastructure.Persistence;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed class AccountingService : IAccountingService
{
    private const decimal LargeTransactionApprovalThreshold = 1000m;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationService _notificationService;

    public AccountingService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IAuditLogService auditLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
        _notificationService = notificationService;
    }

    public async Task<IReadOnlyList<FeeStructureResponse>> GetFeeStructuresAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.FeeStructures.AsNoTracking().AsQueryable();

        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            query = query.Where(x => x.SchoolId == RequireSchoolId());
        }
        else if (schoolId is not null)
        {
            query = query.Where(x => x.SchoolId == schoolId);
        }

        return await query
            .OrderBy(x => x.GradeLevel)
            .ThenBy(x => x.Term)
            .Select(x => new FeeStructureResponse(x.Id, x.SchoolId, x.GradeLevel, x.Term, x.Amount, x.Description, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<FeeStructureResponse> SaveFeeStructureAsync(int? schoolId, FeeStructureRequest request, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveSchoolIdForWrite(schoolId);
        var gradeLevel = request.GradeLevel.Trim();
        var term = request.Term.Trim();

        var existing = await _dbContext.FeeStructures
            .FirstOrDefaultAsync(x => x.SchoolId == resolvedSchoolId && x.GradeLevel == gradeLevel && x.Term == term, cancellationToken);

        var before = existing is null ? null : new
        {
            existing.Id,
            existing.SchoolId,
            existing.GradeLevel,
            existing.Term,
            existing.Amount,
            existing.Description,
            existing.UpdatedAt
        };

        if (existing is null)
        {
            existing = new FeeStructure
            {
                SchoolId = resolvedSchoolId,
                GradeLevel = gradeLevel,
                Term = term,
                Amount = request.Amount,
                Description = request.Description?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.FeeStructures.Add(existing);
        }
        else
        {
            existing.Amount = request.Amount;
            existing.Description = request.Description?.Trim();
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(
            resolvedSchoolId,
            "Upserted",
            "FeeStructure",
            existing.Id.ToString(),
            $"Saved fee structure for {gradeLevel} {term}.",
            before is null ? null : JsonSerializer.Serialize(before, JsonOptions),
            JsonSerializer.Serialize(new
            {
                existing.Id,
                existing.SchoolId,
                existing.GradeLevel,
                existing.Term,
                existing.Amount,
                existing.Description,
                existing.UpdatedAt
            }, JsonOptions),
            cancellationToken);

        return new FeeStructureResponse(existing.Id, existing.SchoolId, existing.GradeLevel, existing.Term, existing.Amount, existing.Description, existing.CreatedAt, existing.UpdatedAt);
    }

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

        IQueryable<AccountingTransaction> transactionQuery = _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId);

        decimal openingBalance = 0m;
        if (!string.IsNullOrEmpty(term))
        {
            var termInvoices = await _dbContext.Invoices
                .Where(i => i.StudentId == student.Id && i.SchoolId == student.SchoolId && i.Term == term)
                .Select(i => i.AccountingTransactionId)
                .ToListAsync(cancellationToken);

            var termTransactionIds = termInvoices.Where(id => id.HasValue).Select(id => id!.Value).ToHashSet();

            openingBalance = await _dbContext.AccountingTransactions
                .Where(t => t.StudentId == student.Id && t.SchoolId == student.SchoolId && t.Status == AccountingTransactionStatus.Approved)
                .SumAsync(t => GetBalanceDelta(t.Type, t.Amount), cancellationToken);

            transactionQuery = _dbContext.AccountingTransactions.AsNoTracking()
                .Where(t => termTransactionIds.Contains(t.Id) ||
                    (t.StudentId == student.Id && t.SchoolId == student.SchoolId && t.Status == AccountingTransactionStatus.Approved));
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

    public async Task<IReadOnlyList<InvoiceResponse>> GetStudentInvoicesAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);

        var invoices = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .OrderByDescending(x => x.IssuedAt)
            .ToListAsync(cancellationToken);

        var transactionIds = invoices.Where(x => x.AccountingTransactionId.HasValue).Select(x => x.AccountingTransactionId!.Value).ToHashSet();
        var transactions = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => transactionIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return invoices.Select(invoice =>
        {
            transactions.TryGetValue(invoice.AccountingTransactionId ?? 0, out var transaction);
            return MapInvoiceResponse(invoice, student, transaction);
        }).ToList();
    }

    public async Task<FinancialStatementResponse> GetFinancialStatementAsync(int? schoolId, FinancialStatementRequest request, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var asOf = request.Date ?? DateTime.UtcNow;

        var columns = new[]
        {
            new FinancialStatementColumnResponse("actual", "Actual", FinancialStatementColumnKind.Actual)
        }.ToList();

        var transactions = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId && x.Status == AccountingTransactionStatus.Approved)
            .ToListAsync(cancellationToken);

        var totalRevenue = transactions.Where(x => x.Type == AccountingTransactionType.Invoice).Sum(x => x.Amount);
        var totalPayments = transactions.Where(x => x.Type == AccountingTransactionType.Payment).Sum(x => x.Amount);

        var rows = new[]
        {
            new FinancialStatementRowResponse("revenue", "Revenue", 0, FinancialStatementRowKind.LineItem, totalRevenue, null, null, null, null),
            new FinancialStatementRowResponse("payments", "Payments", 0, FinancialStatementRowKind.LineItem, totalPayments, null, null, null, null),
            new FinancialStatementRowResponse("net", "Net Income", 0, FinancialStatementRowKind.Total, totalRevenue - totalPayments, null, null, null, null)
        }.ToList();

        return new FinancialStatementResponse(
            resolvedSchoolId,
            request.StatementType,
            request.StatementType.ToString(),
            "USD",
            asOf,
            asOf.ToString("yyyy-MM-dd"),
            "N/A",
            columns,
            rows);
    }

    public async Task<InvoiceResponse> UpdateInvoiceAsync(int invoiceId, UpdateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var invoice = await LoadInvoiceForMutationAsync(invoiceId, schoolId, cancellationToken);
        var student = await _dbContext.Students.FirstAsync(x => x.Id == invoice.StudentId, cancellationToken);

        var before = new { invoice.TotalAmount, invoice.Term, invoice.DueAt };

        invoice.TotalAmount = request.TotalAmount;
        invoice.Term = request.Term.Trim();
        invoice.DueAt = request.DueAt;

        if (invoice.AccountingTransactionId.HasValue)
        {
            var transaction = await _dbContext.AccountingTransactions.FirstAsync(x => x.Id == invoice.AccountingTransactionId, cancellationToken);
            var beforeAmount = transaction.Amount;
            transaction.Amount = request.TotalAmount;
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(
                invoice.SchoolId,
                "Updated",
                "Invoice",
                invoice.Id.ToString(),
                $"Invoice for student {student.FullName} was updated.",
                JsonSerializer.Serialize(new { before.TotalAmount, before.Term, before.DueAt }, JsonOptions),
                JsonSerializer.Serialize(new { invoice.TotalAmount, invoice.Term, invoice.DueAt }, JsonOptions),
                cancellationToken);
        }

        return MapInvoiceResponse(invoice, student);
    }

    public async Task DeleteInvoiceAsync(int invoiceId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var invoice = await LoadInvoiceForMutationAsync(invoiceId, schoolId, cancellationToken);
        var student = await _dbContext.Students.FirstAsync(x => x.Id == invoice.StudentId, cancellationToken);

        if (invoice.AccountingTransactionId.HasValue)
        {
            var transaction = await _dbContext.AccountingTransactions.FirstOrDefaultAsync(x => x.Id == invoice.AccountingTransactionId, cancellationToken);
            if (transaction is not null)
            {
                _dbContext.AccountingTransactions.Remove(transaction);
            }
        }

        _dbContext.Invoices.Remove(invoice);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditLogService.LogAsync(
            invoice.SchoolId,
            "Deleted",
            "Invoice",
            invoice.Id.ToString(),
            $"Invoice for student {student.FullName} was deleted.",
            JsonSerializer.Serialize(new { invoice.TotalAmount, invoice.Term }, JsonOptions),
            null,
            cancellationToken);
    }

    public async Task SendFeeStructureNewsletterAsync(
        int? schoolId,
        SendFeeStructureNewsletterRequest request,
        byte[]? newsletterPdf = null,
        string? newsletterFileName = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId)
            .ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            var subject = "Fee Structure Update";
            var body = $"Dear {student.FullName}, please find the updated fee structure attached.";

            await _notificationService.SendAsync(
                new SendNotificationRequest(
                    subject,
                    body,
                    NotificationType.Email,
                    [student.Id],
                    NotificationAudience.Individual,
                    resolvedSchoolId),
                cancellationToken);
        }
    }

    private async Task<Invoice> LoadInvoiceForMutationAsync(int invoiceId, int? schoolId, CancellationToken cancellationToken)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        return await _dbContext.Invoices
            .FirstOrDefaultAsync(x => x.Id == invoiceId && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Invoice was not found.");
    }

    private static InvoiceResponse MapInvoiceResponse(Invoice invoice, Student student, AccountingTransaction? transaction = null)
    {
        return new InvoiceResponse(
            invoice.Id,
            invoice.SchoolId,
            invoice.StudentId,
            student.FullName,
            student.StudentNumber,
            student.Class,
            invoice.StudentAccountId,
            invoice.Term,
            invoice.TotalAmount,
            invoice.Status,
            invoice.IssuedAt,
            invoice.DueAt,
            invoice.CreatedByUserId,
            invoice.AccountingTransactionId,
            transaction?.Reference,
            transaction?.Description);
    }

    public async Task<AccountingTransactionResponse> PostInvoiceAsync(CreateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is UserRole.AccountantJunior)
        {
            throw new UnauthorizedAccessException("Junior accountants cannot issue invoices.");
        }

        var student = await ResolveStudentAsync(request.StudentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken);
        var transactionDate = DateTime.UtcNow;
        var approved = CanAutoApprove(request.TotalAmount);

        return await PersistTransactionAsync(
            student,
            account,
            AccountingTransactionType.Invoice,
            request.TotalAmount,
            request.Reference,
            request.Description,
            transactionDate,
            approved,
            async transaction =>
            {
                var invoice = new Invoice
                {
                    SchoolId = student.SchoolId,
                    StudentId = student.Id,
                    StudentAccountId = account.Id,
                    Term = request.Term.Trim(),
                    TotalAmount = request.TotalAmount,
                    Status = approved ? InvoiceStatus.Issued : InvoiceStatus.Draft,
                    IssuedAt = DateTime.UtcNow,
                    DueAt = request.DueAt,
                    CreatedByUserId = RequireUserId(),
                    AccountingTransactionId = transaction.Id
                };

                _dbContext.Invoices.Add(invoice);
                await _dbContext.SaveChangesAsync(cancellationToken);
            },
            cancellationToken);
    }

    public async Task<AccountingTransactionResponse> PostPaymentAsync(CreatePaymentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.AccountantJunior or UserRole.AccountantSenior or UserRole.AccountantSuper or UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        var student = await ResolveStudentAsync(request.StudentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken);
        var approved = _currentUserContext.Role is not UserRole.AccountantJunior && CanAutoApprove(request.Amount);
        var transactionDate = request.ReceivedAt ?? DateTime.UtcNow;

        return await PersistTransactionAsync(
            student,
            account,
            AccountingTransactionType.Payment,
            request.Amount,
            request.Reference,
            request.Description,
            transactionDate,
            approved,
            async transaction =>
            {
                var payment = new Payment
                {
                    SchoolId = student.SchoolId,
                    StudentId = student.Id,
                    StudentAccountId = account.Id,
                    Amount = request.Amount,
                    Method = request.Method,
                    Reference = request.Reference?.Trim(),
                    ReceivedAt = request.ReceivedAt ?? DateTime.UtcNow,
                    CapturedByUserId = RequireUserId(),
                    AccountingTransactionId = transaction.Id
                };

                _dbContext.Payments.Add(payment);
                await _dbContext.SaveChangesAsync(cancellationToken);
            },
            cancellationToken);
    }

    public async Task<AccountingTransactionResponse> PostAdjustmentAsync(CreateAdjustmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.AccountantSenior or UserRole.AccountantSuper or UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        var student = await ResolveStudentAsync(request.StudentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken);
        var approved = CanAutoApprove(request.Amount);

        return await PersistTransactionAsync(
            student,
            account,
            AccountingTransactionType.Adjustment,
            request.Amount,
            request.Reference,
            request.Description,
            request.TransactionDate ?? DateTime.UtcNow,
            approved,
            async _ => await Task.CompletedTask,
            cancellationToken);
    }

    public async Task<AccountingTransactionResponse> PostRefundAsync(CreateRefundRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.AccountantSenior or UserRole.AccountantSuper or UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        var student = await ResolveStudentAsync(request.StudentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken);
        var approved = CanAutoApprove(request.Amount);

        return await PersistTransactionAsync(
            student,
            account,
            AccountingTransactionType.Refund,
            request.Amount,
            request.Reference,
            request.Description,
            request.TransactionDate ?? DateTime.UtcNow,
            approved,
            async _ => await Task.CompletedTask,
            cancellationToken);
    }

    public async Task<AccountingTransactionResponse> ApproveTransactionAsync(int transactionId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var transaction = await _dbContext.AccountingTransactions
            .FirstOrDefaultAsync(x => x.Id == transactionId, cancellationToken)
            ?? throw new InvalidOperationException("Transaction was not found.");

        if (_currentUserContext.Role != UserRole.PlatformAdmin)
        {
            var resolvedSchoolId = RequireSchoolId();
            if (transaction.SchoolId != resolvedSchoolId)
            {
                throw new UnauthorizedAccessException("Not allowed.");
            }
        }
        else if (schoolId is not null && transaction.SchoolId != schoolId)
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        if (transaction.Status == AccountingTransactionStatus.Approved)
        {
            return await MapTransactionAsync(transaction, cancellationToken);
        }

        if (!CanApproveTransaction(transaction.Amount))
        {
            throw new UnauthorizedAccessException("You do not have permission to approve this transaction.");
        }

        var account = await _dbContext.StudentAccounts.FirstAsync(x => x.Id == transaction.StudentAccountId, cancellationToken);
        var student = await _dbContext.Students.FirstAsync(x => x.Id == transaction.StudentId, cancellationToken);
        var balanceBefore = account.Balance;
        ApplyBalanceDelta(account, transaction.Type, transaction.Amount);
        transaction.Status = AccountingTransactionStatus.Approved;
        transaction.ApprovedAt = DateTime.UtcNow;
        transaction.ApprovedByUserId = RequireUserId();
        account.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        await ReconcileInvoicesAsync(student.Id, student.SchoolId, cancellationToken);
        await NotifyTransactionAsync(student, transaction, cancellationToken);
        await LogTransactionAsync(transaction, balanceBefore, account.Balance, cancellationToken);

        return await MapTransactionAsync(transaction, cancellationToken);
    }

    public async Task<CollectionReportResponse> GetCollectionReportAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var query = ResolveInvoiceQuery(schoolId);
        var invoices = await query.ToListAsync(cancellationToken);
        var payments = await ResolvePaymentQuery(schoolId).ToListAsync(cancellationToken);

        var totalBilled = invoices.Where(x => x.Status is not InvoiceStatus.Draft).Sum(x => x.TotalAmount);
        var totalCollected = payments.Sum(x => x.Amount);
        var outstanding = await ResolveStudentAccountQuery(schoolId).SumAsync(x => x.Balance, cancellationToken);

        return new CollectionReportResponse(
            ResolveReportSchoolId(schoolId),
            totalBilled,
            totalCollected,
            outstanding,
            invoices.Count,
            payments.Count);
    }

    public async Task<AgingReportResponse> GetAgingReportAsync(int? schoolId = null, DateTime? asOf = null, CancellationToken cancellationToken = default)
    {
        var reportDate = (asOf ?? DateTime.UtcNow).Date;
        var invoices = await ResolveInvoiceQuery(schoolId)
            .Where(x => x.DueAt <= reportDate && x.Status != InvoiceStatus.Paid)
            .ToListAsync(cancellationToken);

        var buckets = new[]
        {
            new AgingBucketResponse("0-30", 0m, 0),
            new AgingBucketResponse("30-60", 0m, 0),
            new AgingBucketResponse("60-90", 0m, 0),
            new AgingBucketResponse("90+", 0m, 0)
        }.ToList();

        foreach (var invoice in invoices)
        {
            var age = Math.Max((reportDate - invoice.DueAt.Date).Days, 0);
            var index = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
            buckets[index] = buckets[index] with
            {
                Amount = buckets[index].Amount + invoice.TotalAmount,
                InvoiceCount = buckets[index].InvoiceCount + 1
            };
        }

        return new AgingReportResponse(ResolveReportSchoolId(schoolId), reportDate, buckets);
    }

    public async Task<DailyCashReportResponse> GetDailyCashReportAsync(int? schoolId = null, DateTime? date = null, CancellationToken cancellationToken = default)
    {
        var reportDate = (date ?? DateTime.UtcNow).Date;
        var payments = await ResolvePaymentQuery(schoolId)
            .Where(x => x.ReceivedAt.Date == reportDate)
            .ToListAsync(cancellationToken);

        var methods = payments
            .GroupBy(x => x.Method)
            .Select(group => new DailyCashMethodResponse(group.Key, group.Sum(x => x.Amount), group.Count()))
            .OrderBy(x => x.Method)
            .ToList();

        return new DailyCashReportResponse(
            ResolveReportSchoolId(schoolId),
            reportDate,
            payments.Sum(x => x.Amount),
            methods);
    }

    public async Task<RevenueByClassReportResponse> GetRevenueByClassReportAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var studentQuery = ResolveStudentQuery(schoolId);
        var students = await studentQuery.ToListAsync(cancellationToken);
        var invoices = await ResolveInvoiceQuery(schoolId).ToListAsync(cancellationToken);
        var payments = await ResolvePaymentQuery(schoolId).ToListAsync(cancellationToken);

        var classes = students
            .GroupBy(x => new { x.Class, x.Level })
            .Select(group =>
            {
                var studentIds = group.Select(x => x.Id).ToHashSet();
                var billed = invoices.Where(x => studentIds.Contains(x.StudentId) && x.Status is not InvoiceStatus.Draft).Sum(x => x.TotalAmount);
                var collected = payments.Where(x => studentIds.Contains(x.StudentId)).Sum(x => x.Amount);
                return new RevenueByClassResponse(group.Key.Class, group.Key.Level, billed, collected, billed - collected);
            })
            .OrderBy(x => x.ClassName)
            .ToList();

        return new RevenueByClassReportResponse(ResolveReportSchoolId(schoolId), classes);
    }

    public async Task<DefaulterReportResponse> GetDefaultersAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var accounts = await ResolveStudentAccountQuery(schoolId).ToListAsync(cancellationToken);

        var studentIds = accounts.Select(x => x.StudentId).ToArray();
        var lastTransactions = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId))
            .GroupBy(x => x.StudentId)
            .Select(group => new
            {
                StudentId = group.Key,
                LastPaymentAt = group.Where(x => x.Type == AccountingTransactionType.Payment && x.Status == AccountingTransactionStatus.Approved).Max(x => (DateTime?)x.TransactionDate),
                LastInvoiceAt = group.Where(x => x.Type == AccountingTransactionType.Invoice && x.Status == AccountingTransactionStatus.Approved).Max(x => (DateTime?)x.TransactionDate)
            })
            .ToListAsync(cancellationToken);

        var students = await _dbContext.Students.AsNoTracking()
            .Where(x => studentIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        var items = students
            .Join(accounts, student => student.Id, account => account.StudentId, (student, account) =>
            {
                if (account.Balance <= 0)
                {
                    return null;
                }

                var lastTransaction = lastTransactions.FirstOrDefault(x => x.StudentId == student.Id);
                return new DefaulterResponse(
                    student.Id,
                    student.FullName,
                    student.Class,
                    student.Level,
                    account.Balance,
                    lastTransaction?.LastPaymentAt,
                    lastTransaction?.LastInvoiceAt);
            })
            .Where(x => x is not null)
            .Select(x => x!)
            .OrderByDescending(x => x.Balance)
            .ThenBy(x => x.StudentName)
            .ToList();

        return new DefaulterReportResponse(ResolveReportSchoolId(schoolId), items);
    }

    public async Task<AccountingTransactionResponse> PostFineAsync(CreateFineRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.AccountantSenior or UserRole.AccountantSuper or UserRole.Admin or UserRole.PlatformAdmin or UserRole.LibraryAdmin))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        var student = await ResolveStudentAsync(request.StudentId, schoolId, cancellationToken);
        var account = await EnsureStudentAccountAsync(student, cancellationToken);
        var approved = CanAutoApprove(request.Amount);

        return await PersistTransactionAsync(
            student,
            account,
            AccountingTransactionType.Fine,
            request.Amount,
            request.Reference,
            request.Description,
            request.TransactionDate ?? DateTime.UtcNow,
            approved,
            async _ => await Task.CompletedTask,
            cancellationToken);
    }

    public async Task<StudentFinancialFlagResponse> GetStudentFinancialFlagAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);

        var balance = await _dbContext.StudentAccounts
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .Select(x => x.Balance)
            .FirstOrDefaultAsync(cancellationToken);

        var oldestOverdue = await _dbContext.Invoices
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId
                     && x.Status != InvoiceStatus.Paid && x.DueAt < DateTime.UtcNow)
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

        var overdueStudentIds = await _dbContext.Invoices
            .Where(x => x.SchoolId == resolvedSchoolId
                     && x.Status != InvoiceStatus.Paid
                     && x.DueAt < DateTime.UtcNow)
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

        var accounts = await _dbContext.StudentAccounts.AsNoTracking()
            .Where(x => overdueStudentIds.Contains(x.StudentId) && x.SchoolId == resolvedSchoolId)
            .ToDictionaryAsync(x => x.StudentId, cancellationToken);

        var oldestOverdueDates = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.SchoolId == resolvedSchoolId
                     && overdueStudentIds.Contains(x.StudentId)
                     && x.Status != InvoiceStatus.Paid
                     && x.DueAt < DateTime.UtcNow)
            .GroupBy(x => x.StudentId)
            .Select(g => new { StudentId = g.Key, OldestDueAt = g.Min(x => x.DueAt) })
            .ToListAsync(cancellationToken);

        var oldestMap = oldestOverdueDates.ToDictionary(x => x.StudentId, x => x.OldestDueAt);

        return students.Select(student =>
        {
            accounts.TryGetValue(student.Id, out var account);
            oldestMap.TryGetValue(student.Id, out var oldest);
            return new StudentFinancialFlagResponse(
                student.Id,
                student.FullName,
                account?.Balance ?? 0m,
                true,
                oldest);
        })
        .OrderBy(x => x.OldestOverdueSince)
        .ThenBy(x => x.StudentName)
        .ToList();
    }

    private async Task<AccountingTransactionResponse> PersistTransactionAsync(
        Student student,
        StudentAccount account,
        AccountingTransactionType type,
        decimal amount,
        string? reference,
        string? description,
        DateTime transactionDate,
        bool approved,
        Func<AccountingTransaction, Task> afterTransactionSaved,
        CancellationToken cancellationToken)
    {
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var existingBalance = account.Balance;
            var transaction = new AccountingTransaction
            {
                SchoolId = student.SchoolId,
                StudentId = student.Id,
                StudentAccountId = account.Id,
                Type = type,
                Status = approved ? AccountingTransactionStatus.Approved : AccountingTransactionStatus.Pending,
                Amount = amount,
                TransactionDate = transactionDate,
                Reference = reference?.Trim(),
                Description = description?.Trim(),
                CreatedByUserId = RequireUserId(),
                CreatedAt = DateTime.UtcNow,
                ApprovedAt = approved ? DateTime.UtcNow : null,
                ApprovedByUserId = approved ? RequireUserId() : null
            };

            _dbContext.AccountingTransactions.Add(transaction);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.LedgerEntries.AddRange(
                new LedgerEntry
                {
                    SchoolId = student.SchoolId,
                    TransactionId = transaction.Id,
                    Debit = amount,
                    Credit = 0m,
                    AccountCode = ResolveDebitAccountCode(type),
                    CreatedAt = DateTime.UtcNow
                },
                new LedgerEntry
                {
                    SchoolId = student.SchoolId,
                    TransactionId = transaction.Id,
                    Debit = 0m,
                    Credit = amount,
                    AccountCode = ResolveCreditAccountCode(type),
                    CreatedAt = DateTime.UtcNow
                });

            await afterTransactionSaved(transaction);

            if (approved)
            {
                ApplyBalanceDelta(account, type, amount);
                account.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            else
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await _auditLogService.LogAsync(
                student.SchoolId,
                "Created",
                "AccountingTransaction",
                transaction.Id.ToString(),
                $"{type} for student {student.FullName} was recorded.",
                JsonSerializer.Serialize(new
                {
                    type,
                    amount,
                    status = approved ? AccountingTransactionStatus.Approved : AccountingTransactionStatus.Pending,
                    balance = existingBalance
                }, JsonOptions),
                JsonSerializer.Serialize(new
                {
                    transaction.Id,
                    transaction.SchoolId,
                    transaction.StudentId,
                    transaction.StudentAccountId,
                    transaction.Type,
                    transaction.Status,
                    transaction.Amount,
                    transaction.TransactionDate,
                    transaction.Reference,
                    transaction.Description
                }, JsonOptions),
                cancellationToken);

            if (approved)
            {
                await ReconcileInvoicesAsync(student.Id, student.SchoolId, cancellationToken);
                await NotifyTransactionAsync(student, transaction, cancellationToken);
            }

            await dbTransaction.CommitAsync(cancellationToken);
            return await MapTransactionAsync(transaction, cancellationToken);
        });
    }

    private async Task<Student> ResolveStudentAsync(int studentId, int? schoolId, CancellationToken cancellationToken)
    {
        var query = ResolveStudentQuery(schoolId);
        var student = await query.FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken)
            ?? throw new InvalidOperationException("Student was not found in this school.");

        return student;
    }

    private IQueryable<Student> ResolveStudentQuery(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId is null
                ? _dbContext.Students.AsNoTracking()
                : _dbContext.Students.AsNoTracking().Where(x => x.SchoolId == schoolId);
        }

        return _dbContext.Students.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());
    }

    private IQueryable<StudentAccount> ResolveStudentAccountQuery(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId is null
                ? _dbContext.StudentAccounts.AsNoTracking()
                : _dbContext.StudentAccounts.AsNoTracking().Where(x => x.SchoolId == schoolId);
        }

        return _dbContext.StudentAccounts.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());
    }

    private IQueryable<Invoice> ResolveInvoiceQuery(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId is null
                ? _dbContext.Invoices.AsNoTracking()
                : _dbContext.Invoices.AsNoTracking().Where(x => x.SchoolId == schoolId);
        }

        return _dbContext.Invoices.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());
    }

    private IQueryable<Payment> ResolvePaymentQuery(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId is null
                ? _dbContext.Payments.AsNoTracking()
                : _dbContext.Payments.AsNoTracking().Where(x => x.SchoolId == schoolId);
        }

        return _dbContext.Payments.AsNoTracking().Where(x => x.SchoolId == RequireSchoolId());
    }

    private int ResolveReportSchoolId(int? schoolId)
    {
        return _currentUserContext.Role == UserRole.PlatformAdmin
            ? schoolId ?? _currentUserContext.SchoolId ?? 0
            : RequireSchoolId();
    }

    private int ResolveSchoolIdForWrite(int? schoolId)
    {
        if (_currentUserContext.Role == UserRole.PlatformAdmin)
        {
            return schoolId ?? throw new InvalidOperationException("Choose a school before saving accounting configuration.");
        }

        return RequireSchoolId();
    }

    private async Task<StudentAccount> EnsureStudentAccountAsync(Student student, CancellationToken cancellationToken, bool createIfMissing = true)
    {
        var account = await _dbContext.StudentAccounts.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (account is not null || !createIfMissing)
        {
            return account ?? new StudentAccount
            {
                SchoolId = student.SchoolId,
                StudentId = student.Id,
                Balance = 0m,
                Currency = "USD",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
        }

        account = new StudentAccount
        {
            SchoolId = student.SchoolId,
            StudentId = student.Id,
            Balance = 0m,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.StudentAccounts.Add(account);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return account;
    }

    private async Task ReconcileInvoicesAsync(int studentId, int schoolId, CancellationToken cancellationToken)
    {
        var invoices = await _dbContext.Invoices
            .Where(x => x.StudentId == studentId && x.SchoolId == schoolId && x.Status != InvoiceStatus.Paid)
            .ToListAsync(cancellationToken);

        if (invoices.Count == 0)
        {
            return;
        }

        var payments = await _dbContext.Payments
            .Where(x => x.StudentId == studentId && x.SchoolId == schoolId)
            .SumAsync(x => x.Amount, cancellationToken);

        var billed = invoices.Sum(x => x.TotalAmount);
        var hasPartial = payments > 0m && payments < billed;
        var hasPaid = payments >= billed && billed > 0m;

        foreach (var invoice in invoices)
        {
            if (hasPaid)
            {
                invoice.Status = InvoiceStatus.Paid;
            }
            else if (hasPartial)
            {
                invoice.Status = InvoiceStatus.Partial;
            }
            else if (invoice.Status == InvoiceStatus.Draft)
            {
                invoice.Status = InvoiceStatus.Issued;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task NotifyTransactionAsync(Student student, AccountingTransaction transaction, CancellationToken cancellationToken)
    {
        var title = transaction.Type switch
        {
            AccountingTransactionType.Invoice => "Invoice generated",
            AccountingTransactionType.Payment => "Payment received",
            AccountingTransactionType.Refund => "Refund processed",
            AccountingTransactionType.Adjustment => "Account updated",
            AccountingTransactionType.Discount => "Discount applied",
            AccountingTransactionType.Fine => "Library fine charged",
            _ => "Account updated"
        };

        var message = transaction.Type switch
        {
            AccountingTransactionType.Invoice => $"An invoice of {transaction.Amount.ToString("F2", CultureInfo.InvariantCulture)} has been issued for {student.FullName}.",
            AccountingTransactionType.Payment => $"A payment of {transaction.Amount.ToString("F2", CultureInfo.InvariantCulture)} has been received for {student.FullName}.",
            AccountingTransactionType.Refund => $"A refund of {transaction.Amount.ToString("F2", CultureInfo.InvariantCulture)} has been recorded for {student.FullName}.",
            AccountingTransactionType.Adjustment => $"An account adjustment of {transaction.Amount.ToString("F2", CultureInfo.InvariantCulture)} has been recorded for {student.FullName}.",
            AccountingTransactionType.Fine => $"A library fine of {transaction.Amount.ToString("F2", CultureInfo.InvariantCulture)} has been charged for {student.FullName}.",
            _ => $"The account for {student.FullName} has been updated."
        };

        await _notificationService.SendAsync(
            new SendNotificationRequest(
                title,
                message,
                NotificationType.Email,
                [student.Id],
                NotificationAudience.Individual,
                student.SchoolId),
            cancellationToken);

        await NotifyOverdueIfNeededAsync(student, cancellationToken);
    }

    private async Task NotifyOverdueIfNeededAsync(Student student, CancellationToken cancellationToken)
    {
        var hasOverdueInvoices = await _dbContext.Invoices.AnyAsync(
            x => x.StudentId == student.Id && x.SchoolId == student.SchoolId && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial) && x.DueAt < DateTime.UtcNow,
            cancellationToken);

        var balance = await _dbContext.StudentAccounts
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .Select(x => x.Balance)
            .FirstOrDefaultAsync(cancellationToken);

        if (!hasOverdueInvoices || balance <= 0m)
        {
            return;
        }

        await _notificationService.SendAsync(
            new SendNotificationRequest(
                "Overdue balance",
                $"The account balance for {student.FullName} is overdue and currently stands at {balance.ToString("F2", CultureInfo.InvariantCulture)}.",
                NotificationType.Email,
                [student.Id],
                NotificationAudience.Individual,
                student.SchoolId),
            cancellationToken);
    }

    private async Task LogTransactionAsync(AccountingTransaction transaction, decimal oldBalance, decimal newBalance, CancellationToken cancellationToken)
    {
        await _auditLogService.LogAsync(
            transaction.SchoolId,
            "Approved",
            "AccountingTransaction",
            transaction.Id.ToString(),
            $"Transaction {transaction.Type} for student {transaction.StudentId} was approved.",
            JsonSerializer.Serialize(new { oldBalance }, JsonOptions),
            JsonSerializer.Serialize(new { newBalance }, JsonOptions),
            cancellationToken);
    }

    private async Task<AccountingTransactionResponse> MapTransactionAsync(AccountingTransaction transaction, CancellationToken cancellationToken)
    {
        var approvedBy = transaction.ApprovedByUserId;
        var approvedAt = transaction.ApprovedAt;

        if (transaction.Status == AccountingTransactionStatus.Approved && approvedBy is null)
        {
            approvedBy = RequireUserId();
            approvedAt = approvedAt ?? DateTime.UtcNow;
        }

        return await Task.FromResult(new AccountingTransactionResponse(
            transaction.Id,
            transaction.SchoolId,
            transaction.StudentId,
            transaction.StudentAccountId,
            transaction.Type,
            transaction.Status,
            transaction.Amount,
            transaction.TransactionDate,
            transaction.Reference,
            transaction.Description,
            transaction.CreatedByUserId,
            approvedBy,
            transaction.CreatedAt,
            approvedAt));
    }

    private void ApplyBalanceDelta(StudentAccount account, AccountingTransactionType type, decimal amount)
    {
        account.Balance += GetBalanceDelta(type, amount);
    }

    private static decimal GetBalanceDelta(AccountingTransactionType type, decimal amount)
    {
        return type switch
        {
            AccountingTransactionType.Invoice => amount,
            AccountingTransactionType.Payment => -amount,
            AccountingTransactionType.Discount => -amount,
            AccountingTransactionType.Adjustment => amount,
            AccountingTransactionType.Refund => amount,
            AccountingTransactionType.Fine => amount,
            _ => 0m
        };
    }

    private static string ResolveDebitAccountCode(AccountingTransactionType type)
    {
        return type switch
        {
            AccountingTransactionType.Invoice => "ACCOUNTS_RECEIVABLE",
            AccountingTransactionType.Payment => "CASH",
            AccountingTransactionType.Discount => "DISCOUNT_EXPENSE",
            AccountingTransactionType.Adjustment => "ACCOUNTS_RECEIVABLE",
            AccountingTransactionType.Refund => "REFUNDS",
            AccountingTransactionType.Fine => "ACCOUNTS_RECEIVABLE",
            _ => "UNKNOWN"
        };
    }

    private static string ResolveCreditAccountCode(AccountingTransactionType type)
    {
        return type switch
        {
            AccountingTransactionType.Invoice => "REVENUE",
            AccountingTransactionType.Payment => "ACCOUNTS_RECEIVABLE",
            AccountingTransactionType.Discount => "ACCOUNTS_RECEIVABLE",
            AccountingTransactionType.Adjustment => "ADJUSTMENT_REVENUE",
            AccountingTransactionType.Refund => "CASH",
            AccountingTransactionType.Fine => "FINE_REVENUE",
            _ => "UNKNOWN"
        };
    }

    private bool CanAutoApprove(decimal amount)
    {
        if (_currentUserContext.Role is UserRole.PlatformAdmin or UserRole.AccountantSuper or UserRole.Admin)
        {
            return true;
        }

        if (_currentUserContext.Role is UserRole.AccountantSenior)
        {
            return amount <= LargeTransactionApprovalThreshold;
        }

        return false;
    }

    private bool CanApproveTransaction(decimal amount)
    {
        if (_currentUserContext.Role is UserRole.PlatformAdmin or UserRole.AccountantSuper or UserRole.Admin)
        {
            return true;
        }

        if (_currentUserContext.Role is UserRole.AccountantSenior)
        {
            return amount <= LargeTransactionApprovalThreshold;
        }

        return false;
    }

    public async Task DeleteFeeStructureAsync(int id, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can delete fee structures.");
        }

        var fee = await _dbContext.FeeStructures.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Fee structure not found.");

        _dbContext.FeeStructures.Remove(fee);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private int RequireSchoolId()
    {
        if (_currentUserContext.SchoolId is not int schoolId)
        {
            throw new UnauthorizedAccessException("A school-scoped user is required.");
        }

        if (_currentUserContext.Role is not (UserRole.Admin or UserRole.Teacher or UserRole.PlatformAdmin or UserRole.LibraryAdmin or UserRole.AccountantSuper or UserRole.AccountantSenior or UserRole.AccountantJunior))
        {
            throw new UnauthorizedAccessException("Not allowed.");
        }

        return schoolId;
    }

    private int RequireUserId()
    {
        return _currentUserContext.UserId ?? throw new UnauthorizedAccessException("User identity is missing.");
    }
}
