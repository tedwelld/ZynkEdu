using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformSubjectCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Subjects_SchoolId_Code",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_SchoolId_Name",
                table: "Subjects");

            migrationBuilder.CreateTable(
                name: "PlatformSubjectCatalogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    GradeLevel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SourceSchoolId = table.Column<int>(type: "int", nullable: true),
                    SourceSubjectId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSubjectCatalogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_SchoolId_GradeLevel_Code",
                table: "Subjects",
                columns: new[] { "SchoolId", "GradeLevel", "Code" },
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_SchoolId_GradeLevel_Name",
                table: "Subjects",
                columns: new[] { "SchoolId", "GradeLevel", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlatformSubjectCatalogs_GradeLevel_Code",
                table: "PlatformSubjectCatalogs",
                columns: new[] { "GradeLevel", "Code" },
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformSubjectCatalogs_GradeLevel_Name",
                table: "PlatformSubjectCatalogs",
                columns: new[] { "GradeLevel", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformSubjectCatalogs");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_SchoolId_GradeLevel_Code",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_SchoolId_GradeLevel_Name",
                table: "Subjects");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_SchoolId_Code",
                table: "Subjects",
                columns: new[] { "SchoolId", "Code" },
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_SchoolId_Name",
                table: "Subjects",
                columns: new[] { "SchoolId", "Name" },
                unique: true);
        }
    }
}
