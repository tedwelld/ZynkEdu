using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class ResultComponentScore : ISchoolScoped
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public int ResultId { get; set; }
    public Result Result { get; set; } = default!;

    /// <summary>Component name, e.g. "Test", "Assignment", "Exam".</summary>
    public string Component { get; set; } = string.Empty;

    /// <summary>Raw score out of 100 for this component.</summary>
    public decimal Score { get; set; }

    /// <summary>Percentage weight this component contributes to the final result, e.g. 30 for 30%.</summary>
    public decimal Weight { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
