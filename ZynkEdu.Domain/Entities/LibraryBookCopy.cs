using ZynkEdu.Domain.Common;
using ZynkEdu.Domain.Enums;

namespace ZynkEdu.Domain.Entities;

public sealed class LibraryBookCopy : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int LibraryBookId { get; set; }
    public LibraryBook? Book { get; set; }
    public string? AccessionNumber { get; set; }
    public string? ShelfLocation { get; set; }
    public string? Condition { get; set; }
    public LibraryCopyStatus Status { get; set; } = LibraryCopyStatus.Available;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
