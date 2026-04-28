using Microsoft.EntityFrameworkCore;
using ZynkEdu.Application.Abstractions;
using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Entities;
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
    public DbSet<Guardian> Guardians => Set<Guardian>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<PlatformSubjectCatalog> PlatformSubjectCatalogs => Set<PlatformSubjectCatalog>();
    public DbSet<SchoolClass> SchoolClasses => Set<SchoolClass>();
    public DbSet<SchoolClassSubject> SchoolClassSubjects => Set<SchoolClassSubject>();
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
    public DbSet<AcademicTerm> AcademicTerms => Set<AcademicTerm>();
    public DbSet<SchoolCalendarEvent> SchoolCalendarEvents => Set<SchoolCalendarEvent>();

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

        modelBuilder.Entity<Guardian>(entity =>
        {
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.ParentEmail).HasMaxLength(200);
            entity.Property(x => x.ParentPhone).HasMaxLength(50);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.HasIndex(x => x.ParentEmail).IsUnique();
            entity.HasIndex(x => x.ParentPhone).IsUnique();
            entity.HasIndex(x => x.SchoolId);
            entity.HasOne(x => x.Student)
                .WithOne(x => x.Guardian)
                .HasForeignKey<Student>(x => x.GuardianId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Student>(entity =>
        {
            entity.Property(x => x.StudentNumber).HasMaxLength(50);
            entity.Property(x => x.FullName).HasMaxLength(200);
            entity.Property(x => x.Class).HasMaxLength(100);
            entity.Property(x => x.Level).HasMaxLength(100);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.ParentEmail).HasMaxLength(200);
            entity.Property(x => x.ParentPhone).HasMaxLength(50);
            entity.Property(x => x.ParentPasswordHash).HasMaxLength(512);
            entity.HasIndex(x => x.GuardianId).IsUnique(false);
            entity.HasIndex(x => x.ParentEmail).IsUnique();
            entity.HasIndex(x => x.ParentPhone).IsUnique();
            entity.HasIndex(x => new { x.SchoolId, x.StudentNumber }).IsUnique();
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

        modelBuilder.Entity<PlatformSubjectCatalog>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(20);
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.GradeLevel).HasMaxLength(100);
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

        ApplySchoolFilter<AppUser>(modelBuilder);
        ApplySchoolFilter<AdminUser>(modelBuilder);
        ApplySchoolFilter<StaffAdmin>(modelBuilder);
        ApplySchoolFilter<TeacherUser>(modelBuilder);
        ApplySchoolFilter<Guardian>(modelBuilder);
        ApplySchoolFilter<Student>(modelBuilder);
        ApplySchoolFilter<StudentSubjectEnrollment>(modelBuilder);
        ApplySchoolFilter<AttendanceRegister>(modelBuilder);
        ApplySchoolFilter<AttendanceRegisterEntry>(modelBuilder);
        ApplySchoolFilter<AttendanceDispatchLog>(modelBuilder);
        ApplySchoolFilter<Subject>(modelBuilder);
        ApplySchoolFilter<SchoolClass>(modelBuilder);
        ApplySchoolFilter<SchoolClassSubject>(modelBuilder);
        ApplySchoolFilter<TeacherAssignment>(modelBuilder);
        ApplySchoolFilter<Result>(modelBuilder);
        ApplySchoolFilter<StudentNumberCounter>(modelBuilder);
        ApplySchoolFilter<Notification>(modelBuilder);
        ApplySchoolFilter<TimetableSlot>(modelBuilder);
        ApplySchoolFilter<AcademicTerm>(modelBuilder);
        ApplySchoolFilter<SchoolCalendarEvent>(modelBuilder);
    }

    private void ApplySchoolFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ISchoolScoped
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(entity => !_currentUserContext.HasSchoolScope || entity.SchoolId == _currentUserContext.SchoolId);
    }
}
