using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDemoDataKeepPlatformAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @KeepUserId INT = (
    SELECT TOP (1) [Id]
    FROM [Users]
    WHERE [Username] = N'platformadmin' AND [Role] = 0
    ORDER BY [Id]
);

DECLARE @KeepSchoolId INT = NULL;

IF @KeepUserId IS NOT NULL
BEGIN
    SELECT @KeepSchoolId = [SchoolId]
    FROM [Users]
    WHERE [Id] = @KeepUserId;
END;

IF @KeepUserId IS NOT NULL AND @KeepSchoolId IS NOT NULL
BEGIN
    DELETE FROM [NotificationRecipients];
    DELETE FROM [Notifications];
    DELETE FROM [AttendanceRegisterEntries];
    DELETE FROM [AttendanceRegisters];
    DELETE FROM [AttendanceDispatchLogs];
    DELETE FROM [SchoolCalendarEvents];
    DELETE FROM [TimetableSlots];
    DELETE FROM [TeacherAssignments];
    DELETE FROM [Results];
    DELETE FROM [StudentSubjectEnrollments];
    DELETE FROM [ParentOtpChallenges];
    DELETE FROM [AuditLogs];
    DELETE FROM [AcademicTerms];
    DELETE FROM [StudentNumberCounters];
    DELETE FROM [Guardians];
    DELETE FROM [Students];
    DELETE FROM [Subjects];
    DELETE FROM [StaffAdmins] WHERE [Id] <> @KeepUserId;
    DELETE FROM [TeacherUsers] WHERE [Id] <> @KeepUserId;
    DELETE FROM [AdminUsers] WHERE [Id] <> @KeepUserId;
    DELETE FROM [Users] WHERE [Id] <> @KeepUserId;
    DELETE FROM [Schools] WHERE [Id] <> @KeepSchoolId;

    UPDATE [Schools]
    SET [SchoolCode] = N'PLAT',
        [Name] = N'Platform Administration',
        [Address] = N'System',
        [AdminContactEmail] = NULL
    WHERE [Id] = @KeepSchoolId;
END;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
