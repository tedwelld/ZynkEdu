using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetireParentPortalAddGuardiansAndStaffContacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Students_ParentEmail",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Students_ParentPhone",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_ParentEmail",
                table: "Guardians");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_ParentPhone",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "Guardians");

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "Users",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "StudentId",
                table: "NotificationRecipients",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "RecipientType",
                table: "NotificationRecipients",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StaffUserId",
                table: "NotificationRecipients",
                type: "int",
                nullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_Guardians_Students_StudentId",
                table: "Guardians");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_StudentId",
                table: "Guardians");

            migrationBuilder.AlterColumn<int>(
                name: "StudentId",
                table: "Guardians",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "Guardians",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BirthCertificateNumber",
                table: "Guardians",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentNumber",
                table: "Guardians",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentType",
                table: "Guardians",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsPrimary",
                table: "Guardians",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Relationship",
                table: "Guardians",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                INSERT INTO [Guardians]
                (
                    [SchoolId],
                    [StudentId],
                    [DisplayName],
                    [ParentEmail],
                    [ParentPhone],
                    [Relationship],
                    [Address],
                    [IdentityDocumentType],
                    [IdentityDocumentNumber],
                    [BirthCertificateNumber],
                    [IsPrimary],
                    [IsActive],
                    [CreatedAt]
                )
                SELECT
                    [s].[SchoolId],
                    [s].[Id],
                    CASE
                        WHEN NULLIF(LTRIM(RTRIM([s].[FullName])), '') IS NULL THEN 'Primary Guardian'
                        ELSE [s].[FullName]
                    END,
                    ISNULL([s].[ParentEmail], ''),
                    ISNULL([s].[ParentPhone], ''),
                    'Primary Guardian',
                    '',
                    '',
                    '',
                    '',
                    CAST(1 AS bit),
                    CAST(1 AS bit),
                    SYSUTCDATETIME()
                FROM [Students] AS [s]
                WHERE
                    (
                        NULLIF(LTRIM(RTRIM(ISNULL([s].[ParentEmail], ''))), '') IS NOT NULL
                        OR NULLIF(LTRIM(RTRIM(ISNULL([s].[ParentPhone], ''))), '') IS NOT NULL
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM [Guardians] AS [g]
                        WHERE [g].[StudentId] = [s].[Id]
                    );

                UPDATE [Students]
                SET [GuardianId] = [primary_guardian].[Id]
                FROM [Students] AS [s]
                OUTER APPLY (
                    SELECT TOP (1) [g].[Id]
                    FROM [Guardians] AS [g]
                    WHERE [g].[StudentId] = [s].[Id]
                    ORDER BY [g].[IsPrimary] DESC, [g].[CreatedAt] ASC, [g].[Id] ASC
                ) AS [primary_guardian]
                WHERE [s].[GuardianId] IS NULL
                    AND [primary_guardian].[Id] IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Students_ParentEmail",
                table: "Students",
                column: "ParentEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Students_ParentPhone",
                table: "Students",
                column: "ParentPhone");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationRecipients_StaffUserId",
                table: "NotificationRecipients",
                column: "StaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Guardians_ParentEmail",
                table: "Guardians",
                column: "ParentEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Guardians_ParentPhone",
                table: "Guardians",
                column: "ParentPhone");

            migrationBuilder.CreateIndex(
                name: "IX_Guardians_StudentId",
                table: "Guardians",
                column: "StudentId");

            migrationBuilder.AddForeignKey(
                name: "FK_Guardians_Students_StudentId",
                table: "Guardians",
                column: "StudentId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_NotificationRecipients_Users_StaffUserId",
                table: "NotificationRecipients",
                column: "StaffUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Guardians_Students_StudentId",
                table: "Guardians");

            migrationBuilder.DropForeignKey(
                name: "FK_NotificationRecipients_Users_StaffUserId",
                table: "NotificationRecipients");

            migrationBuilder.DropIndex(
                name: "IX_Students_ParentEmail",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Students_ParentPhone",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_NotificationRecipients_StaffUserId",
                table: "NotificationRecipients");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_ParentEmail",
                table: "Guardians");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_ParentPhone",
                table: "Guardians");

            migrationBuilder.DropIndex(
                name: "IX_Guardians_StudentId",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RecipientType",
                table: "NotificationRecipients");

            migrationBuilder.DropColumn(
                name: "StaffUserId",
                table: "NotificationRecipients");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "BirthCertificateNumber",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentNumber",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentType",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "IsPrimary",
                table: "Guardians");

            migrationBuilder.DropColumn(
                name: "Relationship",
                table: "Guardians");

            migrationBuilder.AlterColumn<int>(
                name: "StudentId",
                table: "NotificationRecipients",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "StudentId",
                table: "Guardians",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "Guardians",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Students_ParentEmail",
                table: "Students",
                column: "ParentEmail",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Students_ParentPhone",
                table: "Students",
                column: "ParentPhone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Guardians_ParentEmail",
                table: "Guardians",
                column: "ParentEmail",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Guardians_ParentPhone",
                table: "Guardians",
                column: "ParentPhone",
                unique: true);
        }
    }
}
