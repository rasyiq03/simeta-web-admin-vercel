/**
 * =============================================================
 * SIMETA CMS — API Service Layer v2
 * =============================================================
 *
 * FIX S2 (Sync) — Fungsi `normNama()` (walker rekursif yang me-rename
 * setiap key "nama" jadi "name") sudah DIHAPUS. Backend Prisma sekarang
 * mengembalikan property `name` langsung (kolom DB tetap "nama" via @map),
 * sehingga workaround di FE tidak lagi diperlukan.
 *
 * Request body untuk create/update reference data sekarang juga memakai
 * `name` (sebelumnya FE mengirim `{ nama: body.name }` untuk mencocokkan
 * DTO lama). DTO backend (`reference-data.dto.ts`) sudah diselaraskan.
 */

import type {
    LoginRequest,
    LoginResponse,
    RegisterAsRequest,
    User,
    UserRole,
    AttendanceSession,
    AttendanceRecord,
    AttendanceSessionDetail,
    AttendanceStatus,
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
    ResumeSession,
    CreateResumeRequest,
    CreateResumeSessionRequest,
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
    Jurusan,
    Prodi,
    Kelas,
    Kategori,
    DosenKelas,
    AssignDosenKelasRequest,
    AcademicYear,
    Semester,
    Enrollment,
    EnrollmentMahasiswaType,
    CreateAcademicYearRequest,
    CreateSemesterRequest,
    CreateEnrollmentRequest,
    UpdateEnrollmentRequest,
    BulkEnrollRequest,
    BulkEnrollResult,
    CopyFromSemesterRequest,
    CopyFromSemesterResult,
    AuditLog,
    UploadRecord,
    UserQuota,
} from '@/types';

const API_BASE: string = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

// Diagnostik deploy: kalau bundle produksi ter-build tanpa NEXT_PUBLIC_API_URL,
// API_BASE jatuh ke localhost dan SEMUA request gagal dari origin terdeploy
// (gejala: spinner berputar terus, UI tak muncul). Teriak keras di console
// alih-alih diam.
if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    API_BASE.includes('localhost')
) {
    // eslint-disable-next-line no-console
    console.error(
        '[SIMETA] NEXT_PUBLIC_API_URL tidak di-set saat build — API_BASE = ' +
            `"${API_BASE}". Set env ini di dashboard deploy lalu re-build.`,
    );
}

// Timeout default request. Tanpa ini, fetch menggantung tak terbatas saat
// backend lambat/cold-start/unreachable → auth bootstrap tak pernah selesai
// → spinner abadi. 12 dtk: cukup untuk cold start wajar, cukup cepat untuk
// gagal ke layar login alih-alih menggantung selamanya.
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
    input: string,
    init: RequestInit = {},
    timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error(
                'Server tidak merespons (timeout). Periksa koneksi atau coba lagi.',
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * FIX F3-4 — `getToken` dipertahankan untuk kompatibilitas API publik
 * (mis. exportExcel di bawah), tapi selalu mengembalikan null karena JWT
 * sekarang berada di cookie httpOnly yang tidak dapat dibaca JS. Komponen
 * yang ingin tahu user-state harus pakai `useAuth().user`.
 *
 * @deprecated Token tidak lagi accessible — selalu null. Pertahankan import
 *   yang sudah ada di codebase agar tidak break compile; pengembang baru
 *   sebaiknya tidak memakai fungsi ini.
 */
export function getToken(): string | null {
    return null;
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

/**
 * FIX #6 — Penanganan sesi kedaluwarsa terpusat.
 *
 * Gejala lama: token (cookie httpOnly) cepat expired, request balas 401,
 * tapi UI tidak bereaksi → user terjebak di halaman kosong tanpa tahu harus
 * login ulang (melanggar heuristic "visibility of system status" & "error
 * recovery"). Sekarang:
 *
 *   1. Saat sebuah request balas 401, kita coba SEKALI refresh token diam-diam
 *      lewat POST /auth/refresh (cookie refresh httpOnly dikirim otomatis).
 *   2. Kalau refresh sukses → request asli diulang transparan (user tidak
 *      merasakan apa-apa, sesi terasa lebih panjang).
 *   3. Kalau refresh gagal → broadcast event `simeta:session-expired`.
 *      AuthProvider menangkapnya, membersihkan state, dan mengarahkan ke
 *      /login dengan pesan jelas + menyimpan halaman tujuan agar bisa balik.
 *
 * Endpoint auth (login/refresh/logout) dikecualikan dari retry agar tidak
 * terjadi loop tak hingga.
 */
const AUTH_BYPASS_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
    // De-dupe: bila banyak request 401 berbarengan, hanya satu panggilan
    // /auth/refresh yang benar-benar dikirim; sisanya menunggu hasilnya.
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            try {
                const res = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'X-Platform': 'web' },
                    body: JSON.stringify({}),
                });
                return res.ok;
            } catch {
                return false;
            } finally {
                // Reset di tick berikutnya supaya gelombang 401 yang sama
                // berbagi satu hasil, tapi refresh baru tetap mungkin nanti.
                setTimeout(() => { refreshInFlight = null; }, 0);
            }
        })();
    }
    return refreshInFlight;
}

