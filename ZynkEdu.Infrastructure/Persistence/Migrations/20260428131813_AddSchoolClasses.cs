using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSchoolClasses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SchoolClasses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    GradeLevel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SchoolClasses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SchoolClassSubjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    SchoolClassId = table.Column<int>(type: "int", nullable: false),
                    SubjectId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SchoolClassSubjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SchoolClassSubjects_SchoolClasses_SchoolClassId",
                        column: x => x.SchoolClassId,
                        principalTable: "SchoolClasses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SchoolClassSubjects_Subjects_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "Subjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SchoolClasses_SchoolId_GradeLevel",
                table: "SchoolClasses",
                columns: new[] { "SchoolId", "GradeLevel" });

            migrationBuilder.CreateIndex(
                name: "IX_SchoolClasses_SchoolId_Name",
                table: "SchoolClasses",
                columns: new[] { "SchoolId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SchoolClassSubjects_SchoolClassId_SubjectId",
                table: "SchoolClassSubjects",
                columns: new[] { "SchoolClassId", "SubjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SchoolClassSubjects_SubjectId",
                table: "SchoolClassSubjects",
                column: "SubjectId");

            migrationBuilder.Sql("""
                INSERT INTO SchoolClasses (SchoolId, Name, GradeLevel, IsActive, CreatedAt)
                SELECT DISTINCT source.SchoolId, source.ClassName, source.GradeLevel, 1, SYSUTCDATETIME()
                FROM (
                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName,
                        CASE
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C') THEN 'ZGC Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts') THEN 'O''Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences') THEN 'A''Level'
                            ELSE NULL
                        END AS GradeLevel
                    FROM Students
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName,
                        CASE
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C') THEN 'ZGC Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts') THEN 'O''Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences') THEN 'A''Level'
                            ELSE NULL
                        END AS GradeLevel
                    FROM AttendanceRegisters
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName,
                        CASE
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C') THEN 'ZGC Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts') THEN 'O''Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences') THEN 'A''Level'
                            ELSE NULL
                        END AS GradeLevel
                    FROM TeacherAssignments
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName,
                        CASE
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C') THEN 'ZGC Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts') THEN 'O''Level'
                            WHEN LTRIM(RTRIM(Class)) IN ('Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences') THEN 'A''Level'
                            ELSE NULL
                        END AS GradeLevel
                    FROM TimetableSlots
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT r.SchoolId, LTRIM(RTRIM(s.Class)) AS ClassName,
                        CASE
                            WHEN LTRIM(RTRIM(s.Class)) IN ('Form 1A', 'Form 1B', 'Form 1C', 'Form 2A', 'Form 2B', 'Form 2C') THEN 'ZGC Level'
                            WHEN LTRIM(RTRIM(s.Class)) IN ('Form 3A Sciences', 'Form 3B Commercials', 'Form 3C Arts', 'Form 4A Sciences', 'Form 4B Commercials', 'Form 4C Arts') THEN 'O''Level'
                            WHEN LTRIM(RTRIM(s.Class)) IN ('Form 5 Arts', 'Form 5 Commercials', 'Form 5 Sciences', 'Form 6 Arts', 'Form 6 Commercials', 'Form 6 Sciences') THEN 'A''Level'
                            ELSE NULL
                        END AS GradeLevel
                    FROM Results r
                    INNER JOIN Students s ON s.Id = r.StudentId
                    WHERE s.Class IS NOT NULL AND LTRIM(RTRIM(s.Class)) <> ''
                ) source
                WHERE source.GradeLevel IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM SchoolClasses existing
                    WHERE existing.SchoolId = source.SchoolId
                      AND existing.Name = source.ClassName
                  );

                INSERT INTO SchoolClassSubjects (SchoolId, SchoolClassId, SubjectId, CreatedAt)
                SELECT DISTINCT source.SchoolId, class.Id, source.SubjectId, SYSUTCDATETIME()
                FROM (
                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName, SubjectId
                    FROM TeacherAssignments
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT s.SchoolId, LTRIM(RTRIM(s.Class)) AS ClassName, sse.SubjectId
                    FROM StudentSubjectEnrollments sse
                    INNER JOIN Students s ON s.Id = sse.StudentId
                    WHERE s.Class IS NOT NULL AND LTRIM(RTRIM(s.Class)) <> ''

                    UNION

                    SELECT SchoolId, LTRIM(RTRIM(Class)) AS ClassName, SubjectId
                    FROM TimetableSlots
                    WHERE Class IS NOT NULL AND LTRIM(RTRIM(Class)) <> ''

                    UNION

                    SELECT r.SchoolId, LTRIM(RTRIM(s.Class)) AS ClassName, r.SubjectId
                    FROM Results r
                    INNER JOIN Students s ON s.Id = r.StudentId
                    WHERE s.Class IS NOT NULL AND LTRIM(RTRIM(s.Class)) <> ''
                ) source
                INNER JOIN SchoolClasses class
                    ON class.SchoolId = source.SchoolId
                   AND class.Name = source.ClassName
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM SchoolClassSubjects existing
                    WHERE existing.SchoolClassId = class.Id
                      AND existing.SubjectId = source.SubjectId
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SchoolClassSubjects");

            migrationBuilder.DropTable(
                name: "SchoolClasses");
        }
    }
}
