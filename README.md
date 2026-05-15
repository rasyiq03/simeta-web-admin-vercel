# SIMETA Web Admin — Next.js 16

Dashboard admin SIMETA untuk role **ADMIN / PANITIA / DOSEN**. Stack:
**Next.js 16 (App Router)**, **React 19**, TypeScript, plain `fetch` (tidak
pakai library HTTP).

> Untuk overview seluruh stack lihat [../README.md](../README.md). Daftar
> endpoint backend lengkap juga di sana.

---

## 1. Quick Start

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > .env.local
pnpm install
pnpm dev                    # http://localhost:3000
```

Catatan:
- `NEXT_PUBLIC_API_URL` **wajib berakhiran `/api/v1`** (sesuai prefix backend).
  Default fallback di [src/lib/api.ts:60](src/lib/api.ts#L60) hanya
  `http://localhost:3001` (tanpa `/api/v1`) — set `.env.local` supaya tidak
  404.
- Backend `.env` harus memuat origin web ini di `CORS_ORIGIN`, mis.
  `http://localhost:3000,https://simeta-web-admin-vercel.vercel.app`.

---

## 2. Peta Folder

```
simeta-frontend-web-app/
├── src/
│   ├── app/                     # App Router pages
│   │   ├── layout.tsx           # root layout — auth & toast provider
│   │   ├── page.tsx             # redirect ke /dashboard atau /login
│   │   ├── login/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx       # sidebar + header
│   │       ├── page.tsx         # overview (grade summary, quiz, dll.)
│   │       ├── users/page.tsx
│   │       ├── participants/page.tsx
│   │       ├── reference/page.tsx
│   │       ├── attendance/page.tsx
│   │       ├── mentoring/page.tsx
│   │       ├── grading/page.tsx    # composition + rules
│   │       ├── grades/page.tsx     # ranking + export Excel
│   │       ├── quiz/page.tsx       # CRUD + grade essay (lihat catatan §6)
│   │       ├── permission/page.tsx
│   │       ├── resume/page.tsx     # resume + resume-sessions (lihat catatan §6)
│   │       ├── news/page.tsx
│   │       ├── notifications/page.tsx
│   │       └── iam/page.tsx        # ADMIN only
│   ├── components/              # Header, Sidebar, Modal, StatusBadge, ImageUpload, PasswordInput
│   ├── contracts/openapi.v1.json# Salinan kontrak backend (dipakai `types:sync`)
│   ├── lib/
│   │   ├── api.ts               # API service layer (apiFetch + per-modul namespace)
│   │   ├── auth-context.tsx     # Context: user, token, hasRole, login/logout
│   │   └── toast-context.tsx    # Notifikasi global
│   └── types/                   # TS types (manual + auto-generated)
├── public/
├── scripts/                     # fetch-contract.ts (sync openapi dari backend)
├── next.config.mjs
├── jsconfig.json
└── tsconfig.json
```

---

## 3. Konvensi API (`src/lib/api.ts`)

Pakai helper `apiFetch<T>(endpoint, init)`:

- Auto-prepend `API_BASE` (dari `NEXT_PUBLIC_API_URL`)
- Auto-attach `Authorization: Bearer <token>` (token diambil dari
  `localStorage['simeta_token']`)
- Auto-attach `Content-Type: application/json`
- Auto-unwrap `{ data: ... }` dari response sukses
- Lempar `Error(message)` kalau response non-2xx (mengambil
  `raw.message` dari backend)

API namespace yang tersedia:

| Namespace          | Domain                                                          |
|--------------------|-----------------------------------------------------------------|
| `authApi`          | login, register, registerAs, getMe                              |
| `usersApi`         | list, getById, getParticipants, assignRole, resetDevice, delete |
| `referenceApi`     | jurusan / prodi / kelas / kategori / dosenKelas CRUD            |
| `attendanceApi`    | createSession, checkIn, getAll, getSessionDetail, update, updateRecord, delete |
| `mentoringApi`     | group CRUD, members, autoGenerate, getMyMentees, createReport   |
| `bamApi`           | getSessions, getSessionById, getMentorScore                     |
| `quizApi`          | create, getAll, start, submit, getResults, getMyResults *(getEssaySubmissions/gradeEssay — lihat §6)* |
| `permissionApi`    | create, getAll, getMy, getById, approve(All)/reject(All)        |
| `resumeApi`        | create, getAll, getMy, getById, update, delete                  |
| `resumeSessionApi` | *(lihat §6 — endpoint belum ada di backend)*                    |
| `newsApi`          | create, getAll, getById, update, delete                         |
| `notificationApi`  | getAll, getUnreadCount, markRead, markAllRead                   |
| `gradingApi`       | getComposition, setComposition                                  |
| `accessWindowApi`  | getAll, create, update                                          |
| `iamApi`           | listPermissions, createPermission, deletePermission, getRolePermissions, assignPermissionToRole, removePermissionFromRole |
| `dashboardApi`     | getMyGrades, getAllGrades, getMenteeGrades, getStudentGrades, exportExcel |
| `uploadApi`        | uploadFile(File, { folderId? })                                 |

Helper tambahan:
- `exportToCSV(filename, headers, rows)` — generate CSV client-side dengan
  BOM UTF-8.
