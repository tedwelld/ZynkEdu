using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    public partial class UpdateTeacherAssignmentOwnershipAndCalendarValidation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ;WITH duplicates AS (
                    SELECT
                        Id,
                        ROW_NUMBER() OVER (
                            PARTITION BY SchoolId, SubjectId, Class
                            ORDER BY Id
                        ) AS RowNumber
                    FROM TeacherAssignments
                )
                DELETE FROM TeacherAssignments
                WHERE Id IN (
                    SELECT Id
                    FROM duplicates
                    WHERE RowNumber > 1
                );
                """);

            migrationBuilder.DropIndex(
                name: "IX_TeacherAssignments_SchoolId_TeacherId_SubjectId_Class",
                table: "TeacherAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherAssignments_SchoolId_SubjectId_Class",
                table: "TeacherAssignments",
                columns: new[] { "SchoolId", "SubjectId", "Class" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TeacherAssignments_SchoolId_SubjectId_Class",
                table: "TeacherAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherAssignments_SchoolId_TeacherId_SubjectId_Class",
                table: "TeacherAssignments",
                columns: new[] { "SchoolId", "TeacherId", "SubjectId", "Class" },
                unique: true);
        }
    }
}
