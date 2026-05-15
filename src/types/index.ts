/**
 * =============================================================
 * SIMETA CMS — Type Definitions v2
 * =============================================================
 */

// ─── Auth Types ─── //

export interface JWTPayload {
    sub: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: { id: string; name: string; email: string; role: UserRole };
}

export interface LoginRequest {
    email: string;
    password: string;
    deviceId: string;
}

export interface RegisterAsRequest {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    nim?: string;
    gender?: Gender;
    jurusanId?: string;
    prodiId?: string;
    kelasId?: string;
    kategoriId?: string;
}

// ─── User Types ─── //

export type UserRole = 'ADMIN' | 'PANITIA' | 'DOSEN' | 'MENTOR' | 'MENTEE' | 'PESERTA';

export type Gender = 'LAKI_LAKI' | 'PEREMPUAN';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    deviceId: string | null;
    leaveQuota: number;
    createdAt: string;
    updatedAt?: string;
    nim?: string;
    gender?: Gender;
    jurusan?: { id: string; name: string };
    prodi?: { id: string; name: string };
    kelas?: { id: string; name: string };
    kategori?: { id: string; name: string };
}

export interface BulkCreateUserItem {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    nim?: string;
    kelas?: string;
    prodi?: string;
    jurusan?: string;
    gender?: Gender;
}

export interface BulkCreateUserRequest {
    users: BulkCreateUserItem[];
}

export interface BulkCreateResult {
    success: number;
    failed: number;
    errors: Array<{ email: string; message: string }>;
}

// ─── Reference Data Types ─── //

export interface Jurusan {
    id: string;
    name: string;
    _count?: { prodis: number };
}

export interface Prodi {
    id: string;
    name: string;
    jurusanId: string;
    jurusan?: { id: string; name: string };
    _count?: { kelas: number };
}

export interface Kelas {
    id: string;
    name: string;
    prodiId: string;
    prodi?: { id: string; name: string };
    _count?: { members: number };
}

export interface Kategori {
    id: string;
    name: string;
}

export interface DosenKelas {
    id: string;
    dosenId: string;
    kelasId: string;
    dosen?: { id: string; name: string; email: string };
    kelas?: Kelas & { prodi?: Prodi };
}

export interface AssignDosenKelasRequest {
    dosenId: string;
    kelasId: string;
}

// ─── METAGAMA — Academic Year / Semester / Enrollment ─── //

export type SemesterTerm = 'GANJIL' | 'GENAP' | 'PENDEK';

export type EnrollmentMahasiswaType = 'REGULAR' | 'MENTOR' | 'MENTEE';

export interface AcademicYear {
    id: string;
    code: string;        // "2026/2027"
    name: string;
    startDate: string;
    endDate: string;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
    semesters?: SemesterSummary[];
    _count?: { semesters: number };
}

export interface SemesterSummary {
    id: string;
    code: string;
    term: SemesterTerm;
    isActive: boolean;
    startDate: string;
    endDate: string;
}

export interface Semester {
    id: string;
    academicYearId: string;
    code: string;        // "2026-2027-GANJIL"
    name: string;
    term: SemesterTerm;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
    academicYear?: { id: string; code: string; name: string };
    _count?: {
        enrollments?: number;
        attendanceSessions?: number;
        quizzes?: number;
        bamSessions?: number;
        mentoringGroups?: number;
        accessWindows?: number;
        gradingRules?: number;
    };
}

export interface CreateAcademicYearRequest {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
}

export interface CreateSemesterRequest {
    academicYearId: string;
    code: string;
    name: string;
    term: SemesterTerm;
    startDate: string;
    endDate: string;
    isActive?: boolean;
}

export interface Enrollment {
    id: string;
    userId: string;
    semesterId: string;
    mahasiswaType: EnrollmentMahasiswaType;
    kelasId: string | null;
    kategoriId: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string; nim: string | null };
    semester?: Semester;
}

export interface CreateEnrollmentRequest {
    userId: string;
    semesterId: string;
    mahasiswaType?: EnrollmentMahasiswaType;
    kelasId?: string;
    kategoriId?: string;
    notes?: string;
}

export interface UpdateEnrollmentRequest {
    mahasiswaType?: EnrollmentMahasiswaType;
    kelasId?: string;
    kategoriId?: string;
    isActive?: boolean;
    notes?: string;
}

