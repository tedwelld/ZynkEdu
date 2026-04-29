export type WorkspaceRole = 'PlatformAdmin' | 'Admin' | 'Teacher' | 'Parent';
export type NotificationAudience = 'All' | 'Individual' | 'Class';

export interface SchoolResponse {
    id: number;
    schoolCode: string;
    name: string;
    address: string;
    adminContactEmail?: string | null;
    createdAt: string;
}

export interface CreateSchoolRequest {
    name: string;
    address: string;
    adminContactEmail: string;
}

export interface CreateSchoolWithAdminRequest {
    name: string;
    address: string;
    adminContactEmail: string;
    adminUsername: string;
    adminDisplayName: string;
    adminPassword: string;
    adminIsActive: boolean;
}

export interface UpdateSchoolRequest {
    name: string;
    address: string;
    adminContactEmail: string;
}

export interface LoginRequest {
    username: string;
    password: string;
    schoolName?: string | null;
}

export interface LoginResponse {
    accessToken: string;
    role: WorkspaceRole;
    schoolId?: number | null;
    userId?: number | null;
    displayName: string;
}

export interface ParentOtpRequest {
    phone?: string | null;
    email?: string | null;
}

export interface ParentOtpResponse {
    challengeId: number;
    destination: string;
    expiresAt: string;
}

export interface VerifyParentOtpRequest {
    challengeId: number;
    code: string;
}

export interface DashboardResponse {
    overallAverageScore: number;
    passRate: number;
    subjectPerformance: SubjectPerformanceDto[];
    classPerformance: ClassPerformanceDto[];
    topStudents: StudentRankingDto[];
    bottomStudents: StudentRankingDto[];
    teacherPerformance: TeacherPerformanceDto[];
    schoolPerformance: SchoolPerformanceDto[];
}

export interface SubjectPerformanceDto {
    subject: string;
    averageScore: number;
}

export interface ClassPerformanceDto {
    class: string;
    averageScore: number;
    passRate: number;
}

export interface StudentRankingDto {
    studentId: number;
    studentNumber: string;
    studentName: string;
    averageScore: number;
}

export interface TeacherPerformanceDto {
    teacherId: number;
    teacherName: string;
    subject: string;
    class: string;
    averageScore: number;
}

export interface SchoolPerformanceDto {
    schoolId: number;
    schoolName: string;
    averageScore: number;
    passRate: number;
    resultCount: number;
}

export interface AuditLogResponse {
    id: number;
    schoolId?: number | null;
    actorUserId?: number | null;
    actorRole: string;
    actorName: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    createdAt: string;
}

export interface StudentResponse {
    id: number;
    schoolId: number;
    studentNumber: string;
    fullName: string;
    class: string;
    level: string;
    status: string;
    enrollmentYear: number;
    subjectIds: number[];
    subjects: string[];
    parentEmail: string;
    parentPhone: string;
    createdAt: string;
}

