/**
 * =============================================================
 * SIMETA CMS — API Service Layer v2
 * =============================================================
 */

import type {
    LoginRequest,
    LoginResponse,
    User,
    UserRole,
    AttendanceSession,
    AttendanceRecord,
    CreateSessionRequest,
    MentoringGroup,
    MentoringMember,
    MentoringCategory,
    CreateMentoringGroupRequest,
    UpdateMentoringGroupRequest,
    AutoGenerateGroupRequest,
    AutoGenerateGroupResult,
    CreateMentoringReportRequest,
    BAMSession,
    MentorScore,
    Quiz,
    CreateQuizRequest,
    QuizAnswer,
    QuizResult,
    EssaySubmission,
    Permission,
    PermissionStatus,
    CreatePermissionRequest,
    Resume,
    CreateResumeRequest,
    News,
    CreateNewsRequest,
    Notification,
    UnreadCountResponse,
    GradingComposition,
    SetGradingCompositionRequest,
    AccessWindow,
    CreateAccessWindowRequest,
    IamPermission,
    StudentGrade,
    MyGrade,
    MessageResponse,
} from '@/types';

const API_BASE: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('simeta_token');
}

export function getDeviceId(): string {
    if (typeof window === 'undefined') return 'web-browser';
    let deviceId = localStorage.getItem('simeta_device_id');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('simeta_device_id', deviceId);
    }
    return deviceId;
}

async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const contentType = response.headers.get('content-type');
    let raw: { data?: T; message?: string | string[] } | null = null;
    if (contentType && contentType.includes('application/json')) {
        raw = await response.json();
    }

    if (!response.ok) {
        const msg = raw?.message || `Error ${response.status}`;
        throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }

    // Semua response backend dibungkus { data: ... }
    return (raw?.data ?? raw) as T;
}

// =============================================================
// 1. AUTH API
// =============================================================

