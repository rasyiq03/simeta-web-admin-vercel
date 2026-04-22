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
    message: string;
    access_token: string;
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
}

// ─── User Types ─── //

export type UserRole = 'ADMIN' | 'PANITIA' | 'DOSEN' | 'MENTOR' | 'MENTEE';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    deviceId: string | null;
    leaveQuota: number;
    createdAt: string;
    updatedAt?: string;
}

export interface BulkCreateUserItem {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}

export interface BulkCreateUserRequest {
    users: BulkCreateUserItem[];
}

export interface BulkCreateResult {
    success: number;
    failed: number;
    errors: Array<{ email: string; message: string }>;
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
    status: AttendanceStatus;
    latitude: number | null;
    longitude: number | null;
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

export interface Resume {
    id: string;
    userId: string;
    content: string;
    fileUrl?: string;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string; role: UserRole };
}

export interface CreateResumeRequest {
    content: string;
    fileUrl?: string;
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
