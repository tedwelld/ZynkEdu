using ZynkEdu.Domain.Common;

namespace ZynkEdu.Domain.Entities;

public sealed class StudentNumberCounter : EntityBase, ISchoolScoped
{
    public int SchoolId { get; set; }
    public int LastNumber { get; set; }
}