export const authApi = {
    login: (body: LoginRequest): Promise<LoginResponse> =>
        apiFetch<LoginResponse>(`${API_PREFIX}/auth/login`, { method: 'POST', body: JSON.stringify(body) }),

    register: (body: { name: string; email: string; password: string }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/auth/register`, { method: 'POST', body: JSON.stringify(body) }),
};

// =============================================================
// 2. USERS API
// =============================================================

export const usersApi = {
    getAll: (): Promise<User[]> => apiFetch<User[]>(`${API_PREFIX}/users`),

    getById: (id: string): Promise<User> => apiFetch<User>(`${API_PREFIX}/users/${id}`),

    assignRole: (id: string, role: UserRole): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

    resetDevice: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/users/${id}/reset-device`, { method: 'PATCH' }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/users/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 3. ATTENDANCE API
// =============================================================

export const attendanceApi = {
    createSession: (body: CreateSessionRequest): Promise<AttendanceSession> =>
        apiFetch<AttendanceSession>(`${API_PREFIX}/attendance/session`, { method: 'POST', body: JSON.stringify(body) }),

    checkIn: (body: { sessionId: string; latitude: number; longitude: number }): Promise<AttendanceRecord> =>
        apiFetch<AttendanceRecord>(`${API_PREFIX}/attendance/check-in`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<AttendanceSession[]> => apiFetch<AttendanceSession[]>(`${API_PREFIX}/attendance`),

    getById: (id: string): Promise<AttendanceRecord> => apiFetch<AttendanceRecord>(`${API_PREFIX}/attendance/${id}`),

    update: (id: string, body: Partial<AttendanceRecord>): Promise<AttendanceRecord> =>
        apiFetch<AttendanceRecord>(`${API_PREFIX}/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/attendance/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 4. MENTORING API
// =============================================================

export const mentoringApi = {
    // ── Group CRUD ──
    createGroup: (body: CreateMentoringGroupRequest): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`${API_PREFIX}/mentoring/groups`, { method: 'POST', body: JSON.stringify(body) }),

    getGroups: (category?: MentoringCategory): Promise<MentoringGroup[]> =>
        apiFetch<MentoringGroup[]>(`${API_PREFIX}/mentoring/groups${category ? `?category=${category}` : ''}`),

    getGroupById: (groupId: string): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`${API_PREFIX}/mentoring/groups/${groupId}`),

    updateGroup: (groupId: string, body: UpdateMentoringGroupRequest): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`${API_PREFIX}/mentoring/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(body) }),

    deleteGroup: (groupId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/mentoring/groups/${groupId}`, { method: 'DELETE' }),

    // ── Members ──
    addMember: (groupId: string, menteeId: string): Promise<MentoringMember> =>
        apiFetch<MentoringMember>(`${API_PREFIX}/mentoring/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ menteeId }) }),

    removeMember: (groupId: string, memberId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/mentoring/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),

    // ── Auto-Generate ──
    autoGenerate: (body: AutoGenerateGroupRequest): Promise<AutoGenerateGroupResult> =>
        apiFetch<AutoGenerateGroupResult>(`${API_PREFIX}/mentoring/groups/auto-generate`, { method: 'POST', body: JSON.stringify(body) }),

    // ── Mentor view (MENTOR role only) ──
    getMyMentees: (): Promise<MentoringGroup[]> => apiFetch<MentoringGroup[]>(`${API_PREFIX}/mentoring/mentees`),

    // ── Report ──
    createReport: (body: CreateMentoringReportRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/mentoring/report`, { method: 'POST', body: JSON.stringify(body) }),
};

// =============================================================
// 5. BAM API
// =============================================================

export const bamApi = {
    getSessions: (): Promise<BAMSession[]> => apiFetch<BAMSession[]>(`${API_PREFIX}/bam/sessions`),

    getSessionById: (id: string): Promise<BAMSession> => apiFetch<BAMSession>(`${API_PREFIX}/bam/sessions/${id}`),

    getMentorScore: (mentorId: string): Promise<MentorScore> =>
        apiFetch<MentorScore>(`${API_PREFIX}/bam/mentor-score/${mentorId}`),
};

// =============================================================
// 6. QUIZ API
// =============================================================

export const quizApi = {
    create: (body: CreateQuizRequest): Promise<Quiz> =>
        apiFetch<Quiz>(`${API_PREFIX}/quiz`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<Quiz[]> => apiFetch<Quiz[]>(`${API_PREFIX}/quiz`),

    start: (id: string): Promise<Quiz> => apiFetch<Quiz>(`${API_PREFIX}/quiz/${id}/start`),

    submit: (id: string, body: { answers: QuizAnswer[] }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/quiz/${id}/submit`, { method: 'POST', body: JSON.stringify(body) }),

    getResults: (id: string): Promise<QuizResult[]> => apiFetch<QuizResult[]>(`${API_PREFIX}/quiz/${id}/results`),

    getMyResults: (): Promise<QuizResult[]> => apiFetch<QuizResult[]>(`${API_PREFIX}/quiz/my-results`),

    getEssaySubmissions: (quizId: string): Promise<EssaySubmission[]> =>
        apiFetch<EssaySubmission[]>(`${API_PREFIX}/quiz/${quizId}/essay-submissions`),

    gradeEssay: (quizId: string, submissionId: string, score: number): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/quiz/${quizId}/essay/${submissionId}/grade`, {
            method: 'PATCH',
            body: JSON.stringify({ score }),
        }),
};

// =============================================================
// 7. PERMISSION API
// =============================================================

export const permissionApi = {
    create: (body: CreatePermissionRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/permission`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (status?: PermissionStatus): Promise<Permission[]> =>
        apiFetch<Permission[]>(`${API_PREFIX}/permission${status ? `?status=${status}` : ''}`),

    getMy: (): Promise<Permission[]> => apiFetch<Permission[]>(`${API_PREFIX}/permission/my`),

    getById: (id: string): Promise<Permission> => apiFetch<Permission>(`${API_PREFIX}/permission/${id}`),

    approveAll: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/permission/approve-all`, { method: 'PATCH' }),

    rejectAll: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/permission/reject-all`, { method: 'PATCH' }),

    approve: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/permission/${id}/approve`, { method: 'PATCH' }),

    reject: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/permission/${id}/reject`, { method: 'PATCH' }),
};

// =============================================================
// 8. RESUME API
// =============================================================

