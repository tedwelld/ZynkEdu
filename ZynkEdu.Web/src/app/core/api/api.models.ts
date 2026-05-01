export type WorkspaceRole = 'PlatformAdmin' | 'Admin' | 'Teacher' | 'LibraryAdmin' | 'AccountantSuper' | 'AccountantSenior' | 'AccountantJunior';
export type NotificationAudience = 'All' | 'Individual' | 'Class' | 'Teachers' | 'Admins' | 'PlatformAdmins' | 'Guardians';

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

export interface GradingBandResponse {
    grade: string;
    minScore: number;
    maxScore: number;
}

export interface GradingLevelResponse {
    level: string;
    bands: GradingBandResponse[];
}

export interface GradingSchemeResponse {
    schoolId: number;
    schoolName: string;
    levels: GradingLevelResponse[];
}

export interface SaveGradingBandRequest {
    level: string;
    grade: string;
    minScore: number;
    maxScore: number;
}

export interface SaveGradingSchemeRequest {
    bands: SaveGradingBandRequest[];
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
    profileKey: string;
    studentNumber: string;
    fullName: string;
    class: string;
    level: string;
    status: string;
    enrollmentYear: number;
    subjectIds: number[];
    subjects: string[];
    guardians: GuardianResponse[];
    parentEmail: string;
    parentPhone: string;
    createdAt: string;
}

export interface StudentMovementRequest {
    studentId: number;
    action: string;
    targetSchoolId?: number | null;
    targetClass?: string | null;
    targetLevel?: string | null;
    reason?: string | null;
    notes?: string | null;
    effectiveDate: string;
    copySubjects?: boolean;
}

export interface StudentMovementResponse {
    movementId: number;
    schoolId: number;
    sourceStudentId: number;
    destinationStudentId?: number | null;
    profileKey: string;
    action: string;
    sourceClass: string;
    sourceLevel: string;
    destinationClass?: string | null;
    destinationLevel?: string | null;
    sourceSchoolId?: number | null;
    destinationSchoolId?: number | null;
    reason?: string | null;
    notes?: string | null;
    effectiveDate: string;
    createdAt: string;
}

export interface StudentPromotionRunRequest {
    academicYearLabel: string;
    notes?: string | null;
    items: StudentMovementRequest[];
}

export interface StudentPromotionRunResponse {
    runId: number;
    schoolId: number;
    academicYearLabel: string;
    status: string;
    notes?: string | null;
    createdAt: string;
    committedAt?: string | null;
    movements: StudentMovementResponse[];
}

export interface GuardianRequest {
    displayName: string;
    relationship: string;
    phone: string;
    email: string;
    address?: string | null;
    identityDocumentType?: string | null;
    identityDocumentNumber?: string | null;
    birthCertificateNumber?: string | null;
    isPrimary: boolean;
}

export interface GuardianResponse {
    id: number;
    studentId: number;
    displayName: string;
    relationship: string;
    phone: string;
    email: string;
    address?: string | null;
    identityDocumentType?: string | null;
    identityDocumentNumber?: string | null;
    birthCertificateNumber?: string | null;
    isPrimary: boolean;
    isActive: boolean;
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
    isPractical: boolean;
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
    isPractical: boolean;
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
    contactEmail?: string | null;
    role: string;
    schoolId: number;
    createdAt: string;
    isActive: boolean;
}

export interface CreateAccountantRequest {
    username: string;
    password: string;
    role: 'AccountantSuper' | 'AccountantSenior' | 'AccountantJunior';
    displayName?: string | null;
    contactEmail?: string | null;
}

export interface FeeStructureRequest {
    gradeLevel: string;
    term: string;
    amount: number;
    description?: string | null;
}