export interface BulkEnrollmentItem {
    userId: string;
    mahasiswaType?: EnrollmentMahasiswaType;
    kelasId?: string;
    kategoriId?: string;
}

export interface BulkEnrollRequest {
    semesterId: string;
    items: BulkEnrollmentItem[];
}

export interface BulkEnrollResult {
    created: number;
    skipped: number;
    invalid: { userId: string; reason: string }[];
    total: number;
}

export interface CopyFromSemesterRequest {
    sourceSemesterId: string;
    targetSemesterId: string;
    onlyActive?: boolean;
}

export interface CopyFromSemesterResult {
    copiedFrom: string;
    copiedTo: string;
    created: number;
    skipped: number;
    sourceTotal: number;
}

// ─── Attendance Types ─── //

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'PERMIT' | 'ABSENT';

export interface AttendanceSession {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    _count?: { records: number };
}

export interface AttendanceRecord {
    id: string;
    userId: string;
    sessionId: string;
    checkInTime: string;
    checkOutTime?: string | null;
    status: AttendanceStatus;
    latitude: number | null;
    longitude: number | null;
}

export interface AttendanceRecordDetail {
    id: string;
    userId: string;
    sessionId: string;
    checkInTime: string | null;
    checkOutTime?: string | null;
    status: AttendanceStatus;
    user?: { id: string; name: string; email: string; role: UserRole };
}

export interface AttendanceSessionDetail extends AttendanceSession {
    records: AttendanceRecordDetail[];
}

export interface CreateSessionRequest {
    title: string;
    startTime: string;
    endTime: string;
}

// ─── Mentoring Types ─── //

export type MentoringCategory = 'MUALLAM_1' | 'MUALLAM_2' | 'MUALLAM_3';

export interface MentoringGroup {
    id: string;
    name: string;
    mentorId: string;
    category: MentoringCategory;
    createdAt: string;
    mentor?: { id: string; name: string; email: string };
    members: MentoringMember[];
    _count?: { reports: number };
}

export interface MentoringMember {
    id: string;
    groupId: string;
    menteeId: string;
    mentee: {
        id: string;
        name: string;
        email: string;
    };
}

export interface CreateMentoringGroupRequest {
    name: string;
    mentorId: string;
    category: MentoringCategory;
}

export interface UpdateMentoringGroupRequest {
    name?: string;
    mentorId?: string;
    category?: MentoringCategory;
}

export interface AutoGenerateGroupRequest {
    category: MentoringCategory;
    groupSize: number;
    mentorIds?: string[];
    menteeIds?: string[];
    namePrefix?: string;
    respectGender?: boolean;
    respectKategori?: boolean;
}

export interface AutoGenerateGroupResult {
    category: MentoringCategory;
    groupsCreated: number;
    menteesDistributed: number;
    groups: Array<{ id: string; name: string; mentorId: string; memberCount: number }>;
}

export interface MemorizationRecord {
    studentId: string;
    surahName: string;
    ayatStart: number;
    ayatEnd: number;
    fluency: number;
}

export interface CreateMentoringReportRequest {
    groupId: string;
    date: string;
    notes?: string;
    memorizationRecords: MemorizationRecord[];
}

// ─── BAM Types ─── //

export type BAMStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BAMSession {
    id: string;
    mentorId: string;
    groupId: string;
    date: string;
    topic: string;
    notes?: string;
    status: BAMStatus;
    createdAt: string;
    mentor?: { id: string; name: string; email: string };
    group?: { id: string; name: string };
}

export interface MentorScore {
    mentorId: string;
    mentor: { id: string; name: string; email: string };
    totalSessions: number;
    approvedSessions: number;
    score: number;
}

// ─── Quiz Types ─── //

export type QuizType = 'PRETEST' | 'POSTTEST';

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'ESSAY' | 'SHORT_ANSWER';

export interface QuizQuestion {
    id?: string;
    type: QuestionType;
    text: string;
    imageUrl?: string;
    options: string[];
    optionImages?: (string | null)[];
    correctIdx: number;
}

export interface Quiz {
    id: string;
    title: string;
    type: QuizType;
    questions?: QuizQuestion[];
    _count?: { questions: number; results: number };
    hasEssay?: boolean;
}

export interface CreateQuizRequest {
    title: string;
    type: QuizType;
    questions: Omit<QuizQuestion, 'id'>[];
}

export interface QuizAnswer {
    questionId: string;
    selectedIdx?: number;
    essayAnswer?: string;
}

