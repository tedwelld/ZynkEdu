import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
    AcademicTermResponse,
    AttendanceClassOptionResponse,
    AttendanceDailySummaryResponse,
    AttendanceRegisterResponse,
    ClassPerformanceDto,
    CreateResultRequest,
    CreateSchoolRequest,
    CreateSchoolWithAdminRequest,
    CreateSchoolCalendarEventRequest,
    CreateSchoolUserRequest,
    CreateTeacherWithAssignmentRequest,
    CreateStudentRequest,
    CreateTeacherAssignmentRequest,
    DashboardResponse,
    LoginRequest,
    LoginResponse,
    NotificationResponse,
    ParentOtpRequest,
    ParentOtpResponse,
    ParentPreviewReportResponse,
    ResultResponse,
    TimetableResponse,
    SchoolResponse,
    SchoolCalendarEventResponse,
    SearchHit,
    SendNotificationRequest,
    SaveAttendanceRegisterRequest,
    StudentCommentResponse,
    StudentResponse,
    CreateSubjectRequest,
    SubjectResponse,
    TeacherAssignmentResponse,
    UpdateSchoolRequest,
    UpdateSchoolUserRequest,
    UpdateSubjectRequest,
    UpdateStudentRequest,
    UpdateTeacherAssignmentRequest,
    UpsertAcademicTermRequest,
    UserResponse,
    VerifyParentOtpRequest
} from './api.models';
import { API_BASE_URL } from './api.constants';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);

    login(request: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, request);
    }

    requestParentOtp(request: ParentOtpRequest): Observable<ParentOtpResponse> {
        return this.http.post<ParentOtpResponse>(`${API_BASE_URL}/auth/parent-otp`, request);
    }

    verifyParentOtp(request: VerifyParentOtpRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/verify-otp`, request);
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

    getStudents(classFilter?: string, schoolId?: number | null): Observable<StudentResponse[]> {
        const params = new URLSearchParams();
        if (classFilter) {
            params.set('classFilter', classFilter);
        }
        if (schoolId) {
            params.set('schoolId', String(schoolId));
        }
        const suffix = params.toString() ? `?${params.toString()}` : '';
        return this.http.get<StudentResponse[]>(`${API_BASE_URL}/students${suffix}`);
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

    deleteStudent(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/students/${id}`);
    }

    getSubjects(schoolId?: number | null): Observable<SubjectResponse[]> {
        const query = schoolId ? `?schoolId=${schoolId}` : '';
        return this.http.get<SubjectResponse[]>(`${API_BASE_URL}/subjects${query}`);
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

    getNotifications(): Observable<NotificationResponse[]> {
        return this.http.get<NotificationResponse[]>(`${API_BASE_URL}/notifications`);
    }

    getTeacherTimetable(term?: string): Observable<TimetableResponse[]> {
        const query = term ? `?term=${encodeURIComponent(term)}` : '';
        return this.http.get<TimetableResponse[]>(`${API_BASE_URL}/timetables/me${query}`);
    }

    generateTimetable(term: string): Observable<TimetableResponse[]> {
        return this.http.post<TimetableResponse[]>(`${API_BASE_URL}/timetables/generate`, { term });
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
            route: `/admin/students?focus=${student.id}`
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
            route: `/admin/teachers?focus=${teacher.id}`
        };
    }

    toSearchHitSubject(subject: SubjectResponse): SearchHit {
        return {
            id: `subject-${subject.id}`,
            label: subject.name,
            type: 'Subject',
            description: `School ${subject.schoolId}`,
            route: `/admin/subjects?focus=${subject.id}`
        };
    }

    toSearchHitAssignment(assignment: TeacherAssignmentResponse): SearchHit {
        return {
            id: `assignment-${assignment.id}`,
            label: `${assignment.teacherName} · ${assignment.subjectName}`,
            type: 'Assignment',
            description: assignment.class,
            route: `/admin/assignments?focus=${assignment.id}`
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
}
