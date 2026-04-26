using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class AttendanceDispatchLog : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public DateTime DispatchedAt { get; set; }
    public bool EmailSucceeded { get; set; }
    public string? DestinationEmail { get; set; }
    public string? ErrorMessage { get; set; }
}
