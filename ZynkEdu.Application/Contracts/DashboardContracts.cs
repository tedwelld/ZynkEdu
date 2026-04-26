namespace ZynkEdu.Application.Contracts;

public sealed record SubjectPerformanceDto(string Subject, decimal AverageScore);
public sealed record ClassPerformanceDto(string Class, decimal AverageScore, decimal PassRate);
public sealed record StudentRankingDto(int StudentId, string StudentNumber, string StudentName, decimal AverageScore);
public sealed record TeacherPerformanceDto(int TeacherId, string TeacherName, string Subject, string Class, decimal AverageScore);
public sealed record SchoolPerformanceDto(int SchoolId, string SchoolName, decimal AverageScore, decimal PassRate, int ResultCount);

public sealed record DashboardResponse(
    decimal OverallAverageScore,
    decimal PassRate,
    IReadOnlyList<SubjectPerformanceDto> SubjectPerformance,
    IReadOnlyList<ClassPerformanceDto> ClassPerformance,
    IReadOnlyList<StudentRankingDto> TopStudents,
    IReadOnlyList<StudentRankingDto> BottomStudents,
    IReadOnlyList<TeacherPerformanceDto> TeacherPerformance,
    IReadOnlyList<SchoolPerformanceDto> SchoolPerformance);
