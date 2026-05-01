using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ZynkEdu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LibraryAdminUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryAdminUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LibraryAdminUsers_Users_Id",
                        column: x => x.Id,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LibraryBooks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Author = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Isbn = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AccessionNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Publisher = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Subject = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Genre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Edition = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PublicationYear = table.Column<int>(type: "int", nullable: true),
                    ShelfLocation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Condition = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TotalCopies = table.Column<int>(type: "int", nullable: false),
                    AvailableCopies = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryBooks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LibraryBookCopies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    LibraryBookId = table.Column<int>(type: "int", nullable: false),
                    AccessionNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ShelfLocation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Condition = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryBookCopies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LibraryBookCopies_LibraryBooks_LibraryBookId",
                        column: x => x.LibraryBookId,
                        principalTable: "LibraryBooks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LibraryLoans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolId = table.Column<int>(type: "int", nullable: false),
                    LibraryBookId = table.Column<int>(type: "int", nullable: true),
                    LibraryBookCopyId = table.Column<int>(type: "int", nullable: true),
                    BorrowerType = table.Column<int>(type: "int", nullable: false),
                    StudentId = table.Column<int>(type: "int", nullable: true),
                    TeacherId = table.Column<int>(type: "int", nullable: true),
                    BorrowerDisplayNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BorrowerReferenceSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IssuedByDisplayNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IssuedByUserNameSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IssuedByRoleSnapshot = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    BookTitleSnapshot = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    BookAuthorSnapshot = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    BookIsbnSnapshot = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CopyAccessionNumberSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CopyShelfLocationSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CopyConditionSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IssuedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReturnedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReturnedByDisplayNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReturnedByUserNameSnapshot = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ReturnNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryLoans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LibraryLoans_LibraryBookCopies_LibraryBookCopyId",
                        column: x => x.LibraryBookCopyId,
                        principalTable: "LibraryBookCopies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LibraryLoans_LibraryBooks_LibraryBookId",
                        column: x => x.LibraryBookId,
                        principalTable: "LibraryBooks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_LibraryLoans_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LibraryLoans_TeacherUsers_TeacherId",
                        column: x => x.TeacherId,
                        principalTable: "TeacherUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryAdminUsers_SchoolId",
                table: "LibraryAdminUsers",
                column: "SchoolId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBookCopies_LibraryBookId",
                table: "LibraryBookCopies",
                column: "LibraryBookId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBookCopies_SchoolId_AccessionNumber",
                table: "LibraryBookCopies",
                columns: new[] { "SchoolId", "AccessionNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBookCopies_SchoolId_LibraryBookId",
                table: "LibraryBookCopies",
                columns: new[] { "SchoolId", "LibraryBookId" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBooks_SchoolId_AccessionNumber",
                table: "LibraryBooks",
                columns: new[] { "SchoolId", "AccessionNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBooks_SchoolId_Isbn",
                table: "LibraryBooks",
                columns: new[] { "SchoolId", "Isbn" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBooks_SchoolId_Title",
                table: "LibraryBooks",
                columns: new[] { "SchoolId", "Title" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_LibraryBookCopyId",
                table: "LibraryLoans",
                column: "LibraryBookCopyId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_LibraryBookId",
                table: "LibraryLoans",
                column: "LibraryBookId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_SchoolId_BorrowerType_StudentId",
                table: "LibraryLoans",
                columns: new[] { "SchoolId", "BorrowerType", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_SchoolId_BorrowerType_TeacherId",
                table: "LibraryLoans",
                columns: new[] { "SchoolId", "BorrowerType", "TeacherId" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_SchoolId_DueAt_ReturnedAt",
                table: "LibraryLoans",
                columns: new[] { "SchoolId", "DueAt", "ReturnedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_StudentId",
                table: "LibraryLoans",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLoans_TeacherId",
                table: "LibraryLoans",
                column: "TeacherId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LibraryAdminUsers");

            migrationBuilder.DropTable(
                name: "LibraryLoans");

            migrationBuilder.DropTable(
                name: "LibraryBookCopies");

            migrationBuilder.DropTable(
                name: "LibraryBooks");
        }
    }
}
