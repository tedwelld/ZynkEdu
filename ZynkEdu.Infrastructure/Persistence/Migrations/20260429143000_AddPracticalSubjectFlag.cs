using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using ZynkEdu.Infrastructure.Persistence;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(ZynkEduDbContext))]
    [Migration("20260429143000_AddPracticalSubjectFlag")]
    public partial class AddPracticalSubjectFlag : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPractical",
                table: "Subjects",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPractical",
                table: "PlatformSubjectCatalogs",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPractical",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "IsPractical",
                table: "PlatformSubjectCatalogs");
        }
    }
}