export interface QuizResult {
    id: string;
    userId: string;
    quizId: string;
    score: number;
    status?: 'GRADED' | 'PENDING_REVIEW';
    submittedAt: string;
    user?: { id: string; name: string; email: string };
    quiz?: { id: string; title: string; type: QuizType };
}

export interface EssaySubmission {
    id: string;
    userId: string;
    quizId: string;
    questionId: string;
    answer: string;
    score?: number | null;
    gradedBy?: string | null;
    gradedAt?: string | null;
    user?: { id: string; name: string; email: string };
    question?: { id: string; text: string; type: QuestionType };
}

// ─── Permission Types ─── //

export type PermissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Permission {
    id: string;
    userId: string;
    sessionId?: string;
    reason: string;
    proofUrl?: string;
    status: PermissionStatus;
    createdAt: string;
    updatedAt?: string;
    user?: { id: string; name: string; email: string; role: UserRole };
    session?: { id: string; title: string; startTime: string };
}

export interface CreatePermissionRequest {
    reason: string;
    sessionId?: string;
    proofUrl?: string;
}

// ─── Resume Types ─── //

export interface ResumeSession {
    id: string;
    title: string;
    description?: string;
    openAt: string;
    closeAt: string;
    isOpen?: boolean;
    createdAt: string;
    _count?: { resumes: number };
}

export interface CreateResumeSessionRequest {
    title: string;
    description?: string;
    openAt: string;
    closeAt: string;
}

export interface Resume {
    id: string;
    userId: string;
    sessionId?: string;
    content: string;
    fileUrl?: string;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string; role: UserRole };
    session?: { id: string; title: string; closeAt: string };
}

export interface CreateResumeRequest {
    content: string;
    fileUrl?: string;
    sessionId?: string;
}

// ─── News Types ─── //

export interface News {
    id: string;
    title: string;
    content: string;
    imageUrl?: string;
    authorId: string;
    publishedAt: string;
    updatedAt?: string;
    author?: { id: string; name: string; role: UserRole };
}

export interface CreateNewsRequest {
    title: string;
    content: string;
    imageUrl?: string;
}

// ─── Notification Types ─── //

export type NotificationType = 'NEWS' | 'ATTENDANCE' | 'QUIZ' | 'PERMISSION' | 'SYSTEM';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    referenceId?: string;
    isRead: boolean;
    createdAt: string;
}

// ─── Grading Types ─── //

export interface GradingComposition {
    id?: string;
    attendance: number;
    pretest: number;
    posttest: number;
    resume: number;
    memorization: number;
    isDefault?: boolean;
    updatedBy?: string;
    updater?: { id: string; name: string };
    createdAt?: string;
    updatedAt?: string;
}

export interface SetGradingCompositionRequest {
    attendance: number;
    pretest: number;
    posttest: number;
    resume: number;
    memorization: number;
}

// ─── Access Window Types ─── //

export type AccessWindowFeature = 'QUIZ' | 'BAM' | 'ABSENSI';

export interface AccessWindow {
    id: string;
    feature: AccessWindowFeature;
    openAt: string;
    closeAt: string;
    isOpen: boolean;
}

export interface CreateAccessWindowRequest {
    feature: AccessWindowFeature;
    openAt: string;
    closeAt: string;
}

// ─── IAM Types ─── //

export interface IamPermission {
    id: string;
    name: string;
    description?: string;
}

export interface RolePermission {
    role: UserRole;
    permissions: IamPermission[];
}

// ─── Dashboard / Grades Types ─── //

export interface GradeBreakdown {
    attendance?: { score: number; weight: number; detail: string };
    pretest?: { score: number; weight: number; detail: string };
    posttest?: { score: number; weight: number; detail: string };
    resume?: { score: number; weight: number; detail: string };
    memorization?: { score: number; weight: number; detail: string };
}

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface StudentGrade {
    student?: { id: string; name: string; email: string };
    breakdown: GradeBreakdown;
    finalScore: number;
    letterGrade: LetterGrade;
}

export interface MyGrade {
    breakdown: GradeBreakdown;
    finalScore: number;
    letterGrade: LetterGrade;
}

// ─── API Response Types ─── //

export interface MessageResponse {
    message: string;
    count?: number;
}

export interface UnreadCountResponse {
    unreadCount: number;
}

// ─── Export Types ─── //

export type ExportType = 'attendance' | 'grades' | 'all';