- `parseCSV(text)` — import CSV (untuk bulk upload mahasiswa, dll.).
- `normNama<T>(obj)` — rename property `nama` → `name` rekursif (backend
  pakai bahasa Indonesia untuk reference data).

---

## 4. Auth & Routing

`AuthProvider` di [src/lib/auth-context.tsx](src/lib/auth-context.tsx)
mengelola:
- Token disimpan di `localStorage['simeta_token']`
- `deviceId` di-generate sekali (UUID) di `localStorage['simeta_device_id']`
- `hasRole(...roles: UserRole[])` untuk gating UI

Dashboard layout di [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx)
melakukan redirect ke `/login` kalau belum auth. Tiap page yang menampilkan
data role-specific umumnya pakai:

```tsx
const { user, hasRole } = useAuth();
if (!hasRole('ADMIN', 'PANITIA', 'DOSEN')) return <NotAuthorized />;
```

---

## 5. Tipe & Kontrak

- Tipe statis manual ada di [src/types/](src/types/).
- Tipe auto-generated dari OpenAPI: `pnpm types:sync` akan menggunakan
  `openapi-typescript` untuk emit ke `src/types/api-generated.ts`.
- Sebelum sync, fetch kontrak terbaru dari backend:
  `pnpm contract:fetch` (`scripts/fetch-contract.ts`).

Workflow yang disarankan saat backend menambah endpoint baru:

```bash
# di simeta-backend:
pnpm contract:generate                     # tulis contracts/openapi.v1.json

# di simeta-frontend-web-app:
pnpm contract:fetch                        # copy ke src/contracts/openapi.v1.json
pnpm types:sync                            # emit ulang src/types/api-generated.ts
pnpm types:check                           # pastikan tidak ada drift type
```

---

## 6. Catatan Bug Aktif (per audit 2026-05-13)

Lihat root README §5 untuk daftar lengkap. Yang harus diperhatikan di web:

1. **`quizApi.getEssaySubmissions(quizId)`** — memanggil
   `GET /quiz/:id/essay-submissions` yang **belum ada di backend**. Halaman
   `dashboard/quiz/page.tsx` baris 207 akan 404. Solusi: tambah controller di
   backend atau sembunyikan UI grade-essay sampai endpoint tersedia.

2. **`quizApi.gradeEssay(quizId, submissionId, score)`** — memanggil
   `PATCH /quiz/:id/essay/:submissionId/grade` yang juga **belum ada di
   backend**.

3. **`resumeSessionApi.*`** — seluruh CRUD `/resume/sessions/*` belum ada di
   backend. Halaman `dashboard/resume/page.tsx` akan error saat load. Solusi:
   tambah modul `ResumeSession` di backend (`POST/GET/PATCH/DELETE
   /resume/sessions[/:id]`) atau hapus tab "Resume Session" di UI sampai
   diimplementasikan.

4. **Default `API_BASE` fallback** di [src/lib/api.ts:60](src/lib/api.ts#L60)
   adalah `http://localhost:3001` (tanpa `/api/v1`). Pastikan `.env.local`
   selalu di-set; idealnya ubah fallback default-nya ke
   `http://localhost:3001/api/v1`.

5. **Header `X-Platform`** tidak dikirim oleh `apiFetch`. Backend tidak
   menolak, tapi audit-log "platform" akan kosong untuk aksi dari web.
   Saran: tambah `'X-Platform': 'web'` di default headers `apiFetch`.

---

## 7. Build & Deploy

```bash
pnpm build                 # next build
pnpm start                 # next start (production)
```

Produksi di-deploy ke Vercel:
- Set environment variable `NEXT_PUBLIC_API_URL` di Vercel project settings
  ke `https://api.simeta.online/api/v1`.
- Pastikan backend `APP_URL` & `CORS_ORIGIN` mencakup domain Vercel.

---

## 8. Linting & Type Check

```bash
pnpm lint                  # eslint
pnpm types:check           # tsc --noEmit
```

---

## 9. Standard Operating Procedure (SOP)

### Local Setup
1. **Environment**: `cp .env.example .env.local`. Set `NEXT_PUBLIC_API_URL`.
2. **Install**: `pnpm install`.
3. **Run**: `pnpm dev`.
4. **Sync Types**: Jika backend berubah, jalankan `pnpm contract:fetch && pnpm types:sync`.

### Deployment Guide (Vercel)
1. **Connect**: Hubungkan repo ke Vercel.
2. **Config**: Set `NEXT_PUBLIC_API_URL` di dashboard Vercel.
3. **Build**: Vercel otomatis menjalankan `pnpm build`.
4. **CORS**: Pastikan domain Vercel terdaftar di `CORS_ORIGIN` backend.

---

## 10. Security & Hardening
1. **Sensitive Data**: Jangan simpan data sensitif di `public/`.
2. **API Hardening**: Pastikan `NEXT_PUBLIC_` prefix hanya untuk variabel yang AMAN diekspos ke client.
3. **Auth Storage**: Token disimpan di `localStorage` (default). Gunakan HttpOnly cookies jika butuh keamanan extra terhadap XSS.
4. **CSP**: Content Security Policy disarankan untuk production hardening.
