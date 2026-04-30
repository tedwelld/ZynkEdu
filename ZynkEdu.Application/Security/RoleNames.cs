namespace ZynkEdu.Application.Security;

public static class RoleNames
{
    public const string PlatformAdmin = nameof(PlatformAdmin);
    public const string Admin = nameof(Admin);
    public const string Teacher = nameof(Teacher);
    public const string AdminAndTeacher = "Admin,Teacher";
    public const string AdminOrPlatformAdmin = "Admin,PlatformAdmin";
    public const string TeacherOrPlatformAdmin = "Teacher,PlatformAdmin";
    public const string AdminTeacherOrPlatformAdmin = "Admin,Teacher,PlatformAdmin";
}
