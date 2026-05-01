namespace ZynkEdu.Application.Security;

public static class RoleNames
{
    public const string PlatformAdmin = nameof(PlatformAdmin);
    public const string Admin = nameof(Admin);
    public const string Teacher = nameof(Teacher);
    public const string LibraryAdmin = nameof(LibraryAdmin);
    public const string AccountantSuper = nameof(AccountantSuper);
    public const string AccountantSenior = nameof(AccountantSenior);
    public const string AccountantJunior = nameof(AccountantJunior);
    public const string AdminAndTeacher = "Admin,Teacher";
    public const string AdminOrPlatformAdmin = "Admin,PlatformAdmin";
    public const string TeacherOrPlatformAdmin = "Teacher,PlatformAdmin";
    public const string AdminTeacherOrPlatformAdmin = "Admin,Teacher,PlatformAdmin";
    public const string AdminLibraryOrPlatformAdmin = "Admin,LibraryAdmin,PlatformAdmin";
    public const string LibraryAdminOrPlatformAdmin = "LibraryAdmin,PlatformAdmin";
    public const string LibraryAdminAdminOrPlatformAdmin = "LibraryAdmin,Admin,PlatformAdmin";
    public const string AdminTeacherAccountingOrPlatformAdmin = "Admin,Teacher,AccountantSuper,AccountantSenior,AccountantJunior,PlatformAdmin";
    public const string AccountingOperators = "Admin,AccountantSuper,AccountantSenior,AccountantJunior,PlatformAdmin";
    public const string AccountantWorkspace = "AccountantSuper,AccountantSenior,AccountantJunior,PlatformAdmin";
}
