using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class LibraryBook : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? Isbn { get; set; }
    public string? AccessionNumber { get; set; }
    public string? Publisher { get; set; }
    public string? Category { get; set; }
    public string? Subject { get; set; }
    public string? Genre { get; set; }
    public string? Edition { get; set; }
    public int? PublicationYear { get; set; }
    public string? ShelfLocation { get; set; }
    public string? Condition { get; set; }
    public int TotalCopies { get; set; }
    public int AvailableCopies { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<LibraryBookCopy> Copies { get; set; } = [];
}