function broadcastSessionExpired(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('simeta:session-expired'));
}

/**
 * Normalisasi tanggal ke ISO-8601 penuh (UTC) yang diterima backend
 * (NestJS class-validator @IsDateString / Prisma DateTime). Input dari
 * <input type="date"> ("YYYY-MM-DD") atau type="datetime-local"
 * ("YYYY-MM-DDTHH:mm") akan gagal di Prisma bila dikirim mentah →
 * Internal Server Error. Pakai helper ini di SEMUA payload tanggal.
 *
 * - Mengembalikan string ISO untuk nilai valid.
 * - Mengembalikan undefined untuk kosong/invalid (agar field opsional
 *   tidak dikirim alih-alih mengirim nilai rusak).
 */
export function toISO(value?: string | null): string | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function apiFetch<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    _retried = false,
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Platform': 'web',
        ...(options.headers as Record<string, string>),
    };

    // FIX F3-4 — `credentials: 'include'` membuat browser otomatis mengirim
    // cookie `simeta_token` ke backend (cross-origin sekalipun, asalkan CORS
    // backend men-set Access-Control-Allow-Credentials: true — sudah).
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers,
    });

    // ── FIX #6: 401 → coba refresh sekali, lalu ulang request ──
    const isAuthBypass = AUTH_BYPASS_ENDPOINTS.some((p) => endpoint.startsWith(p));
    if (response.status === 401 && !isAuthBypass && !_retried) {
        const refreshed = await attemptRefresh();
        if (refreshed) {
            return apiFetch<T>(endpoint, options, true);
        }
        broadcastSessionExpired();
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }
    if (response.status === 401 && !isAuthBypass && _retried) {
        broadcastSessionExpired();
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

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
    // FIX F3-4 — Response login untuk klien web TIDAK lagi membawa
    // access_token / refresh_token (backend men-set keduanya sebagai cookie
    // httpOnly). Type `LoginResponse` lama tetap dipakai agar interface
    // kontrak (mobile) tidak berubah; field token akan undefined di web.
    login: (body: LoginRequest): Promise<LoginResponse> =>
        apiFetch<LoginResponse>(`/auth/login`, { method: 'POST', body: JSON.stringify(body) }),

    // FIX F3-4 — logout sekarang round-trip ke backend supaya cookie httpOnly
    // di-clear (browser hanya menghapus cookie yang Set-Cookie ulang dengan
    // Max-Age=0). Sebelumnya frontend hanya menghapus localStorage.
    logout: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/logout`, { method: 'POST', body: JSON.stringify({}) }),

    register: (body: { name: string; email: string; password: string }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/register`, { method: 'POST', body: JSON.stringify(body) }),

    registerAs: (body: RegisterAsRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/register-as`, { method: 'POST', body: JSON.stringify(body) }),

    // FIX S2 — sebelumnya .then(normNama<User>). Backend sekarang langsung
    // mengembalikan `name` untuk jurusan/prodi/kelas/kategori.
    getMe: (): Promise<User> => apiFetch<User>(`/auth/me`),

    // FIX #6 — refresh token diam-diam (dipakai juga otomatis oleh apiFetch
    // saat 401). Cookie refresh httpOnly dikirim via credentials: 'include'.
    refresh: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/refresh`, { method: 'POST', body: JSON.stringify({}) }),

    // FIX #1 — ganti password sendiri. Backend memutus sesi lama opsional;
    // FE tetap memaksa user login ulang untuk konsistensi keamanan.
    changePassword: (body: { oldPassword: string; newPassword: string }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/change-password`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // Reset password via email — minta tautan/kode reset dikirim ke email.
    forgotPassword: (body: { email: string }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/forgot-password`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // Tetapkan password baru memakai token dari email.
    resetPassword: (body: { token: string; newPassword: string }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/auth/reset-password`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

// =============================================================
// 2. USERS API
// =============================================================

export const usersApi = {
    getAll: (): Promise<User[]> => apiFetch<User[]>(`/users`),

    getById: (id: string): Promise<User> => apiFetch<User>(`/users/${id}`),

    getParticipants: (semesterId?: string): Promise<User[]> =>
        apiFetch<User[]>(`/users/participants${semesterId ? `?semesterId=${semesterId}` : ''}`),

    assignRole: (id: string, role: UserRole): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

    resetDevice: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/users/${id}/reset-device`, { method: 'PATCH' }),

    // FIX #2 — kirim ulang informasi akun (email + password sementara)
    // ke email user. Backend yang generate/sertakan kredensial; FE hanya memicu.
    sendAccountInfo: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/users/${id}/send-account-info`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/users/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 2b. REFERENCE DATA API
// =============================================================

export const referenceApi = {
    // Jurusan
    getJurusan: (): Promise<Jurusan[]> => apiFetch<Jurusan[]>(`/reference/jurusan`),
    createJurusan: (body: { name: string }): Promise<Jurusan> =>
        apiFetch<Jurusan>(`/reference/jurusan`, { method: 'POST', body: JSON.stringify({ name: body.name }) }),
    updateJurusan: (id: string, body: { name: string }): Promise<Jurusan> =>
        apiFetch<Jurusan>(`/reference/jurusan/${id}`, { method: 'PATCH', body: JSON.stringify({ name: body.name }) }),
    deleteJurusan: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/reference/jurusan/${id}`, { method: 'DELETE' }),

    // Prodi
    getProdi: (jurusanId?: string): Promise<Prodi[]> =>
        apiFetch<Prodi[]>(`/reference/prodi${jurusanId ? `?jurusanId=${jurusanId}` : ''}`),
    createProdi: (body: { name: string; jurusanId: string }): Promise<Prodi> =>
        apiFetch<Prodi>(`/reference/prodi`, {
            method: 'POST',
            body: JSON.stringify({ name: body.name, jurusanId: body.jurusanId }),
        }),
    updateProdi: (id: string, body: { name?: string; jurusanId?: string }): Promise<Prodi> =>
        apiFetch<Prodi>(`/reference/prodi/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ...(body.name !== undefined && { name: body.name }),
                ...(body.jurusanId !== undefined && { jurusanId: body.jurusanId }),
            }),
        }),
    deleteProdi: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/reference/prodi/${id}`, { method: 'DELETE' }),

    // Kelas
    getKelas: (prodiId?: string): Promise<Kelas[]> =>
        apiFetch<Kelas[]>(`/reference/kelas${prodiId ? `?prodiId=${prodiId}` : ''}`),
    createKelas: (body: { name: string; prodiId?: string }): Promise<Kelas> =>
        apiFetch<Kelas>(`/reference/kelas`, {
            method: 'POST',
            body: JSON.stringify({ name: body.name, ...(body.prodiId && { prodiId: body.prodiId }) }),
        }),
    updateKelas: (id: string, body: { name?: string; prodiId?: string }): Promise<Kelas> =>
        apiFetch<Kelas>(`/reference/kelas/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ...(body.name !== undefined && { name: body.name }),
                ...(body.prodiId !== undefined && { prodiId: body.prodiId }),
            }),
        }),
    deleteKelas: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/reference/kelas/${id}`, { method: 'DELETE' }),

    // Kategori
    getKategori: (): Promise<Kategori[]> => apiFetch<Kategori[]>(`/reference/kategori`),
    createKategori: (body: { name: string }): Promise<Kategori> =>
        apiFetch<Kategori>(`/reference/kategori`, { method: 'POST', body: JSON.stringify({ name: body.name }) }),
    updateKategori: (id: string, body: { name: string }): Promise<Kategori> =>
        apiFetch<Kategori>(`/reference/kategori/${id}`, { method: 'PATCH', body: JSON.stringify({ name: body.name }) }),
    deleteKategori: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/reference/kategori/${id}`, { method: 'DELETE' }),

    // Dosen–Kelas assignment
    assignDosenKelas: (body: AssignDosenKelasRequest): Promise<DosenKelas> =>
        apiFetch<DosenKelas>(`/reference/dosen-kelas`, { method: 'POST', body: JSON.stringify(body) }),
    removeDosenKelas: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/reference/dosen-kelas/${id}`, { method: 'DELETE' }),
    getKelasByDosen: (dosenId: string): Promise<DosenKelas[]> =>
        apiFetch<DosenKelas[]>(`/reference/dosen/${dosenId}/kelas`),
    getDosenByKelas: (kelasId: string): Promise<DosenKelas[]> =>
        apiFetch<DosenKelas[]>(`/reference/kelas/${kelasId}/dosen`),
    getMyKelas: (): Promise<DosenKelas[]> => apiFetch<DosenKelas[]>(`/reference/dosen/my-kelas`),
};

