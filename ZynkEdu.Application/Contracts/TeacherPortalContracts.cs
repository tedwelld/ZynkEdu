namespace ZynkEdu.Application.Contracts;

public sealed record TeacherAssignmentSummary(
    int AssignmentId,
    int TeacherId,
    string TeacherName,
    int SubjectId,
    string SubjectName,
    string Class);
