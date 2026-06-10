using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropRetiredParentPortalArtifacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParentOtpChallenges");

            migrationBuilder.DropColumn(
                name: "ParentPasswordHash",
                table: "Students");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ParentPasswordHash",
                table: "Students",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ParentOtpChallenges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    CodeHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Destination = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParentOtpChallenges", x => x.Id);
                });
        }
    }
}
