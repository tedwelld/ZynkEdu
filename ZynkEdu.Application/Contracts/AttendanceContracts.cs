namespace ZynkEdu.Application.Contracts;

public sealed record AttendanceClassOptionResponse(
    string ClassName,
    IReadOnlyList<string> TeacherNames,
    IReadOnlyList<string> SubjectNames,
    int StudentCount);

public sealed record AttendanceStudentRegisterResponse(
    int StudentId,
    string StudentNumber,
    string StudentName,
    string Level,
    string Status,
    string? Note);

public sealed record AttendanceRegisterResponse(
    int? RegisterId,
    int SchoolId,
    string SchoolName,
    int TeacherId,
    string TeacherName,
    string ClassName,
    DateTime AttendanceDate,
    string TermName,
    bool IsLocked,
    DateTime? DispatchedAt,
    int PresentCount,
    int AbsentCount,
    int LateCount,
    int ExcusedCount,
    IReadOnlyList<AttendanceStudentRegisterResponse> Students);

public sealed record AttendanceDailySummaryResponse(
    int RegisterId,
    int SchoolId,
    string SchoolName,
    string ClassName,
    string TeacherName,
    string TermName,
    DateTime AttendanceDate,
    int StudentCount,
    int PresentCount,
    int AbsentCount,
    int LateCount,
    int ExcusedCount,
    bool IsLocked,
    DateTime? DispatchedAt);

public sealed record SaveAttendanceRegisterEntryRequest(
    int StudentId,
    string Status,
    string? Note);

public sealed record SaveAttendanceRegisterRequest(
    DateTime AttendanceDate,
    string ClassName,
    IReadOnlyList<SaveAttendanceRegisterEntryRequest> Students);
