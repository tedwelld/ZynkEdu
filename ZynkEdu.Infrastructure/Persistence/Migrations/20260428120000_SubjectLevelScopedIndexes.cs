using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations;

public partial class SubjectLevelScopedIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Subjects_SchoolId_Code",
            table: "Subjects");

        migrationBuilder.DropIndex(
            name: "IX_Subjects_SchoolId_Name",
            table: "Subjects");

        migrationBuilder.CreateIndex(
            name: "IX_Subjects_SchoolId_GradeLevel_Code",
            table: "Subjects",
            columns: new[] { "SchoolId", "GradeLevel", "Code" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Subjects_SchoolId_GradeLevel_Name",
            table: "Subjects",
            columns: new[] { "SchoolId", "GradeLevel", "Name" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
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
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Subjects_SchoolId_Name",
            table: "Subjects",
            columns: new[] { "SchoolId", "Name" },
            unique: true);
    }
}
