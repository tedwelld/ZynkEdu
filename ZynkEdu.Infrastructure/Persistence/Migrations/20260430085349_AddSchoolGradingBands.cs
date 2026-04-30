using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSchoolGradingBands : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SchoolGradingBands",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    Level = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Grade = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    MinScore = table.Column<decimal>(type: "decimal(5,1)", precision: 5, scale: 1, nullable: false),
                    MaxScore = table.Column<decimal>(type: "decimal(5,1)", precision: 5, scale: 1, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SchoolGradingBands", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SchoolGradingBands_SchoolId_Level_Grade",
                table: "SchoolGradingBands",
                columns: new[] { "SchoolId", "Level", "Grade" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SchoolGradingBands_SchoolId_Level_MinScore",
                table: "SchoolGradingBands",
                columns: new[] { "SchoolId", "Level", "MinScore" },
                unique: true);

            migrationBuilder.Sql("""
INSERT INTO [SchoolGradingBands] ([SchoolId], [Level], [Grade], [MinScore], [MaxScore])
SELECT s.[Id], bands.[Level], bands.[Grade], bands.[MinScore], bands.[MaxScore]
FROM [Schools] AS s
CROSS JOIN (
    VALUES
        (N'ZGC Level', N'A', CAST(80.0 AS decimal(5,1)), CAST(100.0 AS decimal(5,1))),
        (N'ZGC Level', N'B', CAST(70.0 AS decimal(5,1)), CAST(79.9 AS decimal(5,1))),
        (N'ZGC Level', N'C', CAST(60.0 AS decimal(5,1)), CAST(69.9 AS decimal(5,1))),
        (N'ZGC Level', N'D', CAST(50.0 AS decimal(5,1)), CAST(59.9 AS decimal(5,1))),
        (N'ZGC Level', N'F', CAST(0.0 AS decimal(5,1)), CAST(49.9 AS decimal(5,1))),
        (N'O''Level', N'A', CAST(80.0 AS decimal(5,1)), CAST(100.0 AS decimal(5,1))),
        (N'O''Level', N'B', CAST(70.0 AS decimal(5,1)), CAST(79.9 AS decimal(5,1))),
        (N'O''Level', N'C', CAST(60.0 AS decimal(5,1)), CAST(69.9 AS decimal(5,1))),
        (N'O''Level', N'D', CAST(50.0 AS decimal(5,1)), CAST(59.9 AS decimal(5,1))),
        (N'O''Level', N'F', CAST(0.0 AS decimal(5,1)), CAST(49.9 AS decimal(5,1))),
        (N'A''Level', N'A', CAST(80.0 AS decimal(5,1)), CAST(100.0 AS decimal(5,1))),
        (N'A''Level', N'B', CAST(70.0 AS decimal(5,1)), CAST(79.9 AS decimal(5,1))),
        (N'A''Level', N'C', CAST(60.0 AS decimal(5,1)), CAST(69.9 AS decimal(5,1))),
        (N'A''Level', N'D', CAST(50.0 AS decimal(5,1)), CAST(59.9 AS decimal(5,1))),
        (N'A''Level', N'F', CAST(0.0 AS decimal(5,1)), CAST(49.9 AS decimal(5,1)))
) AS bands ([Level], [Grade], [MinScore], [MaxScore]);
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SchoolGradingBands");
        }
    }
}
