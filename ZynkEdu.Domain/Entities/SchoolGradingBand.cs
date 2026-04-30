using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class SchoolGradingBand : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public string Level { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public decimal MinScore { get; set; }
    public decimal MaxScore { get; set; }
}
