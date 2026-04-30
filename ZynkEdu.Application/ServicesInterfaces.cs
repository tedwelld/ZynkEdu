using ZynkEdu.Application.Contracts;

namespace ZynkEdu.Application.Abstractions;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SchoolResponse>> GetPublicSchoolsAsync(CancellationToken cancellationToken = default);
}

public interface ISchoolService
{
    Task<SchoolResponse> CreateAsync(SchoolCreateRequest request, CancellationToken cancellationToken = default);
    Task<SchoolResponse> CreateWithAdminAsync(SchoolCreateWithAdminRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SchoolResponse>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SchoolResponse> UpdateAsync(int id, UpdateSchoolRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public interface ISchoolCodeGenerator
{
    Task<string> GenerateAsync(string schoolName, int? excludeSchoolId = null, CancellationToken cancellationToken = default);
    Task<string> GetOrCreateAsync(int schoolId, CancellationToken cancellationToken = default);
}

public interface ISubjectCodeGenerator
{
    Task<string> GenerateAsync(string subjectName, int schoolId, string gradeLevel, int? excludeSubjectId = null, CancellationToken cancellationToken = default);
}

public interface IAuditLogService
{
    Task LogAsync(int? schoolId, string action, string entityType, string entityId, string summary, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AuditLogResponse>> GetRecentAsync(int? schoolId = null, int take = 10, CancellationToken cancellationToken = default);
}

public interface IAttendanceService
{
    Task<IReadOnlyList<AttendanceClassOptionResponse>> GetClassOptionsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AttendanceRegisterResponse?> GetRegisterAsync(string className, DateTime attendanceDate, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AttendanceDailySummaryResponse>> GetDailySummariesAsync(DateTime attendanceDate, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AttendanceRegisterResponse> SaveAsync(SaveAttendanceRegisterRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
}

public interface IAttendanceDispatchService
{
    Task DispatchDueRegistersAsync(CancellationToken cancellationToken = default);
}

public interface ITimetableDispatchService
{
    Task DispatchDueTimetablesAsync(CancellationToken cancellationToken = default);
}

public interface IStudentService
{
    Task<StudentResponse> CreateAsync(CreateStudentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentResponse>> GetAllAsync(string? classFilter = null, int? schoolId = null, bool includeInactive = false, CancellationToken cancellationToken = default);
    Task<StudentResponse?> GetByIdAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<StudentResponse> UpdateAsync(int id, UpdateStudentRequest request, CancellationToken cancellationToken = default);
    Task<StudentResponse> UpdateStatusAsync(int id, UpdateStudentStatusRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
    Task<BulkStudentSubjectEnrollmentResponse> EnrollAllSubjectsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
}

public interface ITeacherAssignmentService
{
    Task<TeacherAssignmentResponse> CreateAsync(CreateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<TeacherAssignmentBatchResponse> CreateBatchAsync(CreateTeacherAssignmentsBatchRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TeacherAssignmentResponse>> GetByTeacherAsync(int teacherId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TeacherAssignmentResponse>> GetAllAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<TeacherAssignmentResponse> UpdateAsync(int id, UpdateTeacherAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
}

public interface IResultService
{
    Task<ResultResponse> CreateAsync(CreateResultRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ResultResponse>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ResultResponse>> GetStudentResultsAsync(int studentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ResultResponse>> GetClassResultsAsync(string className, CancellationToken cancellationToken = default);
    Task<ResultSlipSendResponse> SendSlipAsync(int studentId, SendResultSlipRequest request, byte[] slipPdf, string slipFileName, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<ResultResponse> ApproveAsync(int id, CancellationToken cancellationToken = default);
    Task<ResultResponse> RejectAsync(int id, CancellationToken cancellationToken = default);
    Task<ResultResponse> ReopenAsync(int id, CancellationToken cancellationToken = default);
    Task<ResultResponse> LockAsync(int id, CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task<NotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<NotificationResponse>> GetAllAsync(CancellationToken cancellationToken = default);
}

public interface IUserManagementService
{
    Task<UserResponse> CreateTeacherAsync(CreateSchoolUserRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> CreateTeacherWithAssignmentAsync(CreateTeacherWithAssignmentRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> CreateAdminAsync(int schoolId, CreateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetTeachersAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetAdminsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateTeacherAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task DeleteTeacherAsync(int id, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateAdminAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task DeleteAdminAsync(int id, CancellationToken cancellationToken = default);
}

public interface IDashboardService
{
    Task<DashboardResponse> GetAsync(int? schoolId = null, CancellationToken cancellationToken = default);
}

public interface IAcademicCalendarService
{
    Task<IReadOnlyList<AcademicTermResponse>> GetTermsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<AcademicTermResponse> UpsertTermAsync(int termNumber, UpsertAcademicTermRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SchoolCalendarEventResponse>> GetEventsAsync(int? termId = null, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<SchoolCalendarEventResponse> CreateEventAsync(CreateSchoolCalendarEventRequest request, CancellationToken cancellationToken = default);
    Task DeleteEventAsync(int id, CancellationToken cancellationToken = default);
}
