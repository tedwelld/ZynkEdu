import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
    AcademicTermResponse,
    AccountingTransactionResponse,
    AssignClassSubjectsRequest,
    AuditLogResponse,
    BulkStudentSubjectEnrollmentResponse,
    AttendanceClassOptionResponse,
    AttendanceDailySummaryResponse,
    AttendanceRegisterResponse,
    ClassPerformanceDto,
    CollectionReportResponse,
    CreateAccountantRequest,
    CreateAdjustmentRequest,
    CreateInvoiceRequest,
    CreatePaymentRequest,
    CreateRefundRequest,
    CreateResultRequest,
    CreateSchoolRequest,
    CreateSchoolWithAdminRequest,
    CreateSchoolCalendarEventRequest,
    CreateSchoolClassRequest,
    CreateSchoolUserRequest,
    CreateLibraryBookCopyRequest,
    CreateLibraryBookRequest,
    CreateTeacherWithAssignmentRequest,
    CreateStudentRequest,
    CreateTeacherAssignmentRequest,
    CreateTeacherAssignmentsBatchRequest,
    DashboardResponse,
    DailyCashReportResponse,
    DefaulterReportResponse,
    FeeStructureRequest,
    FeeStructureResponse,
    AgingReportResponse,
    RevenueByClassReportResponse,
    StudentStatementResponse,
    LoginRequest,
    LoginResponse,
    NotificationResponse,
    ParentPreviewReportResponse,
    ResultResponse,
    ResultSlipSendResponse,
    TimetableResponse,
    SchoolResponse,
    SchoolCalendarEventResponse,
    SchoolClassResponse,
    SearchHit,
    SendNotificationRequest,
    SendResultSlipRequest,
    SaveAttendanceRegisterRequest,
    GradingSchemeResponse,
    LibraryBorrowerSummaryResponse,
    LibraryBookCopyResponse,
    LibraryBookResponse,
    LibraryDashboardResponse,
    LibraryLoanResponse,
    IssueLibraryBookRequest,
    RenewLibraryLoanRequest,
    SaveGradingSchemeRequest,
    StudentMovementRequest,
    StudentMovementResponse,
    StudentPromotionRunRequest,
    StudentPromotionRunResponse,
    StudentCommentResponse,
    StudentResponse,
    CreateSubjectRequest,
    ImportSchoolSubjectsRequest,
    ImportSubjectsResultResponse,
    SubjectResponse,
    PlatformSubjectCatalogResponse,
    TeacherAssignmentResponse,
    TeacherAssignmentBatchResponse,
    UpdateSchoolRequest,
    UpdateSchoolUserRequest,
    UpdateLibraryBookCopyRequest,
    UpdateLibraryBookRequest,
    UpdateSubjectRequest,
    UpdateSchoolClassRequest,
    UpdateStudentRequest,
    UpdateStudentStatusRequest,
    ReturnLibraryBookRequest,
    UpdateTeacherAssignmentRequest,
    UpsertAcademicTermRequest,
    PublishTimetableRequest,
    TimetablePublicationResponse,
    UpsertTimetableSlotRequest,
    UserResponse,
} from './api.models';
import { API_BASE_URL } from './api.constants';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);

    login(request: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, request);
    }

    getSchools(): Observable<SchoolResponse[]> {
        return this.http.get<SchoolResponse[]>(`${API_BASE_URL}/auth/schools`);
    }

    getPlatformSchools(): Observable<SchoolResponse[]> {
        return this.http.get<SchoolResponse[]>(`${API_BASE_URL}/platform/schools`);
    }

    createSchool(request: CreateSchoolRequest): Observable<SchoolResponse> {
        return this.http.post<SchoolResponse>(`${API_BASE_URL}/platform/schools`, request);
    }

    createSchoolWithAdmin(request: CreateSchoolWithAdminRequest): Observable<SchoolResponse> {
        return this.http.post<SchoolResponse>(`${API_BASE_URL}/platform/schools/with-admin`, request);
    }

    updateSchool(id: number, request: UpdateSchoolRequest): Observable<SchoolResponse> {
        return this.http.put<SchoolResponse>(`${API_BASE_URL}/platform/schools/${id}`, request);
    }

    deleteSchool(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/platform/schools/${id}`);
    }

    getAttendanceClasses(schoolId?: number | null): Observable<AttendanceClassOptionResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<AttendanceClassOptionResponse[]>(`${API_BASE_URL}/attendance/classes${query}`);
    }

    getAttendanceRegister(className: string, attendanceDate: string, schoolId?: number | null): Observable<AttendanceRegisterResponse> {
        const params = new URLSearchParams();
        params.set('className', className);
        params.set('attendanceDate', attendanceDate);
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        return this.http.get<AttendanceRegisterResponse>(`${API_BASE_URL}/attendance/register?${params.toString()}`);
    }

    getClasses(schoolId?: number | null): Observable<SchoolClassResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<SchoolClassResponse[]>(`${API_BASE_URL}/classes${query}`);
    }

    createClass(request: CreateSchoolClassRequest, schoolId?: number | null): Observable<SchoolClassResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<SchoolClassResponse>(`${API_BASE_URL}/classes${query}`, request);
    }

    updateClass(id: number, request: UpdateSchoolClassRequest, schoolId?: number | null): Observable<SchoolClassResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<SchoolClassResponse>(`${API_BASE_URL}/classes/${id}${query}`, request);
    }

    assignClassSubjects(id: number, request: AssignClassSubjectsRequest, schoolId?: number | null): Observable<SchoolClassResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<SchoolClassResponse>(`${API_BASE_URL}/classes/${id}/subjects${query}`, request);
    }

    deleteClass(id: number, schoolId?: number | null): Observable<void> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.delete<void>(`${API_BASE_URL}/classes/${id}${query}`);
    }

    getAttendanceDailySummaries(attendanceDate: string, schoolId?: number | null): Observable<AttendanceDailySummaryResponse[]> {
        const params = new URLSearchParams();
        params.set('attendanceDate', attendanceDate);
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        return this.http.get<AttendanceDailySummaryResponse[]>(`${API_BASE_URL}/attendance/daily?${params.toString()}`);
    }

    saveAttendanceRegister(request: SaveAttendanceRegisterRequest, schoolId?: number | null): Observable<AttendanceRegisterResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AttendanceRegisterResponse>(`${API_BASE_URL}/attendance/register${query}`, request);
    }

    getAdminDashboard(schoolId?: number | null): Observable<DashboardResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<DashboardResponse>(`${API_BASE_URL}/admin/dashboard${query}`);
    }

    getAuditLogs(schoolId?: number | null, take = 10): Observable<AuditLogResponse[]> {
        const params = new URLSearchParams();
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        params.set('take', String(take));
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<AuditLogResponse[]>(`${API_BASE_URL}/admin/audit-logs${query}`);
    }

    getStudents(classFilter?: string, schoolId?: number | null, includeInactive = false): Observable<StudentResponse[]> {
        const params = new URLSearchParams();
        if (classFilter) {
            params.set('classFilter', classFilter);
        }
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        if (includeInactive) {
            params.set('includeInactive', 'true');
        }
        const suffix = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<StudentResponse[]>(`${API_BASE_URL}/students${suffix}`);
    }

    transferStudent(request: StudentMovementRequest, schoolId?: number | null): Observable<StudentMovementResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<StudentMovementResponse>(`${API_BASE_URL}/students/lifecycle/transfer${query}`, request);
    }

    commitPromotionRun(request: StudentPromotionRunRequest, schoolId?: number | null): Observable<StudentPromotionRunResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<StudentPromotionRunResponse>(`${API_BASE_URL}/students/lifecycle/promotion-runs${query}`, request);
    }

    getStudentById(id: number): Observable<StudentResponse> {
        return this.http.get<StudentResponse>(`${API_BASE_URL}/students/${id}`);
    }

    createStudent(request: CreateStudentRequest, schoolId?: number | null): Observable<StudentResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<StudentResponse>(`${API_BASE_URL}/students${query}`, request);
    }

    updateStudent(id: number, request: UpdateStudentRequest): Observable<StudentResponse> {
        return this.http.put<StudentResponse>(`${API_BASE_URL}/students/${id}`, request);
    }

    updateStudentStatus(id: number, request: UpdateStudentStatusRequest): Observable<StudentResponse> {
        return this.http.put<StudentResponse>(`${API_BASE_URL}/students/${id}/status`, request);
    }

    deleteStudent(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/students/${id}`);
    }

    enrollAllStudentsInAllSubjects(schoolId?: number | null): Observable<BulkStudentSubjectEnrollmentResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<BulkStudentSubjectEnrollmentResponse>(`${API_BASE_URL}/students/enroll-all-subjects${query}`, {});
    }

    getSubjects(schoolId?: number | null): Observable<SubjectResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<SubjectResponse[]>(`${API_BASE_URL}/subjects${query}`);
    }

    getPlatformSubjectCatalog(): Observable<PlatformSubjectCatalogResponse[]> {
        return this.http.get<PlatformSubjectCatalogResponse[]>(`${API_BASE_URL}/platform/subjects/catalog`);
    }

    createSubject(request: CreateSubjectRequest, schoolId?: number | null): Observable<SubjectResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<SubjectResponse>(`${API_BASE_URL}/subjects${query}`, request);
    }

    updateSubject(id: number, request: UpdateSubjectRequest, schoolId?: number | null): Observable<SubjectResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<SubjectResponse>(`${API_BASE_URL}/subjects/${id}${query}`, request);
    }

    deleteSubject(id: number, schoolId?: number | null): Observable<void> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.delete<void>(`${API_BASE_URL}/subjects/${id}${query}`);
    }

    createPlatformSubjectCatalog(request: CreateSubjectRequest): Observable<PlatformSubjectCatalogResponse> {
        return this.http.post<PlatformSubjectCatalogResponse>(`${API_BASE_URL}/platform/subjects/catalog`, request);
    }

    updatePlatformSubjectCatalog(id: number, request: UpdateSubjectRequest): Observable<PlatformSubjectCatalogResponse> {
        return this.http.put<PlatformSubjectCatalogResponse>(`${API_BASE_URL}/platform/subjects/catalog/${id}`, request);
    }

    deletePlatformSubjectCatalog(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/platform/subjects/catalog/${id}`);
    }

    importSchoolSubjectsToCatalog(request: ImportSchoolSubjectsRequest): Observable<ImportSubjectsResultResponse> {
        return this.http.post<ImportSubjectsResultResponse>(`${API_BASE_URL}/platform/subjects/import/from-school-to-catalog`, request);
    }

    importSchoolSubjectsToSchool(targetSchoolId: number, request: ImportSchoolSubjectsRequest): Observable<ImportSubjectsResultResponse> {
        return this.http.post<ImportSubjectsResultResponse>(`${API_BASE_URL}/platform/subjects/import/from-school-to-school/${targetSchoolId}`, request);
    }

    publishAllCatalogSubjectsToSchool(targetSchoolId: number): Observable<ImportSubjectsResultResponse> {
        return this.http.post<ImportSubjectsResultResponse>(`${API_BASE_URL}/platform/subjects/publish-all/${targetSchoolId}`, {});
    }

    publishAllCatalogSubjectsToAllSchools(): Observable<ImportSubjectsResultResponse> {
        return this.http.post<ImportSubjectsResultResponse>(`${API_BASE_URL}/platform/subjects/publish-all-schools`, {});
    }

    getTeachers(schoolId?: number | null): Observable<UserResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<UserResponse[]>(`${API_BASE_URL}/users/teachers${query}`);
    }

    getAdmins(schoolId?: number | null): Observable<UserResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<UserResponse[]>(`${API_BASE_URL}/users/admins${query}`);
    }

    createAdmin(request: CreateSchoolUserRequest, schoolId: number): Observable<UserResponse> {
        return this.http.post<UserResponse>(`${API_BASE_URL}/users/admins?schoolId=${schoolId}`, request);
    }

    updateAdmin(id: number, request: UpdateSchoolUserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${API_BASE_URL}/users/admins/${id}`, request);
    }

    deleteAdmin(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/users/admins/${id}`);
    }

    getLibraryAdmins(schoolId?: number | null): Observable<UserResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<UserResponse[]>(`${API_BASE_URL}/users/library-admins${query}`);
    }

    createLibraryAdmin(request: CreateSchoolUserRequest, schoolId: number): Observable<UserResponse> {
        return this.http.post<UserResponse>(`${API_BASE_URL}/users/library-admins?schoolId=${schoolId}`, request);
    }

    updateLibraryAdmin(id: number, request: UpdateSchoolUserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${API_BASE_URL}/users/library-admins/${id}`, request);
    }

    deleteLibraryAdmin(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/users/library-admins/${id}`);
    }

    getAccountants(schoolId?: number | null): Observable<UserResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<UserResponse[]>(`${API_BASE_URL}/admin/accountants${query}`);
    }

    createSchoolAccountant(request: CreateAccountantRequest): Observable<UserResponse> {
        return this.http.post<UserResponse>(`${API_BASE_URL}/admin/accountants`, request);
    }

    createPlatformAccountant(request: CreateAccountantRequest, schoolId: number): Observable<UserResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<UserResponse>(`${API_BASE_URL}/platform/accountants${query}`, request);
    }

    createAccountant(request: CreateAccountantRequest, schoolId?: number | null): Observable<UserResponse> {
        if (schoolId) {
            return this.createPlatformAccountant(request, schoolId);
        }

        return this.createSchoolAccountant(request);
    }

    getFeeStructures(schoolId?: number | null): Observable<FeeStructureResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<FeeStructureResponse[]>(`${API_BASE_URL}/accounting/fee-structures${query}`);
    }

    saveFeeStructure(request: FeeStructureRequest, schoolId?: number | null): Observable<FeeStructureResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<FeeStructureResponse>(`${API_BASE_URL}/accounting/fee-structures${query}`, request);
    }

    getStudentStatement(studentId: number, schoolId?: number | null): Observable<StudentStatementResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<StudentStatementResponse>(`${API_BASE_URL}/accounting/students/${studentId}/statement${query}`);
    }

    postPayment(request: CreatePaymentRequest, schoolId?: number | null): Observable<AccountingTransactionResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AccountingTransactionResponse>(`${API_BASE_URL}/accounting/payments${query}`, request);
    }

    postInvoice(request: CreateInvoiceRequest, schoolId?: number | null): Observable<AccountingTransactionResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AccountingTransactionResponse>(`${API_BASE_URL}/accounting/invoices${query}`, request);
    }

    postAdjustment(request: CreateAdjustmentRequest, schoolId?: number | null): Observable<AccountingTransactionResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AccountingTransactionResponse>(`${API_BASE_URL}/accounting/adjustments${query}`, request);
    }

    postRefund(request: CreateRefundRequest, schoolId?: number | null): Observable<AccountingTransactionResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AccountingTransactionResponse>(`${API_BASE_URL}/accounting/refunds${query}`, request);
    }

    approveTransaction(transactionId: number, schoolId?: number | null): Observable<AccountingTransactionResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<AccountingTransactionResponse>(`${API_BASE_URL}/accounting/transactions/${transactionId}/approve${query}`, {});
    }

    getCollectionReport(schoolId?: number | null): Observable<CollectionReportResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<CollectionReportResponse>(`${API_BASE_URL}/accounting/reports/collection${query}`);
    }

    getAgingReport(schoolId?: number | null, asOf?: string | null): Observable<AgingReportResponse> {
        const params = new URLSearchParams();
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        if (asOf) {
            params.set('asOf', asOf);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<AgingReportResponse>(`${API_BASE_URL}/accounting/reports/aging${query}`);
    }

    getDailyCashReport(schoolId?: number | null, date?: string | null): Observable<DailyCashReportResponse> {
        const params = new URLSearchParams();
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        if (date) {
            params.set('date', date);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<DailyCashReportResponse>(`${API_BASE_URL}/accounting/reports/daily-cash${query}`);
    }

    getRevenueByClassReport(schoolId?: number | null): Observable<RevenueByClassReportResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<RevenueByClassReportResponse>(`${API_BASE_URL}/accounting/reports/revenue-by-class${query}`);
    }

    getDefaulters(schoolId?: number | null): Observable<DefaulterReportResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<DefaulterReportResponse>(`${API_BASE_URL}/accounting/reports/defaulters${query}`);
    }

    createTeacher(request: CreateSchoolUserRequest, schoolId?: number | null): Observable<UserResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<UserResponse>(`${API_BASE_URL}/users/teachers${query}`, request);
    }

    createTeacherWithAssignment(request: CreateTeacherWithAssignmentRequest, schoolId?: number | null): Observable<UserResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<UserResponse>(`${API_BASE_URL}/users/teachers-with-assignment${query}`, request);
    }

    updateTeacher(id: number, request: UpdateSchoolUserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${API_BASE_URL}/users/teachers/${id}`, request);
    }

    deleteTeacher(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/users/teachers/${id}`);
    }

    getLibraryDashboard(schoolId?: number | null): Observable<LibraryDashboardResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryDashboardResponse>(`${API_BASE_URL}/library/dashboard${query}`);
    }

    getLibraryBooks(schoolId?: number | null): Observable<LibraryBookResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryBookResponse[]>(`${API_BASE_URL}/library/books${query}`);
    }

    getLibraryBook(id: number, schoolId?: number | null): Observable<LibraryBookResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryBookResponse>(`${API_BASE_URL}/library/books/${id}${query}`);
    }

    createLibraryBook(request: CreateLibraryBookRequest, schoolId?: number | null): Observable<LibraryBookResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<LibraryBookResponse>(`${API_BASE_URL}/library/books${query}`, request);
    }

    updateLibraryBook(id: number, request: UpdateLibraryBookRequest): Observable<LibraryBookResponse> {
        return this.http.put<LibraryBookResponse>(`${API_BASE_URL}/library/books/${id}`, request);
    }

    deleteLibraryBook(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/library/books/${id}`);
    }

    getLibraryCopies(bookId: number, schoolId?: number | null): Observable<LibraryBookCopyResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryBookCopyResponse[]>(`${API_BASE_URL}/library/books/${bookId}/copies${query}`);
    }

    addLibraryCopy(bookId: number, request: CreateLibraryBookCopyRequest): Observable<LibraryBookCopyResponse> {
        return this.http.post<LibraryBookCopyResponse>(`${API_BASE_URL}/library/books/${bookId}/copies`, request);
    }

    updateLibraryCopy(id: number, request: UpdateLibraryBookCopyRequest): Observable<LibraryBookCopyResponse> {
        return this.http.put<LibraryBookCopyResponse>(`${API_BASE_URL}/library/copies/${id}`, request);
    }

    deleteLibraryCopy(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/library/copies/${id}`);
    }

    getLibraryLoans(schoolId?: number | null, activeOnly = false): Observable<LibraryLoanResponse[]> {
        const params = new URLSearchParams();
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        if (activeOnly) {
            params.set('activeOnly', 'true');
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<LibraryLoanResponse[]>(`${API_BASE_URL}/library/loans${query}`);
    }

    getLibraryOverdueLoans(schoolId?: number | null): Observable<LibraryLoanResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryLoanResponse[]>(`${API_BASE_URL}/library/loans/overdue${query}`);
    }

    getLibraryBorrowers(schoolId?: number | null): Observable<LibraryBorrowerSummaryResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<LibraryBorrowerSummaryResponse[]>(`${API_BASE_URL}/library/borrowers${query}`);
    }

    getLibraryBorrowerLoans(borrowerType: 'Student' | 'Teacher', borrowerId: number, schoolId?: number | null): Observable<LibraryLoanResponse[]> {
        const params = new URLSearchParams();
        params.set('borrowerId', String(borrowerId));
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        return this.http.get<LibraryLoanResponse[]>(`${API_BASE_URL}/library/borrowers/${borrowerType}/loans?${params.toString()}`);
    }

    issueLibraryBook(request: IssueLibraryBookRequest, schoolId?: number | null): Observable<LibraryLoanResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<LibraryLoanResponse>(`${API_BASE_URL}/library/loans/issue${query}`, request);
    }

    returnLibraryBook(id: number, request: ReturnLibraryBookRequest): Observable<LibraryLoanResponse> {
        return this.http.post<LibraryLoanResponse>(`${API_BASE_URL}/library/loans/${id}/return`, request);
    }

    renewLibraryLoan(id: number, request: RenewLibraryLoanRequest): Observable<LibraryLoanResponse> {
        return this.http.post<LibraryLoanResponse>(`${API_BASE_URL}/library/loans/${id}/renew`, request);
    }

    getAssignments(schoolId?: number | null): Observable<TeacherAssignmentResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<TeacherAssignmentResponse[]>(`${API_BASE_URL}/teacher-assignments${query}`);
    }

    getAssignmentsByTeacher(teacherId: number, schoolId?: number | null): Observable<TeacherAssignmentResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<TeacherAssignmentResponse[]>(`${API_BASE_URL}/teacher-assignments/teacher/${teacherId}${query}`);
    }

    createAssignment(request: CreateTeacherAssignmentRequest, schoolId?: number | null): Observable<TeacherAssignmentResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<TeacherAssignmentResponse>(`${API_BASE_URL}/teacher-assignments${query}`, request);
    }

    createAssignmentsBatch(request: CreateTeacherAssignmentsBatchRequest, schoolId?: number | null): Observable<TeacherAssignmentBatchResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<TeacherAssignmentBatchResponse>(`${API_BASE_URL}/teacher-assignments/batch${query}`, request);
    }

    updateAssignment(id: number, request: UpdateTeacherAssignmentRequest, schoolId?: number | null): Observable<TeacherAssignmentResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<TeacherAssignmentResponse>(`${API_BASE_URL}/teacher-assignments/${id}${query}`, request);
    }

    deleteAssignment(id: number, schoolId?: number | null): Observable<void> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.delete<void>(`${API_BASE_URL}/teacher-assignments/${id}${query}`);
    }

    getResultsByStudent(studentId: number): Observable<ResultResponse[]> {
        return this.http.get<ResultResponse[]>(`${API_BASE_URL}/results/student/${studentId}`);
    }

    getResults(): Observable<ResultResponse[]> {
        return this.http.get<ResultResponse[]>(`${API_BASE_URL}/results`);
    }

    getResultsByClass(className: string): Observable<ResultResponse[]> {
        return this.http.get<ResultResponse[]>(`${API_BASE_URL}/results/class/${encodeURIComponent(className)}`);
    }

    createResult(request: CreateResultRequest): Observable<ResultResponse> {
        return this.http.post<ResultResponse>(`${API_BASE_URL}/results`, request);
    }

    approveResult(id: number): Observable<ResultResponse> {
        return this.http.post<ResultResponse>(`${API_BASE_URL}/results/${id}/approve`, {});
    }

    rejectResult(id: number): Observable<ResultResponse> {
        return this.http.post<ResultResponse>(`${API_BASE_URL}/results/${id}/reject`, {});
    }

    reopenResult(id: number): Observable<ResultResponse> {
        return this.http.post<ResultResponse>(`${API_BASE_URL}/results/${id}/reopen`, {});
    }

    lockResult(id: number): Observable<ResultResponse> {
        return this.http.post<ResultResponse>(`${API_BASE_URL}/results/${id}/lock`, {});
    }

    getGradingScheme(schoolId?: number | null): Observable<GradingSchemeResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<GradingSchemeResponse>(`${API_BASE_URL}/grading-schemes${query}`);
    }

    saveGradingScheme(request: SaveGradingSchemeRequest, schoolId?: number | null): Observable<GradingSchemeResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<GradingSchemeResponse>(`${API_BASE_URL}/grading-schemes${query}`, request);
    }

    getNotifications(): Observable<NotificationResponse[]> {
        return this.http.get<NotificationResponse[]>(`${API_BASE_URL}/notifications`);
    }

    getTeacherTimetable(term?: string): Observable<TimetableResponse[]> {
        const query = term ? `?term=${encodeURIComponent(term)}` : '';
        return this.http.get<TimetableResponse[]>(`${API_BASE_URL}/timetables/me${query}`);
    }

    getTimetables(schoolId?: number | null, term?: string): Observable<TimetableResponse[]> {
        const params = new URLSearchParams();
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        if (term) {
            params.set('term', term);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<TimetableResponse[]>(`${API_BASE_URL}/timetables${query}`);
    }

    createTimetableSlot(request: UpsertTimetableSlotRequest, schoolId?: number | null): Observable<TimetableResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<TimetableResponse>(`${API_BASE_URL}/timetables${query}`, request);
    }

    updateTimetableSlot(id: number, request: UpsertTimetableSlotRequest, schoolId?: number | null): Observable<TimetableResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.put<TimetableResponse>(`${API_BASE_URL}/timetables/${id}${query}`, request);
    }

    deleteTimetableSlot(id: number, schoolId?: number | null): Observable<void> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.delete<void>(`${API_BASE_URL}/timetables/${id}${query}`);
    }

    generateTimetable(term: string, schoolId?: number | null): Observable<TimetableResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<TimetableResponse[]>(`${API_BASE_URL}/timetables/generate${query}`, { term });
    }

    publishTimetable(request: PublishTimetableRequest, schoolId?: number | null): Observable<TimetablePublicationResponse> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<TimetablePublicationResponse>(`${API_BASE_URL}/timetables/publish${query}`, request);
    }

    getAcademicTerms(schoolId?: number | null): Observable<AcademicTermResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<AcademicTermResponse[]>(`${API_BASE_URL}/academic-calendar/terms${query}`);
    }

    updateAcademicTerm(termNumber: number, request: UpsertAcademicTermRequest): Observable<AcademicTermResponse> {
        return this.http.put<AcademicTermResponse>(`${API_BASE_URL}/academic-calendar/terms/${termNumber}`, request);
    }

    getCalendarEvents(termId?: number | null): Observable<SchoolCalendarEventResponse[]> {
        const query = termId ? `?termId=${termId}` : '';
        return this.http.get<SchoolCalendarEventResponse[]>(`${API_BASE_URL}/academic-calendar/events${query}`);
    }

    createCalendarEvent(request: CreateSchoolCalendarEventRequest): Observable<SchoolCalendarEventResponse> {
        return this.http.post<SchoolCalendarEventResponse>(`${API_BASE_URL}/academic-calendar/events`, request);
    }

    deleteCalendarEvent(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/academic-calendar/events/${id}`);
    }

    sendNotification(request: SendNotificationRequest): Observable<NotificationResponse> {
        return this.http.post<NotificationResponse>(`${API_BASE_URL}/notifications/send`, request);
    }

    sendResultSlip(studentId: number, request: SendResultSlipRequest, slipPdf: Blob, schoolId?: number | null): Observable<ResultSlipSendResponse> {
        const formData = new FormData();
        formData.append('sendEmail', String(request.sendEmail));
        formData.append('sendSms', String(request.sendSms));
        formData.append('slipPdf', slipPdf, `result-slip-${studentId}.pdf`);
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.post<ResultSlipSendResponse>(`${API_BASE_URL}/results/${studentId}/send-slip${query}`, formData);
    }

    getParentResults(): Observable<StudentCommentResponse[]> {
        return this.http.get<StudentCommentResponse[]>(`${API_BASE_URL}/parent/results`);
    }

    getParentReportPreview(): Observable<ParentPreviewReportResponse[]> {
        return this.http.get<ParentPreviewReportResponse[]>(`${API_BASE_URL}/parent/report-preview`);
    }

    getSearchIndex(): Observable<{
        students: StudentResponse[];
        teachers: UserResponse[];
        subjects: SubjectResponse[];
        assignments: TeacherAssignmentResponse[];
        notifications: NotificationResponse[];
    }> {
        return this.http.get<{
            students: StudentResponse[];
            teachers: UserResponse[];
            subjects: SubjectResponse[];
            assignments: TeacherAssignmentResponse[];
            notifications: NotificationResponse[];
        }>(`${API_BASE_URL}/search-index`);
    }

    searchFallbackHits(hits: SearchHit[]): SearchHit[] {
        return hits;
    }

    toSearchHitStudent(student: StudentResponse): SearchHit {
        return {
            id: `student-${student.id}`,
            label: student.fullName,
            type: 'Student',
            description: `${student.studentNumber} · ${student.class}`,
            route: `/admin/students?schoolId=${student.schoolId}&focus=${student.id}`
        };
    }

    toSearchHitSchool(school: SchoolResponse): SearchHit {
        return {
            id: `school-${school.id}`,
            label: school.name,
            type: 'School',
            description: school.address,
            route: `/platform/schools?focus=${school.id}`
        };
    }

    toSearchHitAdmin(admin: UserResponse): SearchHit {
        return {
            id: `admin-${admin.id}`,
            label: admin.displayName,
            type: 'Admin',
            description: `${admin.username} · School ${admin.schoolId}`,
            route: `/platform/admins?focus=${admin.id}`
        };
    }

    toSearchHitTeacher(teacher: UserResponse): SearchHit {
        return {
            id: `teacher-${teacher.id}`,
            label: teacher.displayName,
            type: 'Teacher',
            description: `${teacher.username} · ${teacher.role}`,
            route: `/admin/teachers?schoolId=${teacher.schoolId}&focus=${teacher.id}`
        };
    }

    toSearchHitSubject(subject: SubjectResponse): SearchHit {
        return {
            id: `subject-${subject.id}`,
            label: subject.name,
            type: 'Subject',
            description: `${subject.gradeLevel} · School ${subject.schoolId}`,
            route: `/admin/subjects?schoolId=${subject.schoolId}&focus=${subject.id}`
        };
    }

    toSearchHitAssignment(assignment: TeacherAssignmentResponse): SearchHit {
        return {
            id: `assignment-${assignment.id}`,
            label: `${assignment.teacherName} · ${assignment.subjectName}`,
            type: 'Assignment',
            description: `${assignment.class} · ${assignment.gradeLevel}`,
            route: `/admin/assignments?schoolId=${assignment.schoolId}&focus=${assignment.id}`
        };
    }

    toSearchHitNotification(notification: NotificationResponse): SearchHit {
        return {
            id: `notification-${notification.id}`,
            label: notification.title,
            type: 'Notification',
            description: notification.type,
            route: `/admin/notifications?focus=${notification.id}`
        };
    }

    toSearchHitLibraryBook(book: LibraryBookResponse): SearchHit {
        return {
            id: `library-book-${book.id}`,
            label: book.title,
            type: 'Book',
            description: `${book.author} · ${book.availableCopies}/${book.totalCopies} available`,
            route: `/library/books?schoolId=${book.schoolId}&focus=${book.id}`
        };
    }

    toSearchHitLibraryLoan(loan: LibraryLoanResponse): SearchHit {
        return {
            id: `library-loan-${loan.id}`,
            label: loan.bookTitle,
            type: 'Loan',
            description: `${loan.borrowerDisplayName} · Due ${loan.dueAt}`,
            route: `/library/loans?schoolId=${loan.schoolId}&focus=${loan.id}`
        };
    }

    toSearchHitLibraryAdmin(admin: UserResponse): SearchHit {
        return {
            id: `library-admin-${admin.id}`,
            label: admin.displayName,
            type: 'LibraryAdmin',
            description: `${admin.username} · ${admin.role}`,
            route: `/library/users?schoolId=${admin.schoolId}&focus=${admin.id}`
        };
    }
}
