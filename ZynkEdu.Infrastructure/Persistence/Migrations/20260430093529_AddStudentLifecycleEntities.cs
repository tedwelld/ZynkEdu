using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentLifecycleEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProfileKey",
                table: "Students",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE Students
                SET ProfileKey = LOWER(REPLACE(CONVERT(nvarchar(36), NEWID()), '-', ''))
                WHERE ProfileKey = '';
                """);

            migrationBuilder.CreateTable(
                name: "StudentProgressionRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    AcademicYearLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CommittedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentProgressionRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StudentMovements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    ProfileKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SourceStudentId = table.Column<int>(type: "int", nullable: false),
                    DestinationStudentId = table.Column<int>(type: "int", nullable: true),
                    SourceSchoolId = table.Column<int>(type: "int", nullable: true),
                    DestinationSchoolId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SourceClass = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SourceLevel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DestinationClass = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DestinationLevel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    EffectiveDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PromotionRunId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentMovements_StudentProgressionRuns_PromotionRunId",
                        column: x => x.PromotionRunId,
                        principalTable: "StudentProgressionRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StudentMovements_Students_DestinationStudentId",
                        column: x => x.DestinationStudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StudentMovements_Students_SourceStudentId",
                        column: x => x.SourceStudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Students_ProfileKey",
                table: "Students",
                column: "ProfileKey");

            migrationBuilder.CreateIndex(
                name: "IX_StudentMovements_DestinationStudentId",
                table: "StudentMovements",
                column: "DestinationStudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentMovements_PromotionRunId",
                table: "StudentMovements",
                column: "PromotionRunId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentMovements_SchoolId_ProfileKey_CreatedAt",
                table: "StudentMovements",
                columns: new[] { "SchoolId", "ProfileKey", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentMovements_SourceStudentId",
                table: "StudentMovements",
                column: "SourceStudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentProgressionRuns_SchoolId_AcademicYearLabel",
                table: "StudentProgressionRuns",
                columns: new[] { "SchoolId", "AcademicYearLabel" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentProgressionRuns_SchoolId_CreatedAt",
                table: "StudentProgressionRuns",
                columns: new[] { "SchoolId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentMovements");

            migrationBuilder.DropTable(
                name: "StudentProgressionRuns");

            migrationBuilder.DropIndex(
                name: "IX_Students_ProfileKey",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "ProfileKey",
                table: "Students");
        }
    }
}
