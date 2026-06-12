using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Infrastructure.Services.Accounting;

public sealed partial class AccountingService
{
    // ──────────────────────────────────────────────────────────────────────
    // Fee structures
    // ──────────────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<FeeStructureResponse>> GetFeeStructuresAsync(int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.FeeStructures.AsNoTracking().AsQueryable();

        if (_currentUserContext.Role != Domain.Enums.UserRole.PlatformAdmin)
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
            existing = new Domain.Entities.Accounting.FeeStructure
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

    public async Task DeleteFeeStructureAsync(int id, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is not (Domain.Enums.UserRole.Admin or Domain.Enums.UserRole.PlatformAdmin))
        {
            throw new UnauthorizedAccessException("Only school and platform admins can delete fee structures.");
        }

        var fee = await _dbContext.FeeStructures.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Fee structure not found.");

        _dbContext.FeeStructures.Remove(fee);
        await _dbContext.SaveChangesAsync(cancellationToken);
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
                    Domain.Enums.NotificationType.Email,
                    [student.Id],
                    NotificationAudience.Individual,
                    resolvedSchoolId),
                cancellationToken);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Invoices
    // ──────────────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<InvoiceResponse>> GetStudentInvoicesAsync(int studentId, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var student = await ResolveStudentAsync(studentId, schoolId, cancellationToken);

        var invoices = await _dbContext.Invoices.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.SchoolId == student.SchoolId)
            .OrderByDescending(x => x.IssuedAt)
            .ToListAsync(cancellationToken);

        var invoiceIds = invoices.Select(x => x.Id).ToHashSet();
        var transactionIds = invoices.Where(x => x.AccountingTransactionId.HasValue).Select(x => x.AccountingTransactionId!.Value).ToHashSet();

        var transactions = await _dbContext.AccountingTransactions.AsNoTracking()
            .Where(x => transactionIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var paidByInvoice = await _dbContext.PaymentAllocations.AsNoTracking()
            .Where(x => invoiceIds.Contains(x.InvoiceId))
            .GroupBy(x => x.InvoiceId)
            .Select(g => new { InvoiceId = g.Key, PaidAmount = g.Sum(a => a.AllocatedAmount) })
            .ToDictionaryAsync(x => x.InvoiceId, x => x.PaidAmount, cancellationToken);

        return invoices.Select(invoice =>
        {
            transactions.TryGetValue(invoice.AccountingTransactionId ?? 0, out var transaction);
            paidByInvoice.TryGetValue(invoice.Id, out var paid);
            return MapInvoiceResponse(invoice, student, transaction, paid);
        }).ToList();
    }

    public async Task<AccountingTransactionResponse> PostInvoiceAsync(CreateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        if (_currentUserContext.Role is Domain.Enums.UserRole.AccountantJunior)
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
            Domain.Enums.AccountingTransactionType.Invoice,
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

    public async Task<InvoiceResponse> UpdateInvoiceAsync(int invoiceId, UpdateInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var invoice = await LoadInvoiceForMutationAsync(invoiceId, schoolId, cancellationToken);
        var student = await _dbContext.Students.FirstAsync(x => x.Id == invoice.StudentId, cancellationToken);

        var before = new { invoice.TotalAmount, invoice.Term, invoice.DueAt };

        invoice.TotalAmount = request.TotalAmount;
        invoice.Term = request.Term.Trim();
        invoice.DueAt = request.DueAt;

        Domain.Entities.Accounting.AccountingTransaction? transaction = null;
        if (invoice.AccountingTransactionId.HasValue)
        {
            transaction = await _dbContext.AccountingTransactions.FirstAsync(x => x.Id == invoice.AccountingTransactionId, cancellationToken);
            var amountDelta = request.TotalAmount - transaction.Amount;
            transaction.Amount = request.TotalAmount;
            transaction.Reference = request.Reference;
            transaction.Description = request.Description;

            if (amountDelta != 0m)
            {
                var account = await _dbContext.StudentAccounts.FirstAsync(x => x.StudentId == invoice.StudentId && x.SchoolId == invoice.SchoolId, cancellationToken);
                account.Balance += amountDelta;
                account.UpdatedAt = DateTime.UtcNow;
            }

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

        return MapInvoiceResponse(invoice, student, transaction);
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
                var account = await _dbContext.StudentAccounts.FirstOrDefaultAsync(x => x.StudentId == invoice.StudentId && x.SchoolId == invoice.SchoolId, cancellationToken);
                if (account is not null)
                {
                    account.Balance -= GetBalanceDelta(transaction.Type, transaction.Amount);
                    account.UpdatedAt = DateTime.UtcNow;
                }
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

    public async Task SendInvoicePdfAsync(int invoiceId, byte[]? invoicePdf, string? invoicePdfFileName, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);

        var invoice = await _dbContext.Invoices
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == invoiceId && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Invoice not found.");

        var student = await _dbContext.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == invoice.StudentId && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Student not found.");

        var reference = invoice.AccountingTransactionId.HasValue
            ? await _dbContext.AccountingTransactions
                .AsNoTracking()
                .Where(x => x.Id == invoice.AccountingTransactionId.Value)
                .Select(x => x.Reference)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var primaryGuardianEmail = await _dbContext.Guardians
            .AsNoTracking()
            .Where(g => g.StudentId == student.Id && g.IsActive && g.ParentEmail != null && g.ParentEmail != string.Empty)
            .OrderByDescending(g => g.IsPrimary)
            .Select(g => g.ParentEmail)
            .FirstOrDefaultAsync(cancellationToken);

        var recipientEmail = primaryGuardianEmail
            ?? (string.IsNullOrWhiteSpace(student.ParentEmail) ? null : student.ParentEmail);

        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            throw new InvalidOperationException($"No parent email address is on record for {student.FullName}.");
        }

        var subject = $"Invoice — {invoice.Term} Fee Statement for {student.FullName}";
        var refLine = string.IsNullOrWhiteSpace(reference) ? string.Empty : $"Reference: {reference}\n";
        var body = $"Dear Guardian,\n\nPlease find attached the fee invoice for {student.FullName} ({student.StudentNumber}) covering {invoice.Term}.\n\nAmount due: {invoice.TotalAmount.ToString("F2", CultureInfo.InvariantCulture)}\nDue date: {invoice.DueAt:MMMM d, yyyy}\n{refLine}\nIf you have any questions, please contact the school accounts office.\n\nThank you.";

        if (invoicePdf is { Length: > 0 })
        {
            await _emailSender.SendAsync(recipientEmail, subject, body, invoicePdf, invoicePdfFileName ?? $"invoice-{invoice.Term.Replace(" ", "-").ToLowerInvariant()}.pdf", "application/pdf", cancellationToken);
        }
        else
        {
            await _emailSender.SendAsync(recipientEmail, subject, body, cancellationToken);
        }
    }

    private async Task<Invoice> LoadInvoiceForMutationAsync(int invoiceId, int? schoolId, CancellationToken cancellationToken)
    {
        var resolvedSchoolId = ResolveReportSchoolId(schoolId);
        return await _dbContext.Invoices
            .FirstOrDefaultAsync(x => x.Id == invoiceId && x.SchoolId == resolvedSchoolId, cancellationToken)
            ?? throw new InvalidOperationException("Invoice was not found.");
    }

    private static InvoiceResponse MapInvoiceResponse(Invoice invoice, Domain.Entities.Student student, Domain.Entities.Accounting.AccountingTransaction? transaction = null, decimal paidAmount = 0m)
    {
        var balanceDue = Math.Max(0m, invoice.TotalAmount - paidAmount);
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
            transaction?.Description,
            paidAmount,
            balanceDue);
    }

    public async Task<BulkInvoiceResponse> BulkInvoiceAsync(BulkInvoiceRequest request, int? schoolId = null, CancellationToken cancellationToken = default)
    {
        var effectiveSchoolId = schoolId ?? (_currentUserContext.SchoolId ?? throw new UnauthorizedAccessException("A school-scoped user is required."));

        var students = await _dbContext.Students.AsNoTracking()
            .Where(s => s.SchoolId == effectiveSchoolId && s.Class == request.ClassName && (s.Status == "Active" || s.Status == "Suspended"))
            .ToListAsync(cancellationToken);

        // Determine amount: use fee structure amount if provided, otherwise use the request's TotalAmount
        var invoiceAmount = request.TotalAmount;
        if (request.FeeStructureId is not null)
        {
            var feeStructure = await _dbContext.FeeStructures.AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == request.FeeStructureId && f.SchoolId == effectiveSchoolId, cancellationToken);
            if (feeStructure is not null)
            {
                invoiceAmount = feeStructure.Amount;
            }
        }

        var issuedCount = 0;
        var skippedCount = 0;
        var failures = new List<string>();

        foreach (var student in students)
        {
            try
            {
                // Skip if invoice already exists for this student + term
                var alreadyExists = await _dbContext.Invoices
                    .AnyAsync(inv => inv.StudentId == student.Id && inv.Term == request.Term && inv.SchoolId == effectiveSchoolId, cancellationToken);

                if (alreadyExists)
                {
                    skippedCount++;
                    continue;
                }

                var invoiceRequest = new CreateInvoiceRequest(
                    student.Id,
                    request.Term,
                    invoiceAmount,
                    request.DueAt,
                    request.Reference,
                    request.Description);

                await PostInvoiceAsync(invoiceRequest, effectiveSchoolId, cancellationToken);
                issuedCount++;
            }
            catch (Exception ex)
            {
                failures.Add($"{student.FullName}: {ex.Message}");
            }
        }

        return new BulkInvoiceResponse(issuedCount, skippedCount, failures.Count, failures);
    }
}
