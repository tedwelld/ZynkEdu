using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class LibraryLoan : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int? LibraryBookId { get; set; }
    public LibraryBook? Book { get; set; }
    public int? LibraryBookCopyId { get; set; }
    public LibraryBookCopy? BookCopy { get; set; }
    public LibraryBorrowerType BorrowerType { get; set; }
    public int? StudentId { get; set; }
    public Student? Student { get; set; }
    public int? TeacherId { get; set; }
    public TeacherUser? Teacher { get; set; }
    public string BorrowerDisplayNameSnapshot { get; set; } = string.Empty;
    public string? BorrowerReferenceSnapshot { get; set; }
    public string IssuedByDisplayNameSnapshot { get; set; } = string.Empty;
    public string IssuedByUserNameSnapshot { get; set; } = string.Empty;
    public string IssuedByRoleSnapshot { get; set; } = string.Empty;
    public string BookTitleSnapshot { get; set; } = string.Empty;
    public string? BookAuthorSnapshot { get; set; }
    public string? BookIsbnSnapshot { get; set; }
    public string? CopyAccessionNumberSnapshot { get; set; }
    public string? CopyShelfLocationSnapshot { get; set; }
    public string? CopyConditionSnapshot { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnedByDisplayNameSnapshot { get; set; }
    public string? ReturnedByUserNameSnapshot { get; set; }
    public string? ReturnNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
