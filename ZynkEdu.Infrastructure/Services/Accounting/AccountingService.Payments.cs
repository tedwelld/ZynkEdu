using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed partial class AccountingService
{
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

                // Auto-allocate to oldest outstanding invoices (FIFO)
                var outstanding = await _dbContext.Invoices
                    .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId
                                && (x.Status == InvoiceStatus.Issued || x.Status == InvoiceStatus.Partial))
                    .OrderBy(x => x.IssuedAt)
                    .ToListAsync(cancellationToken);

                if (outstanding.Count > 0)
                {
                    var invoiceIds = outstanding.Select(x => x.Id).ToHashSet();
                    var existingPaid = await _dbContext.PaymentAllocations
                        .Where(x => invoiceIds.Contains(x.InvoiceId))
                        .GroupBy(x => x.InvoiceId)
                        .Select(g => new { InvoiceId = g.Key, Paid = g.Sum(a => a.AllocatedAmount) })
                        .ToDictionaryAsync(x => x.InvoiceId, x => x.Paid, cancellationToken);

                    var remaining = request.Amount;
                    foreach (var inv in outstanding)
                    {
                        if (remaining <= 0m) break;
                        existingPaid.TryGetValue(inv.Id, out var alreadyPaid);
                        var balanceDue = Math.Max(0m, inv.TotalAmount - alreadyPaid);
                        if (balanceDue <= 0m) continue;

                        var allocate = Math.Min(remaining, balanceDue);
                        _dbContext.PaymentAllocations.Add(new PaymentAllocation
                        {
                            SchoolId = student.SchoolId,
                            PaymentId = payment.Id,
                            InvoiceId = inv.Id,
                            AllocatedAmount = allocate,
                            CreatedAt = DateTime.UtcNow
                        });

                        var newPaid = alreadyPaid + allocate;
                        if (newPaid >= inv.TotalAmount)
                        {
                            inv.Status = InvoiceStatus.Paid;
                        }
                        else if (inv.Status == InvoiceStatus.Issued)
                        {
                            inv.Status = InvoiceStatus.Partial;
                        }

                        remaining -= allocate;
                    }

                    await _dbContext.SaveChangesAsync(cancellationToken);
                }
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

    public async Task<PaymentReceiptResponse> GetPaymentReceiptAsync(int transactionId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Set<Payment>()
            .AsNoTracking()
            .Where(p => p.AccountingTransactionId == transactionId);

        if (schoolId is not null)
        {
            query = query.Where(p => p.SchoolId == schoolId);
        }

        var payment = await query.FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Payment not found for the specified transaction.");

        var student = await _dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == payment.StudentId, cancellationToken)
            ?? throw new InvalidOperationException("Student not found.");

        var school = await _dbContext.Schools.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == payment.SchoolId, cancellationToken);

        var account = await _dbContext.Set<StudentAccount>().AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == payment.StudentAccountId, cancellationToken);

        var accountant = await _dbContext.Users.AsNoTracking()
            .Where(u => u.Id == payment.CapturedByUserId)
            .Select(u => new { u.DisplayName })
            .FirstOrDefaultAsync(cancellationToken);

        var currency = account?.Currency ?? "USD";
        var schoolName = school?.Name ?? $"School {payment.SchoolId}";
        var issuedByName = accountant?.DisplayName ?? $"User {payment.CapturedByUserId}";

        return new PaymentReceiptResponse(
            transactionId,
            payment.SchoolId,
            schoolName,
            student.Id,
            student.FullName,
            student.StudentNumber,
            student.Class,
            payment.Amount,
            currency,
            payment.Method.ToString(),
            payment.ReceivedAt,
            payment.Reference,
            null,
            issuedByName,
            DateTime.UtcNow);
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
}