// =============================================================
// 3. ATTENDANCE API
// =============================================================

export const attendanceApi = {
    createSession: (body: CreateSessionRequest): Promise<AttendanceSession> =>
        apiFetch<AttendanceSession>(`/attendance/session`, { method: 'POST', body: JSON.stringify(body) }),

    checkIn: (body: { sessionId: string; latitude: number; longitude: number }): Promise<AttendanceRecord> =>
        apiFetch<AttendanceRecord>(`/attendance/check-in`, { method: 'POST', body: JSON.stringify(body) }),

    // FIX #4 — semesterId opsional agar bisa melihat absensi semester lampau.
    // Backend yang belum mendukung query ini akan mengabaikannya (graceful).
    getAll: (semesterId?: string): Promise<AttendanceSession[]> =>
        apiFetch<AttendanceSession[]>(`/attendance${semesterId ? `?semesterId=${semesterId}` : ''}`),

    getSessionDetail: (id: string): Promise<AttendanceSessionDetail> =>
        apiFetch<AttendanceSessionDetail>(`/attendance/${id}`),

    update: (id: string, body: { title?: string; startTime?: string; endTime?: string }): Promise<AttendanceSession> =>
        apiFetch<AttendanceSession>(`/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    updateRecord: (sessionId: string, recordId: string, status: AttendanceStatus): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/attendance/${sessionId}/records/${recordId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/attendance/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 4. MENTORING API
// =============================================================

export const mentoringApi = {
    // ── Group CRUD ──
    createGroup: (body: CreateMentoringGroupRequest): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`/mentoring/groups`, { method: 'POST', body: JSON.stringify(body) }),

    // FIX #5 — filter kelompok berdasarkan kategori dari Data Referensi
    // (kategoriId), bukan enum hardcoded. `category` tetap didukung untuk
    // kompatibilitas data lama. FIX #4 — semesterId opsional.
    getGroups: (opts?: { category?: MentoringCategory; kategoriId?: string; semesterId?: string }): Promise<MentoringGroup[]> => {
        const qs = new URLSearchParams();
        if (opts?.category) qs.set('category', opts.category);
        if (opts?.kategoriId) qs.set('kategoriId', opts.kategoriId);
        if (opts?.semesterId) qs.set('semesterId', opts.semesterId);
        const s = qs.toString();
        return apiFetch<MentoringGroup[]>(`/mentoring/groups${s ? `?${s}` : ''}`);
    },

    getGroupById: (groupId: string): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`/mentoring/groups/${groupId}`),

    updateGroup: (groupId: string, body: UpdateMentoringGroupRequest): Promise<MentoringGroup> =>
        apiFetch<MentoringGroup>(`/mentoring/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(body) }),

    deleteGroup: (groupId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/mentoring/groups/${groupId}`, { method: 'DELETE' }),

    // ── Members ──
    addMember: (groupId: string, menteeId: string): Promise<MentoringMember> =>
        apiFetch<MentoringMember>(`/mentoring/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ menteeId }) }),

    removeMember: (groupId: string, memberId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/mentoring/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),

    // ── Auto-Generate ──
    autoGenerate: (body: AutoGenerateGroupRequest): Promise<AutoGenerateGroupResult> =>
        apiFetch<AutoGenerateGroupResult>(`/mentoring/groups/auto-generate`, { method: 'POST', body: JSON.stringify(body) }),

    // ── Mentor view (MENTOR role only) ──
    getMyMentees: (): Promise<MentoringGroup[]> => apiFetch<MentoringGroup[]>(`/mentoring/mentees`),

    // ── Report ──
    createReport: (body: CreateMentoringReportRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/mentoring/report`, { method: 'POST', body: JSON.stringify(body) }),
};

// =============================================================
// 5. BAM API
// =============================================================

export const bamApi = {
    getSessions: (): Promise<BAMSession[]> => apiFetch<BAMSession[]>(`/bam/sessions`),

    getSessionById: (id: string): Promise<BAMSession> => apiFetch<BAMSession>(`/bam/sessions/${id}`),

    getMentorScore: (mentorId: string): Promise<MentorScore> =>
        apiFetch<MentorScore>(`/bam/mentor-score/${mentorId}`),
};

// =============================================================
// 6. QUIZ API
// =============================================================

export const quizApi = {
    create: (body: CreateQuizRequest): Promise<Quiz> =>
        apiFetch<Quiz>(`/quiz`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<Quiz[]> => apiFetch<Quiz[]>(`/quiz`),

    start: (id: string): Promise<Quiz> => apiFetch<Quiz>(`/quiz/${id}/start`),

    submit: (id: string, body: { answers: QuizAnswer[] }): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/quiz/${id}/submit`, { method: 'POST', body: JSON.stringify(body) }),

    getResults: (id: string): Promise<QuizResult[]> => apiFetch<QuizResult[]>(`/quiz/${id}/results`),

    getMyResults: (): Promise<QuizResult[]> => apiFetch<QuizResult[]>(`/quiz/my-results`),

    getEssaySubmissions: (quizId: string): Promise<EssaySubmission[]> =>
        apiFetch<EssaySubmission[]>(`/quiz/${quizId}/essay-submissions`),

    gradeEssay: (quizId: string, submissionId: string, score: number): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/quiz/${quizId}/essay/${submissionId}/grade`, {
            method: 'PATCH',
            body: JSON.stringify({ score }),
        }),
};

// =============================================================
// 7. PERMISSION API
// =============================================================

export const permissionApi = {
    create: (body: CreatePermissionRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/permission`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (status?: PermissionStatus): Promise<Permission[]> =>
        apiFetch<Permission[]>(`/permission${status ? `?status=${status}` : ''}`),

    getMy: (): Promise<Permission[]> => apiFetch<Permission[]>(`/permission/my`),

    getById: (id: string): Promise<Permission> => apiFetch<Permission>(`/permission/${id}`),

    approveAll: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/permission/approve-all`, { method: 'PATCH' }),

    rejectAll: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/permission/reject-all`, { method: 'PATCH' }),

    approve: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/permission/${id}/approve`, { method: 'PATCH' }),

    reject: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/permission/${id}/reject`, { method: 'PATCH' }),
};