export interface FeeStructureResponse {
    id: number;
    schoolId: number;
    gradeLevel: string;
    term: string;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInvoiceRequest {
    studentId: number;
    term: string;
    totalAmount: number;
    dueAt: string;
    reference?: string | null;
    description?: string | null;
}

export interface CreatePaymentRequest {
    studentId: number;
    amount: number;
    method: 'Cash' | 'Bank' | 'MobileMoney';
    reference?: string | null;
    receivedAt?: string | null;
    description?: string | null;
}

export interface CreateAdjustmentRequest {
    studentId: number;
    amount: number;
    reference?: string | null;
    description?: string | null;
    transactionDate?: string | null;
}

export interface CreateRefundRequest {
    studentId: number;
    amount: number;
    reference?: string | null;
    description?: string | null;
    transactionDate?: string | null;
}

export interface AccountingTransactionResponse {
    id: number;
    schoolId: number;
    studentId: number;
    studentAccountId: number;
    type: 'Invoice' | 'Payment' | 'Adjustment' | 'Discount' | 'Refund';
    status: 'Pending' | 'Approved';
    amount: number;
    transactionDate: string;
    reference?: string | null;
    description?: string | null;
    createdByUserId: number;
    approvedByUserId?: number | null;
    createdAt: string;
    approvedAt?: string | null;
}

export interface StatementLineResponse {
    transactionId: number;
    type: 'Invoice' | 'Payment' | 'Adjustment' | 'Discount' | 'Refund';
    status: 'Pending' | 'Approved';
    amount: number;
    transactionDate: string;
    reference?: string | null;
    description?: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
}

export interface StudentStatementResponse {
    studentId: number;
    studentName: string;
    schoolId: number;
    currency: string;
    openingBalance: number;
    closingBalance: number;
    transactions: StatementLineResponse[];
}

export interface CollectionReportResponse {
    schoolId: number;
    totalBilled: number;
    totalCollected: number;
    outstanding: number;
    invoiceCount: number;
    paymentCount: number;
}

export interface AgingBucketResponse {
    bucket: string;
    amount: number;
    invoiceCount: number;
}

export interface AgingReportResponse {
    schoolId: number;
    asOf: string;
    buckets: AgingBucketResponse[];
}

export interface DailyCashMethodResponse {
    method: 'Cash' | 'Bank' | 'MobileMoney';
    amount: number;
    paymentCount: number;
}

export interface DailyCashReportResponse {
    schoolId: number;
    date: string;
    totalAmount: number;
    methods: DailyCashMethodResponse[];
}

export interface RevenueByClassResponse {
    className: string;
    gradeLevel: string;
    billed: number;
    collected: number;
    outstanding: number;
}

export interface RevenueByClassReportResponse {
    schoolId: number;
    classes: RevenueByClassResponse[];
}

export interface DefaulterResponse {
    studentId: number;
    studentName: string;
    className: string;
    gradeLevel: string;
    balance: number;
    lastPaymentAt?: string | null;
    lastInvoiceAt?: string | null;
}

export interface DefaulterReportResponse {
    schoolId: number;
    students: DefaulterResponse[];
}

export interface LibraryDashboardResponse {
    schoolId: number;
    bookCount: number;
    copyCount: number;
    issuedLoanCount: number;
    overdueLoanCount: number;
    borrowerCount: number;
}

export interface CreateLibraryBookRequest {
    title: string;
    author: string;
    isbn?: string | null;
    accessionNumber?: string | null;
    publisher?: string | null;
    category?: string | null;
    subject?: string | null;
    genre?: string | null;
    edition?: string | null;
    publicationYear?: number | null;
    shelfLocation?: string | null;
    condition?: string | null;
    initialCopies: number;
    isActive: boolean;
}

export interface UpdateLibraryBookRequest {
    title: string;
    author: string;
    isbn?: string | null;
    accessionNumber?: string | null;
    publisher?: string | null;
    category?: string | null;
    subject?: string | null;
    genre?: string | null;
    edition?: string | null;
    publicationYear?: number | null;
    shelfLocation?: string | null;
    condition?: string | null;
    isActive: boolean;
}

export interface LibraryBookResponse {
    id: number;
    schoolId: number;
    title: string;
    author: string;
    isbn?: string | null;
    accessionNumber?: string | null;
    publisher?: string | null;
    category?: string | null;
    subject?: string | null;
    genre?: string | null;
    edition?: string | null;
    publicationYear?: number | null;
    shelfLocation?: string | null;
    condition?: string | null;
    totalCopies: number;
    availableCopies: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateLibraryBookCopyRequest {
    accessionNumber?: string | null;
    shelfLocation?: string | null;
    condition?: string | null;
    isActive: boolean;
}

export interface UpdateLibraryBookCopyRequest {
    accessionNumber?: string | null;
    shelfLocation?: string | null;
    condition?: string | null;
    isActive: boolean;
}

export interface LibraryBookCopyResponse {
    id: number;
    schoolId: number;
    libraryBookId: number;
    libraryBookTitle: string;
    accessionNumber?: string | null;
    shelfLocation?: string | null;
    condition?: string | null;
    status: 'Available' | 'Issued' | 'Lost' | 'Withdrawn';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface IssueLibraryBookRequest {
    borrowerType: 'Student' | 'Teacher';
    borrowerId: number;
    bookCopyId: number;
    dueAt: string;
    notes?: string | null;
}

export interface ReturnLibraryBookRequest {
    notes?: string | null;
}

export interface RenewLibraryLoanRequest {
    dueAt: string;
    notes?: string | null;
}

export interface LibraryLoanResponse {
    id: number;
    schoolId: number;
    libraryBookId?: number | null;
    libraryBookCopyId?: number | null;
    borrowerType: 'Student' | 'Teacher';
    borrowerId?: number | null;
    borrowerDisplayName: string;
    borrowerReference?: string | null;
    issuedByDisplayName: string;
    issuedByUserName: string;
    issuedByRole: string;
    bookTitle: string;
    bookAuthor?: string | null;
    bookIsbn?: string | null;
    copyAccessionNumber?: string | null;
    copyShelfLocation?: string | null;
    copyCondition?: string | null;
    issuedAt: string;
    dueAt: string;
    returnedAt?: string | null;
    returnedByDisplayName?: string | null;
    returnedByUserName?: string | null;
    returnNotes?: string | null;
    isOverdue: boolean;
}

export interface LibraryBorrowerSummaryResponse {
    borrowerType: 'Student' | 'Teacher';
    borrowerId: number;
    displayName: string;
    reference?: string | null;
    activeLoanCount: number;
    overdueLoanCount: number;
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
    contactEmail?: string | null;
}

export interface CreateTeacherWithAssignmentRequest {
    username: string;
    displayName: string;
    password: string;
    subjectIds: number[];
    classes: string[];
    contactEmail?: string | null;
}

export interface UpdateSchoolUserRequest {
    displayName: string;
    password?: string | null;
    isActive: boolean;
    contactEmail?: string | null;
}

export interface CreateSubjectRequest {
    name: string;
    code?: string | null;
    gradeLevel?: string | null;
    weeklyLoad?: number;
    isPractical?: boolean;
}

export interface UpdateSubjectRequest {
    name: string;
    code?: string | null;
    gradeLevel?: string | null;
    weeklyLoad?: number;
    isPractical?: boolean;
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
    guardians: GuardianRequest[];
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
    staffIds?: number[] | null;
}

export interface NotificationRecipientResponse {
    studentId?: number | null;
    recipientName: string;
    destination: string;
    status: string;
    attempts: number;
    lastError?: string | null;
    recipientType: string;
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
    guardianEmails: string[];
    guardianPhones: string[];
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
    type: 'Student' | 'Teacher' | 'Subject' | 'Assignment' | 'Notification' | 'School' | 'Admin' | 'Page' | 'Result' | 'Book' | 'Loan' | 'Copy' | 'LibraryAdmin';
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