export const resumeApi = {
    create: (body: CreateResumeRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/resume`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<Resume[]> => apiFetch<Resume[]>(`${API_PREFIX}/resume`),

    getMy: (): Promise<Resume[]> => apiFetch<Resume[]>(`${API_PREFIX}/resume/my`),

    getById: (id: string): Promise<Resume> => apiFetch<Resume>(`${API_PREFIX}/resume/${id}`),

    update: (id: string, body: Partial<CreateResumeRequest>): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/resume/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/resume/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 9. NEWS API
// =============================================================

export const newsApi = {
    create: (body: CreateNewsRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/news`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<News[]> => apiFetch<News[]>(`${API_PREFIX}/news`),

    getById: (id: string): Promise<News> => apiFetch<News>(`${API_PREFIX}/news/${id}`),

    update: (id: string, body: Partial<CreateNewsRequest>): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/news/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/news/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 10. NOTIFICATION API
// =============================================================

export const notificationApi = {
    getAll: (): Promise<Notification[]> => apiFetch<Notification[]>(`${API_PREFIX}/notification`),

    getUnreadCount: (): Promise<UnreadCountResponse> =>
        apiFetch<UnreadCountResponse>(`${API_PREFIX}/notification/unread-count`),

    markRead: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/notification/${id}/read`, { method: 'PATCH' }),

    markAllRead: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/notification/read-all`, { method: 'PATCH' }),
};

// =============================================================
// 11. GRADING API
// =============================================================

export const gradingApi = {
    getComposition: (): Promise<GradingComposition> =>
        apiFetch<GradingComposition>(`${API_PREFIX}/grading/composition`),

    setComposition: (body: SetGradingCompositionRequest): Promise<GradingComposition> =>
        apiFetch<GradingComposition>(`${API_PREFIX}/grading/composition`, { method: 'PUT', body: JSON.stringify(body) }),
};

// =============================================================
// 12. ACCESS WINDOW API
// =============================================================

export const accessWindowApi = {
    getAll: (): Promise<AccessWindow[]> => apiFetch<AccessWindow[]>(`${API_PREFIX}/access-windows`),

    create: (body: CreateAccessWindowRequest): Promise<AccessWindow> =>
        apiFetch<AccessWindow>(`${API_PREFIX}/access-windows`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: Partial<CreateAccessWindowRequest>): Promise<AccessWindow> =>
        apiFetch<AccessWindow>(`${API_PREFIX}/access-windows/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// =============================================================
// 13. IAM API (Admin only)
// =============================================================

export const iamApi = {
    getPermissions: (): Promise<IamPermission[]> => apiFetch<IamPermission[]>(`${API_PREFIX}/iam/permissions`),

    createPermission: (body: { name: string; description?: string }): Promise<IamPermission> =>
        apiFetch<IamPermission>(`${API_PREFIX}/iam/permissions`, { method: 'POST', body: JSON.stringify(body) }),

    deletePermission: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/iam/permissions/${id}`, { method: 'DELETE' }),

    getRolePermissions: (role: UserRole): Promise<IamPermission[]> =>
        apiFetch<IamPermission[]>(`${API_PREFIX}/iam/roles/${role}/permissions`),

    assignPermissionToRole: (role: UserRole, permissionId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/iam/roles/${role}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ permissionId }),
        }),

    removePermissionFromRole: (role: UserRole, permissionId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`${API_PREFIX}/iam/roles/${role}/permissions/${permissionId}`, { method: 'DELETE' }),
};

// =============================================================
// 14. DASHBOARD API
// =============================================================

export const dashboardApi = {
    getMyGrades: (): Promise<MyGrade> => apiFetch<MyGrade>(`${API_PREFIX}/dashboard/my-grades`),

    getAllGrades: (): Promise<StudentGrade[]> => apiFetch<StudentGrade[]>(`${API_PREFIX}/dashboard/all-grades`),

    getMenteeGrades: (): Promise<StudentGrade[]> => apiFetch<StudentGrade[]>(`${API_PREFIX}/dashboard/mentee-grades`),

    getStudentGrades: (id: string): Promise<StudentGrade> =>
        apiFetch<StudentGrade>(`${API_PREFIX}/dashboard/student/${id}`),

    exportExcel: async (): Promise<void> => {
        const token = getToken();
        const response = await fetch(`${API_BASE}${API_PREFIX}/dashboard/export/excel`, {
            headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!response.ok) throw new Error(`Export gagal: ${response.status}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nilai-mahasiswa.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};

// =============================================================
// HELPER: Client-side CSV Export
// =============================================================

export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
    const BOM = '﻿';
    const escape = (v: string | number | null | undefined): string => {
        const str = v == null ? '' : String(v);
        return `"${str.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================
// HELPER: Client-side CSV Parse
// =============================================================

export function parseCSV(text: string): string[][] {
    const lines = text.trim().split(/\r?\n/);
    return lines.map((line) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    });
}