// =============================================================
// 8. RESUME API
// =============================================================

export const resumeApi = {
    create: (body: CreateResumeRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/resume`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<Resume[]> => apiFetch<Resume[]>(`/resume`),

    getMy: (): Promise<Resume[]> => apiFetch<Resume[]>(`/resume/my`),

    getById: (id: string): Promise<Resume> => apiFetch<Resume>(`/resume/${id}`),

    update: (id: string, body: Partial<CreateResumeRequest>): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/resume/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/resume/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 9. RESUME SESSION API
// NOTE: Requires backend endpoints under /resume/sessions
// =============================================================

export const resumeSessionApi = {
    getAll: (): Promise<ResumeSession[]> =>
        apiFetch<ResumeSession[]>(`/resume/sessions`),

    getById: (id: string): Promise<ResumeSession> =>
        apiFetch<ResumeSession>(`/resume/sessions/${id}`),

    create: (body: CreateResumeSessionRequest): Promise<ResumeSession> =>
        apiFetch<ResumeSession>(`/resume/sessions`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: Partial<CreateResumeSessionRequest>): Promise<ResumeSession> =>
        apiFetch<ResumeSession>(`/resume/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/resume/sessions/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 10. NEWS API
// =============================================================

export const newsApi = {
    create: (body: CreateNewsRequest): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/news`, { method: 'POST', body: JSON.stringify(body) }),

    getAll: (): Promise<News[]> => apiFetch<News[]>(`/news`),

    getById: (id: string): Promise<News> => apiFetch<News>(`/news/${id}`),

    update: (id: string, body: Partial<CreateNewsRequest>): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/news/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/news/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 10. NOTIFICATION API
// =============================================================

export const notificationApi = {
    getAll: (): Promise<Notification[]> => apiFetch<Notification[]>(`/notification`),

    getUnreadCount: (): Promise<UnreadCountResponse> =>
        apiFetch<UnreadCountResponse>(`/notification/unread-count`),

    markRead: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/notification/${id}/read`, { method: 'PATCH' }),

    markAllRead: (): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/notification/read-all`, { method: 'PATCH' }),
};

// =============================================================
// 11. GRADING API
// =============================================================

export const gradingApi = {
    getComposition: (): Promise<GradingComposition> =>
        apiFetch<GradingComposition>(`/grading/composition`),

    setComposition: (body: SetGradingCompositionRequest): Promise<GradingComposition> =>
        apiFetch<GradingComposition>(`/grading/composition`, { method: 'PUT', body: JSON.stringify(body) }),
};

// =============================================================
// 12. ACCESS WINDOW API
// =============================================================

export const accessWindowApi = {
    getAll: (): Promise<AccessWindow[]> => apiFetch<AccessWindow[]>(`/access-windows`),

    create: (body: CreateAccessWindowRequest): Promise<AccessWindow> =>
        apiFetch<AccessWindow>(`/access-windows`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: Partial<CreateAccessWindowRequest>): Promise<AccessWindow> =>
        apiFetch<AccessWindow>(`/access-windows/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// =============================================================
// 13. IAM API (Admin only)
// =============================================================

export const iamApi = {
    getPermissions: (): Promise<IamPermission[]> => apiFetch<IamPermission[]>(`/iam/permissions`),

    createPermission: (body: { name: string; description?: string }): Promise<IamPermission> =>
        apiFetch<IamPermission>(`/iam/permissions`, { method: 'POST', body: JSON.stringify(body) }),

    deletePermission: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/iam/permissions/${id}`, { method: 'DELETE' }),

    getRolePermissions: async (role: UserRole): Promise<IamPermission[]> => {
        type RolePerm = { id: string; role: UserRole; permissionId: string; permission: IamPermission };
        const items = await apiFetch<RolePerm[]>(`/iam/roles/${role}/permissions`);
        return items.map((item) => item.permission);
    },

    assignPermissionToRole: (role: UserRole, permissionId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/iam/roles/${role}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ permissionId }),
        }),

    removePermissionFromRole: (role: UserRole, permissionId: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/iam/roles/${role}/permissions/${permissionId}`, { method: 'DELETE' }),
};

// =============================================================
// 13B. AUDIT LOG API (Admin only)
// =============================================================

export const auditApi = {
    list: (filters?: { action?: string; userId?: string; resource?: string }): Promise<AuditLog[]> => {
        const qs = new URLSearchParams();
        if (filters?.action) qs.set('action', filters.action);
        if (filters?.userId) qs.set('userId', filters.userId);
        if (filters?.resource) qs.set('resource', filters.resource);
        const s = qs.toString();
        return apiFetch<AuditLog[]>(`/audit-logs${s ? `?${s}` : ''}`);
    },
};

// =============================================================
// 14. DASHBOARD API
// =============================================================

export const dashboardApi = {
    getMyGrades: (): Promise<MyGrade> => apiFetch<MyGrade>(`/dashboard/my-grades`),

    // FIX #4 — semesterId opsional agar bisa melihat nilai semester lampau.
    getAllGrades: (semesterId?: string): Promise<StudentGrade[]> =>
        apiFetch<StudentGrade[]>(`/dashboard/all-grades${semesterId ? `?semesterId=${semesterId}` : ''}`),

    getMenteeGrades: (): Promise<StudentGrade[]> => apiFetch<StudentGrade[]>(`/dashboard/mentee-grades`),

    getStudentGrades: (id: string): Promise<StudentGrade> =>
        apiFetch<StudentGrade>(`/dashboard/student/${id}`),

    exportExcel: async (): Promise<void> => {
        // FIX F3-4 — `credentials: 'include'` mengirim cookie httpOnly otomatis;
        // tidak perlu lagi membaca token dari JS (tidak akan bisa).
        const response = await fetch(`${API_BASE}/dashboard/export/excel`, {
            credentials: 'include',
            headers: { 'X-Platform': 'web' },
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
// 14B. SEMESTER / ACADEMIC YEAR / ENROLLMENT API (METAGAMA)
// =============================================================
// Backend Mei 2026: aktivitas Metagama di-scope ke Semester.
// Lihat simeta-backend/docs/SEMESTER_MIGRATION.md untuk detail.

export const academicYearApi = {
    list: (): Promise<AcademicYear[]> => apiFetch<AcademicYear[]>(`/academic-years`),

    getById: (id: string): Promise<AcademicYear> =>
        apiFetch<AcademicYear>(`/academic-years/${id}`),

    create: (body: CreateAcademicYearRequest): Promise<AcademicYear> =>
        apiFetch<AcademicYear>(`/academic-years`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: Partial<CreateAcademicYearRequest>): Promise<AcademicYear> =>
        apiFetch<AcademicYear>(`/academic-years/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/academic-years/${id}`, { method: 'DELETE' }),
};

export const semesterApi = {
    list: (academicYearId?: string): Promise<Semester[]> => {
        const qs = academicYearId ? `?academicYearId=${academicYearId}` : '';
        return apiFetch<Semester[]>(`/semesters${qs}`);
    },

    getActive: (): Promise<Semester> => apiFetch<Semester>(`/semesters/active`),

    getById: (id: string): Promise<Semester> => apiFetch<Semester>(`/semesters/${id}`),

    create: (body: CreateSemesterRequest): Promise<Semester> =>
        apiFetch<Semester>(`/semesters`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: Partial<Pick<CreateSemesterRequest, 'name' | 'startDate' | 'endDate'>>): Promise<Semester> =>
        apiFetch<Semester>(`/semesters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    activate: (id: string): Promise<Semester> =>
        apiFetch<Semester>(`/semesters/${id}/activate`, { method: 'PATCH' }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/semesters/${id}`, { method: 'DELETE' }),
};

export const enrollmentApi = {
    list: (
        semesterId: string,
        opts?: { activeOnly?: boolean; mahasiswaType?: EnrollmentMahasiswaType },
    ): Promise<Enrollment[]> => {
        const params = new URLSearchParams({ semesterId });
        if (opts?.activeOnly) params.set('activeOnly', 'true');
        if (opts?.mahasiswaType) params.set('mahasiswaType', opts.mahasiswaType);
        return apiFetch<Enrollment[]>(`/enrollments?${params.toString()}`);
    },

    getMyHistory: (): Promise<Enrollment[]> => apiFetch<Enrollment[]>(`/enrollments/my-history`),

    getById: (id: string): Promise<Enrollment> => apiFetch<Enrollment>(`/enrollments/${id}`),

    create: (body: CreateEnrollmentRequest): Promise<Enrollment> =>
        apiFetch<Enrollment>(`/enrollments`, { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: UpdateEnrollmentRequest): Promise<Enrollment> =>
        apiFetch<Enrollment>(`/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (id: string): Promise<MessageResponse> =>
        apiFetch<MessageResponse>(`/enrollments/${id}`, { method: 'DELETE' }),

    bulk: (body: BulkEnrollRequest): Promise<BulkEnrollResult> =>
        apiFetch<BulkEnrollResult>(`/enrollments/bulk`, { method: 'POST', body: JSON.stringify(body) }),

    copyFromSemester: (body: CopyFromSemesterRequest): Promise<CopyFromSemesterResult> =>
        apiFetch<CopyFromSemesterResult>(`/enrollments/copy-from-semester`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

// =============================================================
// 15. UPLOAD API — File upload to Google Drive via backend
// NOTE: Requires new backend endpoint POST /api/v1/upload
// =============================================================

interface UploadStatus {
    recordId: string;
    status: 'queued' | 'processing' | 'ready' | 'rejected' | 'failed';
    url: string | null;
    errorMessage: string | null;
}

const UPLOAD_POLL_INTERVAL_MS = 1500;
const UPLOAD_POLL_TIMEOUT_MS = 90_000;

export const uploadApi = {
    /**
     * Upload asinkron: backend balas 202 + recordId, lalu kita polling
     * GET /upload/status/:id sampai `ready`. Signature dipertahankan
     * (`{ url, fileId }`) agar pemanggil lama tidak perlu berubah.
     */
    uploadFile: async (file: File, options?: { folderId?: string }): Promise<{ url: string; fileId: string }> => {
        // FIX F3-4 — cookie httpOnly dikirim otomatis lewat `credentials: 'include'`.
        const formData = new FormData();
        formData.append('file', file);
        if (options?.folderId) formData.append('folderId', options.folderId);
        // Upload boleh lebih lama dari request biasa (file besar) → 30 dtk.
        const response = await fetchWithTimeout(`${API_BASE}/upload`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Platform': 'web' },
            body: formData,
        }, 30_000);
        if (!response.ok) {
            const raw = await response.json().catch(() => ({}));
            throw new Error(raw?.message || `Upload gagal: ${response.status}`);
        }
        const accepted = await response.json();
        const { recordId } = (accepted?.data ?? accepted) as { recordId: string };
        if (!recordId) throw new Error('Respons upload tidak valid (recordId kosong)');

        const deadline = Date.now() + UPLOAD_POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
            const statusRes = await fetchWithTimeout(`${API_BASE}/upload/status/${recordId}`, {
                credentials: 'include',
                headers: { 'X-Platform': 'web' },
            });
            if (!statusRes.ok) {
                const raw = await statusRes.json().catch(() => ({}));
                throw new Error(raw?.message || `Gagal cek status upload: ${statusRes.status}`);
            }
            const body = await statusRes.json();
            const s = (body?.data ?? body) as UploadStatus;

            if (s.status === 'ready' && s.url) {
                // url = /api/v1/upload/<fileId> → ekstrak fileId.
                const fileId = s.url.split('/').pop() ?? '';
                return { url: s.url, fileId };
            }
            if (s.status === 'rejected' || s.status === 'failed') {
                throw new Error(s.errorMessage || `Upload ${s.status}`);
            }
            await new Promise((r) => setTimeout(r, UPLOAD_POLL_INTERVAL_MS));
        }
        throw new Error('Upload timeout — file masih diproses, coba lagi nanti.');
    },

    // Riwayat upload (semua user untuk ADMIN). Endpoint backend opsional —
    // halaman menangani 404 secara anggun.
    history: (): Promise<UploadRecord[]> => apiFetch<UploadRecord[]>(`/upload/history`),

    // Status kuota upload per user.
    quota: (): Promise<UserQuota[]> => apiFetch<UserQuota[]>(`/upload/quota`),
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
