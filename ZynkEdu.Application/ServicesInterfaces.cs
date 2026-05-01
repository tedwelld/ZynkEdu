using ZynkEdu.Application.Contracts;
using ZynkEdu.Domain.Enums;

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
    Task LogAsync(
        int? schoolId,
        string action,
        string entityType,
        string entityId,
        string summary,
        string? oldValue = null,
        string? newValue = null,
        CancellationToken cancellationToken = default);
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
    Task<UserResponse> CreateLibraryAdminAsync(int schoolId, CreateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task<UserResponse> CreateAccountantAsync(CreateAccountantRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetAccountantsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetTeachersAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetAdminsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserResponse>> GetLibraryAdminsAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateTeacherAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task DeleteTeacherAsync(int id, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateAdminAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task DeleteAdminAsync(int id, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateLibraryAdminAsync(int id, UpdateSchoolUserRequest request, CancellationToken cancellationToken = default);
    Task DeleteLibraryAdminAsync(int id, CancellationToken cancellationToken = default);
}

public interface ILibraryService
{
    Task<LibraryDashboardResponse> GetDashboardAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryBookResponse>> GetBooksAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryBookResponse?> GetBookAsync(int id, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryBookResponse> CreateBookAsync(CreateLibraryBookRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryBookResponse> UpdateBookAsync(int id, UpdateLibraryBookRequest request, CancellationToken cancellationToken = default);
    Task DeleteBookAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryBookCopyResponse>> GetCopiesAsync(int bookId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryBookCopyResponse> AddCopyAsync(int bookId, CreateLibraryBookCopyRequest request, CancellationToken cancellationToken = default);
    Task<LibraryBookCopyResponse> UpdateCopyAsync(int id, UpdateLibraryBookCopyRequest request, CancellationToken cancellationToken = default);
    Task DeleteCopyAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryLoanResponse>> GetLoansAsync(int? schoolId = null, bool activeOnly = false, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryLoanResponse>> GetOverdueLoansAsync(int? schoolId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryLoanResponse>> GetBorrowerLoansAsync(LibraryBorrowerType borrowerType, int borrowerId, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryLoanResponse> IssueAsync(IssueLibraryBookRequest request, int? schoolId = null, CancellationToken cancellationToken = default);
    Task<LibraryLoanResponse> ReturnAsync(int id, ReturnLibraryBookRequest request, CancellationToken cancellationToken = default);
    Task<LibraryLoanResponse> RenewAsync(int id, RenewLibraryLoanRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LibraryBorrowerSummaryResponse>> GetBorrowerSummariesAsync(int? schoolId = null, CancellationToken cancellationToken = default);
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