export interface BulkStudentSubjectEnrollmentResponse {
    schoolCount: number;
    studentCount: number;
    subjectCount: number;
    enrollmentCount: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceClassOptionResponse {
    className: string;
    teacherNames: string[];
    subjectNames: string[];
    level: string;
    studentCount: number;
}

export interface AttendanceStudentRegisterResponse {
    studentId: number;
    studentNumber: string;
    studentName: string;
    level: string;
    status: AttendanceStatus;
    note?: string | null;
}

export interface AttendanceRegisterResponse {
    registerId?: number | null;
    schoolId: number;
    schoolName: string;
    teacherId: number;
    teacherName: string;
    className: string;
    attendanceDate: string;
    termName: string;
    isLocked: boolean;
    dispatchedAt?: string | null;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    students: AttendanceStudentRegisterResponse[];
}

export interface AttendanceDailySummaryResponse {
    registerId: number;
    schoolId: number;
    schoolName: string;
    className: string;
    teacherName: string;
    termName: string;
    attendanceDate: string;
    studentCount: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    isLocked: boolean;
    dispatchedAt?: string | null;
}

export interface SaveAttendanceRegisterEntryRequest {
    studentId: number;
    status: AttendanceStatus;
    note?: string | null;
}

export interface SaveAttendanceRegisterRequest {
    attendanceDate: string;
    className: string;
    students: SaveAttendanceRegisterEntryRequest[];
}

export interface StudentCommentResponse {
    resultId: number;
    subjectId: number;
    subjectName: string;
    score: number;
    grade: string;
    term: string;
    comment?: string | null;
    createdAt: string;
}

export interface ParentReportSubjectResponse {
    subjectId: number;
    subjectName: string;
    averageMark: number;
    actualMark?: number | null;
    grade?: string | null;
    teacherName?: string | null;
    teacherComment?: string | null;
    term?: string | null;
    createdAt?: string | null;
}

export interface ParentPreviewReportResponse {
    studentId: number;
    studentName: string;
    studentNumber: string;
    class: string;
    level: string;
    enrollmentYear: number;
    schoolName: string;
    overallAverageMark: number;
    subjects: ParentReportSubjectResponse[];
}

export interface SubjectResponse {
    id: number;
    schoolId: number;
    code: string;
    name: string;
    gradeLevel: string;
    weeklyLoad: number;
}

export interface SchoolClassResponse {
    id: number;
    schoolId: number;
    className: string;
    gradeLevel: string;
    isActive: boolean;
    isReadyForTeaching: boolean;
    subjectIds: number[];
    subjectNames: string[];
    createdAt: string;
}

export interface PlatformSubjectCatalogResponse {
    id: number;
    code: string;
    name: string;
    gradeLevel: string;
    weeklyLoad: number;
    sourceSchoolId?: number | null;
    sourceSchoolName?: string | null;
}

export interface ImportSchoolSubjectsRequest {
    sourceSchoolId: number;
    subjectIds: number[];
}

export interface ImportSubjectsResultResponse {
    importedCount: number;
    skippedCount: number;
}

export interface TeacherAssignmentResponse {
    id: number;
    schoolId: number;
    teacherId: number;
    teacherName: string;
    subjectId: number;
    subjectName: string;
    gradeLevel: string;
    class: string;
}

export interface UserResponse {
    id: number;
    username: string;
    displayName: string;
    role: string;
    schoolId: number;
    createdAt: string;
    isActive: boolean;
}

export interface ResultResponse {
    id: number;
    schoolId: number;
    studentId: number;
    studentName: string;
    studentNumber: string;
    studentClass: string;
    subjectId: number;
    subjectName: string;
    teacherId: number;
    teacherName: string;
    score: number;
    grade: string;
    term: string;
    comment?: string | null;
    approvalStatus: string;
    isLocked: boolean;
    createdAt: string;
    resultYear: number;
}

export interface ResultFilterPeriod {
    kind: 'term' | 'date-range' | 'month' | 'week' | 'day';
    label: string;
    startDate?: string | null;
    endDate?: string | null;
    termId?: number | null;
}

export interface CreateResultRequest {
    studentId: number;
    subjectId: number;
    score: number;
    term: string;
    comment?: string | null;
}

export interface CreateSchoolUserRequest {
    username: string;
    displayName: string;
    password: string;
}

export interface CreateTeacherWithAssignmentRequest {
    username: string;
    displayName: string;
    password: string;
    subjectIds: number[];
    classes: string[];
}

export interface UpdateSchoolUserRequest {
    displayName: string;
    password?: string | null;
    isActive: boolean;
}

export interface CreateSubjectRequest {
    name: string;
    code?: string | null;
    gradeLevel?: string | null;
    weeklyLoad?: number;
}

export interface UpdateSubjectRequest {
    name: string;
    code?: string | null;
    gradeLevel?: string | null;
    weeklyLoad?: number;
}

export interface CreateSchoolClassRequest {
    className: string;
    gradeLevel: string;
}

export interface UpdateSchoolClassRequest {
    className: string;
    gradeLevel: string;
    isActive: boolean;
}

export interface AssignClassSubjectsRequest {
    subjectIds: number[];
}

export interface CreateStudentRequest {
    fullName: string;
    class: string;
    level: string;
    enrollmentYear: number;
    subjectIds: number[];
    parentEmail: string;
    parentPhone: string;
}

export interface UpdateStudentRequest extends CreateStudentRequest {}

export interface UpdateStudentStatusRequest {
    status: string;
}

export interface CreateTeacherAssignmentRequest {
    teacherId: number;
    subjectId: number;
    class: string;
}

export interface CreateTeacherAssignmentsBatchRequest {
    teacherId: number;
    subjectIds: number[];
    classes: string[];
}

export interface TeacherAssignmentBatchResponse {
    schoolId: number;
    teacherId: number;
    teacherName: string;
    requestedCount: number;
    createdCount: number;
    skippedCount: number;
    assignments: TeacherAssignmentResponse[];
}

export interface UpdateTeacherAssignmentRequest extends CreateTeacherAssignmentRequest {}

export interface SendNotificationRequest {
    title: string;
    message: string;
    type: 'Email' | 'Sms' | 'Push' | string;
    studentIds?: number[] | null;
    audience?: NotificationAudience;
    schoolId?: number | null;
    className?: string | null;
}

export interface NotificationRecipientResponse {
    studentId: number;
    studentName: string;
    destination: string;
    status: string;
    attempts: number;
    lastError?: string | null;
}

export interface NotificationResponse {
    id: number;
    schoolId: number;
    title: string;
    message: string;
    type: string;
    createdBy: number;
    createdAt: string;
    recipients: NotificationRecipientResponse[];
}

export interface SendResultSlipRequest {
    sendEmail: boolean;
    sendSms: boolean;
}

export interface ResultSlipSendResponse {
    studentId: number;
    studentName: string;
    parentEmail: string;
    parentPhone: string;
    emailSent: boolean;
    smsSent: boolean;
}

export interface TimetableResponse {
    id: number;
    schoolId: number;
    teacherId: number;
    teacherName: string;
    subjectId: number;
    subjectName: string;
    class: string;
    gradeLevel: string;
    term: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export interface GenerateTimetableRequest {
    term: string;
}

export interface PublishTimetableRequest {
    term: string;
}

export interface UpsertTimetableSlotRequest {
    teacherId: number;
    subjectId: number;
    class: string;
    term: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
}

export interface TimetablePublicationResponse {
    schoolId: number;
    term: string;
    publishedAt: string;
    dispatchedAt?: string | null;
}

export interface AcademicTermResponse {
    id: number;
    schoolId: number;
    termNumber: number;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    createdAt: string;
}

export interface UpsertAcademicTermRequest {
    name: string;
    startDate?: string | null;
    endDate?: string | null;
}

export interface SchoolCalendarEventResponse {
    id: number;
    schoolId: number;
    academicTermId: number;
    termName: string;
    title: string;
    description?: string | null;
    eventDate: string;
    createdAt: string;
}

export interface CreateSchoolCalendarEventRequest {
    academicTermId: number;
    title: string;
    description?: string | null;
    eventDate: string;
}

export interface SearchHit {
    id: string;
    label: string;
    type: 'Student' | 'Teacher' | 'Subject' | 'Assignment' | 'Notification' | 'School' | 'Admin' | 'Page' | 'Result';
    description: string;
    route: string;
}

export interface AuthSession {
    accessToken: string;
    role: WorkspaceRole;
    schoolId?: number | null;
    userId?: number | null;
    displayName: string;
    expiresAt?: number | null;
}
