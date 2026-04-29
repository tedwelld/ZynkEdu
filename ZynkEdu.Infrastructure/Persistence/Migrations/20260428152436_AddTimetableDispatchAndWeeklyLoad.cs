using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTimetableDispatchAndWeeklyLoad : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WeeklyLoad",
                table: "Subjects",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "WeeklyLoad",
                table: "PlatformSubjectCatalogs",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "TimetableDispatchLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    TeacherId = table.Column<int>(type: "int", nullable: false),
                    Term = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DispatchedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimetableDispatchLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TimetablePublications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    Term = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DispatchedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimetablePublications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TimetableDispatchLogs_SchoolId_TeacherId_Term",
                table: "TimetableDispatchLogs",
                columns: new[] { "SchoolId", "TeacherId", "Term" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TimetablePublications_SchoolId_Term",
                table: "TimetablePublications",
                columns: new[] { "SchoolId", "Term" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TimetableDispatchLogs");

            migrationBuilder.DropTable(
                name: "TimetablePublications");

            migrationBuilder.DropColumn(
                name: "WeeklyLoad",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "WeeklyLoad",
                table: "PlatformSubjectCatalogs");
        }
    }
}
