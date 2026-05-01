using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Entities;
using ZynkEdu.Domain.Entities.Accounting;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Infrastructure.Persistence;

public sealed class ZynkEduDbContext : DbContext
{
    private readonly ICurrentUserContext _currentUserContext;

    public ZynkEduDbContext(DbContextOptions<ZynkEduDbContext> options, ICurrentUserContext currentUserContext)
        : base(options)
    {
        _currentUserContext = currentUserContext;
    }

    public DbSet<School> Schools => Set<School>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<StaffAdmin> StaffAdmins => Set<StaffAdmin>();
    public DbSet<TeacherUser> TeacherUsers => Set<TeacherUser>();
    public DbSet<LibraryAdminUser> LibraryAdminUsers => Set<LibraryAdminUser>();
    public DbSet<AccountantUser> AccountantUsers => Set<AccountantUser>();
    public DbSet<Guardian> Guardians => Set<Guardian>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<StudentAccount> StudentAccounts => Set<StudentAccount>();
    public DbSet<AccountingTransaction> AccountingTransactions => Set<AccountingTransaction>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<FeeStructure> FeeStructures => Set<FeeStructure>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<StudentMovement> StudentMovements => Set<StudentMovement>();
    public DbSet<StudentProgressionRun> StudentProgressionRuns => Set<StudentProgressionRun>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<PlatformSubjectCatalog> PlatformSubjectCatalogs => Set<PlatformSubjectCatalog>();
    public DbSet<SchoolClass> SchoolClasses => Set<SchoolClass>();
    public DbSet<SchoolClassSubject> SchoolClassSubjects => Set<SchoolClassSubject>();
    public DbSet<SchoolGradingBand> SchoolGradingBands => Set<SchoolGradingBand>();
    public DbSet<TeacherAssignment> TeacherAssignments => Set<TeacherAssignment>();
    public DbSet<Result> Results => Set<Result>();
    public DbSet<StudentNumberCounter> StudentNumberCounters => Set<StudentNumberCounter>();
    public DbSet<StudentSubjectEnrollment> StudentSubjectEnrollments => Set<StudentSubjectEnrollment>();
    public DbSet<AttendanceRegister> AttendanceRegisters => Set<AttendanceRegister>();
    public DbSet<AttendanceRegisterEntry> AttendanceRegisterEntries => Set<AttendanceRegisterEntry>();
    public DbSet<AttendanceDispatchLog> AttendanceDispatchLogs => Set<AttendanceDispatchLog>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRecipient> NotificationRecipients => Set<NotificationRecipient>();
    public DbSet<ParentOtpChallenge> ParentOtpChallenges => Set<ParentOtpChallenge>();
    public DbSet<TimetableSlot> TimetableSlots => Set<TimetableSlot>();
    public DbSet<TimetablePublication> TimetablePublications => Set<TimetablePublication>();
    public DbSet<TimetableDispatchLog> TimetableDispatchLogs => Set<TimetableDispatchLog>();
    public DbSet<AcademicTerm> AcademicTerms => Set<AcademicTerm>();
    public DbSet<SchoolCalendarEvent> SchoolCalendarEvents => Set<SchoolCalendarEvent>();
    public DbSet<LibraryBook> LibraryBooks => Set<LibraryBook>();
    public DbSet<LibraryBookCopy> LibraryBookCopies => Set<LibraryBookCopy>();
    public DbSet<LibraryLoan> LibraryLoans => Set<LibraryLoan>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<School>(entity =>
        {
            entity.Property(x => x.SchoolCode).HasMaxLength(20);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.AdminContactEmail).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolCode).IsUnique();
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.Property(x => x.Username).HasMaxLength(100);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.ContactEmail).HasMaxLength(200);
            entity.Property(x => x.Role).HasConversion<int>();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => new { x.SchoolId, x.Role });
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(x => x.ActorRole).HasMaxLength(40);
            entity.Property(x => x.ActorName).HasMaxLength(200);
            entity.Property(x => x.Action).HasMaxLength(80);
            entity.Property(x => x.EntityType).HasMaxLength(80);
            entity.Property(x => x.EntityId).HasMaxLength(80);
            entity.Property(x => x.Summary).HasMaxLength(1000);
            entity.Property(x => x.OldValue).HasMaxLength(4000);
            entity.Property(x => x.NewValue).HasMaxLength(4000);
            entity.HasIndex(x => new { x.SchoolId, x.CreatedAt });
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Account)
                .WithOne()
                .HasForeignKey<AdminUser>(x => x.Id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StaffAdmin>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Account)
                .WithOne()
                .HasForeignKey<StaffAdmin>(x => x.Id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TeacherUser>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Account)
                .WithOne()
                .HasForeignKey<TeacherUser>(x => x.Id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LibraryAdminUser>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Account)
                .WithOne()
                .HasForeignKey<LibraryAdminUser>(x => x.Id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AccountantUser>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Account)
                .WithOne()
                .HasForeignKey<AccountantUser>(x => x.Id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Guardian>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.Relationship).HasMaxLength(100);
            entity.Property(x => x.ParentEmail).HasMaxLength(200);
            entity.Property(x => x.ParentPhone).HasMaxLength(50);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.IdentityDocumentType).HasMaxLength(100);
            entity.Property(x => x.IdentityDocumentNumber).HasMaxLength(100);
            entity.Property(x => x.BirthCertificateNumber).HasMaxLength(100);
            entity.HasIndex(x => x.ParentEmail);
            entity.HasIndex(x => x.ParentPhone);
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Student)
                .WithMany(x => x.Guardians)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<Student>(entity =>
        {
            entity.Property(x => x.ProfileKey).HasMaxLength(64);
            entity.Property(x => x.StudentNumber).HasMaxLength(50);
            entity.Property(x => x.FullName).HasMaxLength(200);
            entity.Property(x => x.Class).HasMaxLength(100);
            entity.Property(x => x.Level).HasMaxLength(100);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.ParentEmail).HasMaxLength(200);
            entity.Property(x => x.ParentPhone).HasMaxLength(50);
            entity.Property(x => x.ParentPasswordHash).HasMaxLength(512);
            entity.HasIndex(x => x.GuardianId).IsUnique(false);
            entity.HasIndex(x => x.ProfileKey);
            entity.HasIndex(x => x.ParentEmail);
            entity.HasIndex(x => x.ParentPhone);
            entity.HasIndex(x => new { x.SchoolId, x.StudentNumber }).IsUnique();
            entity.HasOne(x => x.Guardian)
                .WithMany()
                .HasForeignKey(x => x.GuardianId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<StudentAccount>(entity =>
        {
            entity.Property(x => x.Currency).HasMaxLength(10);
            entity.Property(x => x.Balance).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.SchoolId, x.StudentId }).IsUnique();
            entity.HasOne<Student>()
                .WithOne()
                .HasForeignKey<StudentAccount>(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AccountingTransaction>(entity =>
        {
            entity.Property(x => x.Type).HasConversion<int>();
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Reference).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.SchoolId, x.StudentId, x.TransactionDate });
            entity.HasIndex(x => new { x.SchoolId, x.Status, x.TransactionDate });
            entity.HasOne<StudentAccount>()
                .WithMany()
                .HasForeignKey(x => x.StudentAccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LedgerEntry>(entity =>
        {
            entity.Property(x => x.AccountCode).HasMaxLength(50);
            entity.Property(x => x.Debit).HasPrecision(18, 2);
            entity.Property(x => x.Credit).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.SchoolId, x.TransactionId });
            entity.HasOne<AccountingTransaction>()
                .WithMany()
                .HasForeignKey(x => x.TransactionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FeeStructure>(entity =>
        {
            entity.Property(x => x.GradeLevel).HasMaxLength(100);
            entity.Property(x => x.Term).HasMaxLength(100);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.SchoolId, x.GradeLevel, x.Term }).IsUnique();
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.Property(x => x.Term).HasMaxLength(100);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => new { x.SchoolId, x.StudentId, x.Term });
            entity.HasIndex(x => new { x.SchoolId, x.Status, x.DueAt });
            entity.HasOne<StudentAccount>()
                .WithMany()
                .HasForeignKey(x => x.StudentAccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Method).HasConversion<int>();
            entity.Property(x => x.Reference).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.StudentId, x.ReceivedAt });
            entity.HasOne<StudentAccount>()
                .WithMany()
                .HasForeignKey(x => x.StudentAccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudentMovement>(entity =>
        {
            entity.Property(x => x.ProfileKey).HasMaxLength(64);
            entity.Property(x => x.Action).HasMaxLength(40);
            entity.Property(x => x.SourceClass).HasMaxLength(100);
            entity.Property(x => x.SourceLevel).HasMaxLength(100);
            entity.Property(x => x.DestinationClass).HasMaxLength(100);
            entity.Property(x => x.DestinationLevel).HasMaxLength(100);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.SchoolId, x.ProfileKey, x.CreatedAt });
            entity.HasIndex(x => x.PromotionRunId);
            entity.HasOne(x => x.SourceStudent)
                .WithMany()
                .HasForeignKey(x => x.SourceStudentId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(x => x.DestinationStudent)
                .WithMany()
                .HasForeignKey(x => x.DestinationStudentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PromotionRun)
                .WithMany(x => x.Movements)
                .HasForeignKey(x => x.PromotionRunId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<StudentProgressionRun>(entity =>
        {
            entity.Property(x => x.AcademicYearLabel).HasMaxLength(100);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.SchoolId, x.CreatedAt });
            entity.HasIndex(x => new { x.SchoolId, x.AcademicYearLabel });
        });

        modelBuilder.Entity<StudentSubjectEnrollment>(entity =>
        {
            entity.HasIndex(x => new { x.SchoolId, x.StudentId, x.SubjectId }).IsUnique();
            entity.HasOne(x => x.Student)
                .WithMany(x => x.SubjectEnrollments)
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Subject)
                .WithMany()
                .HasForeignKey(x => x.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Subject>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(20);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.GradeLevel).HasMaxLength(100);
            entity.Property(x => x.WeeklyLoad).HasDefaultValue(1);
            entity.Property(x => x.IsPractical).HasDefaultValue(false);
            entity.HasIndex(x => new { x.SchoolId, x.GradeLevel, x.Code }).IsUnique();
            entity.HasIndex(x => new { x.SchoolId, x.GradeLevel, x.Name }).IsUnique();
        });

        modelBuilder.Entity<SchoolClass>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(100);
            entity.Property(x => x.GradeLevel).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.SchoolId, x.GradeLevel });
        });

        modelBuilder.Entity<SchoolClassSubject>(entity =>
        {
            entity.HasIndex(x => new { x.SchoolClassId, x.SubjectId }).IsUnique();
            entity.HasOne(x => x.SchoolClass)
                .WithMany(x => x.Subjects)
                .HasForeignKey(x => x.SchoolClassId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Subject)
                .WithMany()
                .HasForeignKey(x => x.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SchoolGradingBand>(entity =>
        {
            entity.Property(x => x.Level).HasMaxLength(100);
            entity.Property(x => x.Grade).HasMaxLength(10);
            entity.Property(x => x.MinScore).HasPrecision(5, 1);
            entity.Property(x => x.MaxScore).HasPrecision(5, 1);
            entity.HasIndex(x => new { x.SchoolId, x.Level, x.Grade }).IsUnique();
            entity.HasIndex(x => new { x.SchoolId, x.Level, x.MinScore }).IsUnique();
        });

        modelBuilder.Entity<PlatformSubjectCatalog>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(20);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.GradeLevel).HasMaxLength(100);
            entity.Property(x => x.WeeklyLoad).HasDefaultValue(1);
            entity.Property(x => x.IsPractical).HasDefaultValue(false);
            entity.HasIndex(x => new { x.GradeLevel, x.Code }).IsUnique();
            entity.HasIndex(x => new { x.GradeLevel, x.Name }).IsUnique();
        });

        modelBuilder.Entity<TeacherAssignment>(entity =>
        {
            entity.Property(x => x.Class).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.SubjectId, x.Class }).IsUnique();
        });

        modelBuilder.Entity<Result>(entity =>
        {
            entity.Property(x => x.Grade).HasMaxLength(20);
            entity.Property(x => x.Term).HasMaxLength(50);
            entity.Property(x => x.Comment).HasMaxLength(1000);
            entity.Property(x => x.ApprovalStatus).HasMaxLength(40);
            entity.HasIndex(x => new { x.SchoolId, x.StudentId, x.SubjectId, x.Term });
        });

        modelBuilder.Entity<AttendanceRegister>(entity =>
        {
            entity.Property(x => x.Class).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.Class, x.AttendanceDate }).IsUnique();
            entity.HasOne(x => x.Teacher)
                .WithMany()
                .HasForeignKey(x => x.TeacherId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.AcademicTerm)
                .WithMany()
                .HasForeignKey(x => x.AcademicTermId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AttendanceRegisterEntry>(entity =>
        {
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.SchoolId, x.AttendanceRegisterId, x.StudentId }).IsUnique();
            entity.HasOne(x => x.AttendanceRegister)
                .WithMany(x => x.Entries)
                .HasForeignKey(x => x.AttendanceRegisterId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AttendanceDispatchLog>(entity =>
        {
            entity.Property(x => x.DestinationEmail).HasMaxLength(200);
            entity.Property(x => x.ErrorMessage).HasMaxLength(1000);
            entity.HasIndex(x => new { x.SchoolId, x.AttendanceDate }).IsUnique();
        });

        modelBuilder.Entity<StudentNumberCounter>(entity =>
        {
            entity.HasIndex(x => x.SchoolId).IsUnique();
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(200);
            entity.Property(x => x.Message).HasMaxLength(2000);
            entity.Property(x => x.Type).HasConversion<int>();
        });

        modelBuilder.Entity<NotificationRecipient>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.RecipientType).HasMaxLength(40);
            entity.Property(x => x.Destination).HasMaxLength(200);
            entity.Property(x => x.LastError).HasMaxLength(1000);
            entity.HasOne(x => x.Notification)
                .WithMany(x => x.Recipients)
                .HasForeignKey(x => x.NotificationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.StaffUser)
                .WithMany()
                .HasForeignKey(x => x.StaffUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ParentOtpChallenge>(entity =>
        {
            entity.Property(x => x.Destination).HasMaxLength(200);
            entity.Property(x => x.CodeHash).HasMaxLength(256);
        });

        modelBuilder.Entity<TimetableSlot>(entity =>
        {
            entity.Property(x => x.Class).HasMaxLength(100);
            entity.Property(x => x.Term).HasMaxLength(50);
            entity.Property(x => x.DayOfWeek).HasMaxLength(20);
            entity.HasIndex(x => new { x.SchoolId, x.TeacherId, x.SubjectId, x.Class, x.Term, x.DayOfWeek, x.StartTime }).IsUnique();
            entity.HasOne(x => x.Teacher)
                .WithMany()
                .HasForeignKey(x => x.TeacherId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Subject)
                .WithMany()
                .HasForeignKey(x => x.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TimetablePublication>(entity =>
        {
            entity.Property(x => x.Term).HasMaxLength(50);
            entity.HasIndex(x => new { x.SchoolId, x.Term }).IsUnique();
        });

        modelBuilder.Entity<TimetableDispatchLog>(entity =>
        {
            entity.Property(x => x.Term).HasMaxLength(50);
            entity.Property(x => x.LastError).HasMaxLength(1000);
            entity.HasIndex(x => new { x.SchoolId, x.TeacherId, x.Term }).IsUnique();
        });

        modelBuilder.Entity<AcademicTerm>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.TermNumber }).IsUnique();
        });

        modelBuilder.Entity<SchoolCalendarEvent>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(200);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasOne(x => x.AcademicTerm)
                .WithMany(x => x.Events)
                .HasForeignKey(x => x.AcademicTermId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LibraryBook>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(250);
            entity.Property(x => x.Author).HasMaxLength(250);
            entity.Property(x => x.Isbn).HasMaxLength(50);
            entity.Property(x => x.AccessionNumber).HasMaxLength(100);
            entity.Property(x => x.Publisher).HasMaxLength(200);
            entity.Property(x => x.Category).HasMaxLength(150);
            entity.Property(x => x.Subject).HasMaxLength(150);
            entity.Property(x => x.Genre).HasMaxLength(150);
            entity.Property(x => x.Edition).HasMaxLength(100);
            entity.Property(x => x.ShelfLocation).HasMaxLength(100);
            entity.Property(x => x.Condition).HasMaxLength(100);
            entity.HasIndex(x => new { x.SchoolId, x.Title });
            entity.HasIndex(x => new { x.SchoolId, x.Isbn });
            entity.HasIndex(x => new { x.SchoolId, x.AccessionNumber });
            entity.HasMany(x => x.Copies)
                .WithOne(x => x.Book)
                .HasForeignKey(x => x.LibraryBookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LibraryBookCopy>(entity =>
        {
            entity.Property(x => x.AccessionNumber).HasMaxLength(100);
            entity.Property(x => x.ShelfLocation).HasMaxLength(100);
            entity.Property(x => x.Condition).HasMaxLength(100);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => new { x.SchoolId, x.LibraryBookId });
            entity.HasIndex(x => new { x.SchoolId, x.AccessionNumber });
        });

        modelBuilder.Entity<LibraryLoan>(entity =>
        {
            entity.Property(x => x.BorrowerDisplayNameSnapshot).HasMaxLength(200);
            entity.Property(x => x.BorrowerReferenceSnapshot).HasMaxLength(100);
            entity.Property(x => x.IssuedByDisplayNameSnapshot).HasMaxLength(200);
            entity.Property(x => x.IssuedByUserNameSnapshot).HasMaxLength(100);
            entity.Property(x => x.IssuedByRoleSnapshot).HasMaxLength(40);
            entity.Property(x => x.BookTitleSnapshot).HasMaxLength(250);
            entity.Property(x => x.BookAuthorSnapshot).HasMaxLength(250);
            entity.Property(x => x.BookIsbnSnapshot).HasMaxLength(50);
            entity.Property(x => x.CopyAccessionNumberSnapshot).HasMaxLength(100);
            entity.Property(x => x.CopyShelfLocationSnapshot).HasMaxLength(100);
            entity.Property(x => x.CopyConditionSnapshot).HasMaxLength(100);
            entity.Property(x => x.ReturnedByDisplayNameSnapshot).HasMaxLength(200);
            entity.Property(x => x.ReturnedByUserNameSnapshot).HasMaxLength(100);
            entity.Property(x => x.ReturnNotes).HasMaxLength(1000);
            entity.Property(x => x.BorrowerType).HasConversion<int>();
            entity.HasIndex(x => new { x.SchoolId, x.DueAt, x.ReturnedAt });
            entity.HasIndex(x => new { x.SchoolId, x.BorrowerType, x.StudentId });
            entity.HasIndex(x => new { x.SchoolId, x.BorrowerType, x.TeacherId });
            entity.HasOne(x => x.Book)
                .WithMany()
                .HasForeignKey(x => x.LibraryBookId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(x => x.BookCopy)
                .WithMany()
                .HasForeignKey(x => x.LibraryBookCopyId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Student)
                .WithMany()
                .HasForeignKey(x => x.StudentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Teacher)
                .WithMany()
                .HasForeignKey(x => x.TeacherId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        ApplySchoolFilter<AppUser>(modelBuilder);
        ApplySchoolFilter<AdminUser>(modelBuilder);
        ApplySchoolFilter<StaffAdmin>(modelBuilder);
        ApplySchoolFilter<TeacherUser>(modelBuilder);
        ApplySchoolFilter<LibraryAdminUser>(modelBuilder);
        ApplySchoolFilter<AccountantUser>(modelBuilder);
        ApplySchoolFilter<Guardian>(modelBuilder);
        ApplySchoolFilter<Student>(modelBuilder);
        ApplySchoolFilter<StudentAccount>(modelBuilder);
        ApplySchoolFilter<AccountingTransaction>(modelBuilder);
        ApplySchoolFilter<LedgerEntry>(modelBuilder);
        ApplySchoolFilter<FeeStructure>(modelBuilder);
        ApplySchoolFilter<Invoice>(modelBuilder);
        ApplySchoolFilter<Payment>(modelBuilder);
        ApplySchoolFilter<StudentSubjectEnrollment>(modelBuilder);
        ApplySchoolFilter<AttendanceRegister>(modelBuilder);
        ApplySchoolFilter<AttendanceRegisterEntry>(modelBuilder);
        ApplySchoolFilter<AttendanceDispatchLog>(modelBuilder);
        ApplySchoolFilter<Subject>(modelBuilder);
        ApplySchoolFilter<SchoolClass>(modelBuilder);
        ApplySchoolFilter<SchoolClassSubject>(modelBuilder);
        ApplySchoolFilter<StudentMovement>(modelBuilder);
        ApplySchoolFilter<StudentProgressionRun>(modelBuilder);
        ApplySchoolFilter<TeacherAssignment>(modelBuilder);
        ApplySchoolFilter<Result>(modelBuilder);
        ApplySchoolFilter<StudentNumberCounter>(modelBuilder);
        ApplySchoolFilter<Notification>(modelBuilder);
        ApplySchoolFilter<TimetableSlot>(modelBuilder);
        ApplySchoolFilter<TimetablePublication>(modelBuilder);
        ApplySchoolFilter<TimetableDispatchLog>(modelBuilder);
        ApplySchoolFilter<AcademicTerm>(modelBuilder);
        ApplySchoolFilter<SchoolCalendarEvent>(modelBuilder);
        ApplySchoolFilter<LibraryBook>(modelBuilder);
        ApplySchoolFilter<LibraryBookCopy>(modelBuilder);
        ApplySchoolFilter<LibraryLoan>(modelBuilder);
    }

    private void ApplySchoolFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ISchoolScoped
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(entity => !_currentUserContext.HasSchoolScope || entity.SchoolId == _currentUserContext.SchoolId);
    }
}
