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

// Public methods are split into partial class files:
//   AccountingService.Invoices.cs      — invoice / fee-structure operations
//   AccountingService.Payments.cs      — payment / adjustment / fine operations
//   AccountingService.Reporting.cs     — financial statements and operational reports
//   AccountingService.Statements.cs    — student statements and overdue flags
public sealed partial class AccountingService : IAccountingService
{
    private const decimal LargeTransactionApprovalThreshold = 1000m;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ZynkEduDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationService _notificationService;
    private readonly IEmailSender _emailSender;

    public AccountingService(
        ZynkEduDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IAuditLogService auditLogService,
        INotificationService notificationService,
        IEmailSender emailSender)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _auditLogService = auditLogService;
        _notificationService = notificationService;
        _emailSender = emailSender;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Shared transaction infrastructure
    // ──────────────────────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────────────────────
    // Query helpers
    // ──────────────────────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────────────────────
    // Invoice reconciliation and notification helpers
    // ──────────────────────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────────────────────
    // Balance and ledger utilities
    // ──────────────────────────────────────────────────────────────────────

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
