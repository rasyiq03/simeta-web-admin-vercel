'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { usersApi, authApi, dashboardApi, attendanceApi, referenceApi, exportToCSV, parseCSV } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import PasswordInput from '@/components/PasswordInput';
import type { User, UserRole, Gender, BulkCreateUserItem, Jurusan, Prodi, Kelas, Kategori } from '@/types';

interface RoleModalState { open: boolean; user: User | null; selectedRole: UserRole; }
interface AddUserForm {
    name: string; email: string; password: string; role: UserRole;
    nim: string; gender: Gender | '';
    jurusanId: string; prodiId: string; kelasId: string; kategoriId: string;
}
interface ExportDropdownState { open: boolean; loading: boolean; }

// Role enum yang VALID di backend (sumber: pesan validasi backend).
// MAHASISWA = peserta (mentor/mentee dibedakan per-semester via Enrollment).
const ADMIN_ROLES: UserRole[]       = ['ADMIN', 'PANITIA', 'DOSEN'];
const PARTICIPANT_ROLES: UserRole[] = ['MAHASISWA'];
const ALL_ROLES: UserRole[]         = ['ADMIN', 'PANITIA', 'DOSEN', 'MAHASISWA'];

const ROLE_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
    ADMIN:     { bg: 'rgba(222,144,42,0.1)',  color: '#B87420' },
    PANITIA:   { bg: 'rgba(234,88,12,0.1)',   color: '#EA580C' },
    DOSEN:     { bg: 'rgba(37,99,235,0.1)',   color: '#2563EB' },
    MAHASISWA: { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED' },
    // Legacy — hanya untuk menampilkan data lama bila masih ada.
    MENTOR:    { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
    MENTEE:    { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED' },
    PESERTA:   { bg: 'rgba(14,165,233,0.1)',  color: '#0284C7' },
};

const IMPORT_TEMPLATE = [
    ['Nama', 'Email', 'Password', 'Role', 'NIM', 'Kelas', 'Prodi', 'Jurusan', 'Gender'],
    ['Ahmad Fauzi', 'ahmad@example.com', 'Password123!', 'MAHASISWA', '123456', 'A', 'Teknik Informatika', 'Ilmu Komputer', 'LAKI_LAKI'],
];

const NEEDS_EXTENDED = (role: UserRole) => PARTICIPANT_ROLES.includes(role);

const EMPTY_FORM: AddUserForm = {
    name: '', email: '', password: '', role: 'MAHASISWA',
    nim: '', gender: '',
    jurusanId: '', prodiId: '', kelasId: '', kategoriId: '',
};

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function UsersPage(): React.JSX.Element {
    const [users, setUsers]         = useState<User[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [page, setPage]           = useState(1);
    const [perPage, setPerPage]     = useState(20);
    const [roleModal, setRoleModal] = useState<RoleModalState>({ open: false, user: null, selectedRole: 'MAHASISWA' });
    const [addModal, setAddModal]   = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [addForm, setAddForm]     = useState<AddUserForm>(EMPTY_FORM);
    const [addLoading, setAddLoading] = useState(false);
    // FIX #3 — data referensi untuk dropdown bertingkat (jurusan→prodi→kelas)
    const [refJurusan, setRefJurusan] = useState<Jurusan[]>([]);
    const [refProdi, setRefProdi]     = useState<Prodi[]>([]);
    const [refKelas, setRefKelas]     = useState<Kelas[]>([]);
    const [refKategori, setRefKategori] = useState<Kategori[]>([]);
    const [refLoading, setRefLoading] = useState(false);
    const [refError, setRefError]     = useState<string | null>(null);
    const refFetchedRef               = useRef(false);
    const [importRows, setImportRows]   = useState<BulkCreateUserItem[]>([]);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importLoading, setImportLoading] = useState(false);
    const [exportState, setExportState] = useState<ExportDropdownState>({ open: false, loading: false });
    const [dragOver, setDragOver]   = useState(false);
    const fileInputRef              = useRef<HTMLInputElement>(null);
    const exportRef                 = useRef<HTMLDivElement>(null);
    const { user: currentUser } = useAuth();
    const { showToast } = useToast();

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await usersApi.getAll();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Reset page when filter changes
    useEffect(() => { setPage(1); }, [search, roleFilter, perPage]);

    // FIX #3 — muat data referensi TEPAT SEKALI tiap modal dibuka.
    // Pakai ref sebagai guard: memakai `refJurusan.length` sebagai guard
    // dulu menyebabkan refetch tak hingga bila list kosong/lambat
    // (refLoading toggle → deps berubah → fetch lagi). Ref tidak ikut
    // memicu render sehingga aman dari loop; di-reset saat modal ditutup
    // agar pembukaan berikutnya bisa mencoba lagi (mis. setelah error).
    useEffect(() => {
        if (!addModal) { refFetchedRef.current = false; return; }
        if (refFetchedRef.current) return;
        refFetchedRef.current = true;
        let cancelled = false;
        (async () => {
            setRefLoading(true); setRefError(null);
            try {
                const [j, p, k, kt] = await Promise.all([
                    referenceApi.getJurusan(),
                    referenceApi.getProdi(),
                    referenceApi.getKelas(),
                    referenceApi.getKategori().catch(() => [] as Kategori[]),
                ]);
                if (cancelled) return;
                setRefJurusan(j); setRefProdi(p); setRefKelas(k); setRefKategori(kt);
            } catch (err) {
                if (!cancelled) {
                    setRefError((err as Error).message);
                    refFetchedRef.current = false; // izinkan retry saat dibuka lagi
                }
            } finally {
                if (!cancelled) setRefLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [addModal]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportState((s) => ({ ...s, open: false }));
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredUsers = users.filter((u) => {
        const matchSearch = !search ||
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.nim && u.nim.includes(search));
        const matchRole = !roleFilter || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    const totalPages   = Math.max(1, Math.ceil(filteredUsers.length / perPage));
    const safeePage    = Math.min(page, totalPages);
    const start        = (safeePage - 1) * perPage;
    const pagedUsers   = filteredUsers.slice(start, start + perPage);

    /* ── Assign Role ── */
    const openRoleModal = (usr: User) => setRoleModal({ open: true, user: usr, selectedRole: usr.role });
    const handleAssignRole = async () => {
        if (!roleModal.user) return;
        try {
            await usersApi.assignRole(roleModal.user.id, roleModal.selectedRole);
            showToast('Role berhasil diperbarui', 'success');
            setRoleModal({ open: false, user: null, selectedRole: 'MAHASISWA' });
            fetchUsers();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── Reset Device ── */
    const handleResetDevice = async (usr: User) => {
        if (!confirm(`Reset device untuk ${usr.name}?`)) return;
        try {
            await usersApi.resetDevice(usr.id);
            showToast('Device berhasil di-reset', 'success');
            fetchUsers();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── Kirim Info Akun via Email (FIX #2) ── */
    const [emailingId, setEmailingId] = useState<string | null>(null);
    const handleSendAccountInfo = async (usr: User) => {
        if (!confirm(`Kirim informasi akun (email & kredensial) ke ${usr.email}?`)) return;
        setEmailingId(usr.id);
        try {
            await usersApi.sendAccountInfo(usr.id);
            showToast(`Informasi akun dikirim ke ${usr.email}`, 'success');
        } catch (err) {
            const msg = (err as Error).message;
            const friendly = /404|not found|cannot post/i.test(msg)
                ? 'Fitur kirim email akun belum tersedia di server. Hubungi administrator backend.'
                : msg;
            showToast(friendly, 'error', 5000);
        } finally {
            setEmailingId(null);
        }
    };

    /* ── Delete ── */
    const handleDelete = async (usr: User) => {
        if (usr.id === currentUser?.sub) {
            showToast('Tidak bisa menghapus akun Anda sendiri', 'error');
            return;
        }
        if (!confirm(`Hapus akun "${usr.name}"?\n\nAksi ini tidak bisa dibatalkan. Semua data terkait (absensi, nilai, dll.) akan ikut terhapus.`)) return;
        try {
            await usersApi.delete(usr.id);
            showToast('Akun berhasil dihapus', 'success');
            fetchUsers();
        } catch (err) {
            const msg = (err as Error).message;
            const friendly = msg.toLowerCase().includes('internal server error')
                ? 'Gagal menghapus — user mungkin memiliki data terkait yang tidak bisa dihapus. Hubungi administrator backend.'
                : msg;
            showToast(friendly, 'error');
        }
    };

    /* ── Add Single User ── */
    const handleAddUser = async () => {
        if (!addForm.name || !addForm.email || !addForm.password) {
            showToast('Nama, email, dan password wajib diisi', 'error'); return;
        }
        if (NEEDS_EXTENDED(addForm.role)) {
            if (!addForm.nim || !addForm.jurusanId || !addForm.prodiId || !addForm.kelasId || !addForm.gender) {
                showToast('NIM, jurusan, prodi, kelas, dan gender wajib untuk peserta', 'error'); return;
            }
        }
        setAddLoading(true);
        try {
            await authApi.registerAs({
                name: addForm.name, email: addForm.email, password: addForm.password, role: addForm.role,
                ...(NEEDS_EXTENDED(addForm.role) && {
                    nim: addForm.nim,
                    gender: addForm.gender as Gender,
                    jurusanId: addForm.jurusanId,
                    prodiId: addForm.prodiId,
                    kelasId: addForm.kelasId,
                    ...(addForm.kategoriId && { kategoriId: addForm.kategoriId }),
                }),
            });
            showToast(`Akun ${addForm.name} berhasil dibuat`, 'success');
            setAddModal(false);
            setAddForm(EMPTY_FORM);
            fetchUsers();
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setAddLoading(false); }
    };

    /* ── CSV Template ── */
    const downloadTemplate = () => {
        exportToCSV('template_import_mahasiswa.csv', IMPORT_TEMPLATE[0], IMPORT_TEMPLATE.slice(1));
        showToast('Template CSV berhasil diunduh', 'success');
    };

    /* ── Parse CSV ── */
    const handleCSVFile = (file: File) => {
        if (!file.name.match(/\.(csv|txt)$/i)) { showToast('Hanya file CSV yang didukung', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { showToast('File kosong atau format tidak valid', 'error'); return; }
            const header = rows[0].map((h) => h.toLowerCase());
            const idx = (kw: string) => header.findIndex((h) => h.includes(kw));
            const nameIdx    = idx('nama') >= 0 ? idx('nama') : idx('name');
            const emailIdx   = idx('email');
            const passIdx    = idx('password') >= 0 ? idx('password') : idx('pass');
            const roleIdx    = idx('role');
            const nimIdx     = idx('nim');
            const kelasIdx   = idx('kelas');
            const prodiIdx   = idx('prodi');
            const jurusanIdx = idx('jurusan');
            const genderIdx  = idx('gender');
            if (nameIdx < 0 || emailIdx < 0 || passIdx < 0) {
                showToast('Kolom Nama, Email, Password harus ada', 'error'); return;
            }
            const errors: string[] = [];
            const items: BulkCreateUserItem[] = rows.slice(1).filter((r) => r.some((c) => c)).map((r, i) => {
                const rawRole = (r[roleIdx] || '').toUpperCase() as UserRole;
                const role: UserRole = ALL_ROLES.includes(rawRole) ? rawRole : 'MAHASISWA';
                if (!r[nameIdx] || !r[emailIdx] || !r[passIdx]) errors.push(`Baris ${i + 2}: data tidak lengkap`);
                return {
                    name: r[nameIdx] || '', email: r[emailIdx] || '',
                    password: r[passIdx] || '', role,
                    nim:     nimIdx     >= 0 ? r[nimIdx]     : undefined,
                    kelas:   kelasIdx   >= 0 ? r[kelasIdx]   : undefined,
                    prodi:   prodiIdx   >= 0 ? r[prodiIdx]   : undefined,
                    jurusan: jurusanIdx >= 0 ? r[jurusanIdx] : undefined,
                    gender:  genderIdx  >= 0 ? r[genderIdx] as Gender : undefined,
                };
            });
            setImportErrors(errors);
            setImportRows(items);
        };
        reader.readAsText(file, 'UTF-8');
    };

    /* ── Bulk Import ── */
    const handleBulkImport = async () => {
        if (importRows.length === 0) { showToast('Tidak ada data untuk diimpor', 'error'); return; }
        setImportLoading(true);
        let success = 0;
        const failed: string[] = [];
        for (const item of importRows) {
            try {
                await authApi.registerAs({
                    name: item.name, email: item.email, password: item.password,
                    role: item.role ?? 'MAHASISWA',
                    nim: item.nim, kelasId: item.kelas, prodiId: item.prodi,
                    jurusanId: item.jurusan, gender: item.gender,
                });
                success++;
            } catch (err) { failed.push(`${item.email}: ${(err as Error).message}`); }
        }
        setImportLoading(false);
        if (failed.length > 0) {
            showToast(`${success} berhasil, ${failed.length} gagal`, 'info');
            setImportErrors(failed);
        } else {
            showToast(`${success} akun berhasil dibuat`, 'success');
            setImportModal(false);
            setImportRows([]);
        }
        fetchUsers();
    };

    /* ── Export helpers ── */
    const handleExportAttendance = async () => {
        setExportState({ open: false, loading: true });
        try {
            const sessions = await attendanceApi.getAll();
            exportToCSV(
                `export_kehadiran_${new Date().toISOString().slice(0, 10)}.csv`,
                ['Sesi', 'Jumlah Hadir', 'Mulai', 'Selesai'],
                sessions.map((s) => [s.title, s._count?.records ?? 0,
                    new Date(s.startTime).toLocaleString('id-ID'), new Date(s.endTime).toLocaleString('id-ID')]),
            );
            showToast('Export kehadiran berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const handleExportGrades = async () => {
        setExportState({ open: false, loading: true });
        try {
            const grades = await dashboardApi.getAllGrades();
            exportToCSV(
                `export_nilai_${new Date().toISOString().slice(0, 10)}.csv`,
                ['Nama', 'Email', 'Kehadiran', 'Pretest', 'Posttest', 'Resume', 'Hafalan', 'Nilai Akhir', 'Grade'],
                grades.map((g) => [g.student?.name ?? '', g.student?.email ?? '',
                    g.breakdown.attendance?.score ?? '', g.breakdown.pretest?.score ?? '',
                    g.breakdown.posttest?.score ?? '', g.breakdown.resume?.score ?? '',
                    g.breakdown.memorization?.score ?? '', g.finalScore, g.letterGrade]),
            );
            showToast('Export nilai berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const handleExportAll = async () => {
        setExportState({ open: false, loading: true });
        try {
            const allUsers = await usersApi.getAll();
            exportToCSV(
                `export_semua_data_${new Date().toISOString().slice(0, 10)}.csv`,
                ['Nama', 'Email', 'Role', 'NIM', 'Kelas', 'Prodi', 'Jurusan', 'Gender', 'Device ID', 'Kuota Izin', 'Terdaftar'],
                allUsers.map((u) => [u.name, u.email, u.role,
                    u.nim ?? '—', u.kelas?.name ?? '—', u.prodi?.name ?? '—', u.jurusan?.name ?? '—', u.gender ?? '—',
                    u.deviceId ?? '—', u.leaveQuota, new Date(u.createdAt).toLocaleDateString('id-ID')]),
            );
            showToast('Export semua data berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const participantCount = users.filter((u) => PARTICIPANT_ROLES.includes(u.role)).length;
    const needsExtended    = NEEDS_EXTENDED(addForm.role);
    // FIX #3 — opsi dropdown bertingkat (wajib dari Data Referensi).
    const prodiOptions = refProdi.filter((p) => p.jurusanId === addForm.jurusanId);
    const kelasOptions = refKelas.filter((k) => k.prodiId === addForm.prodiId);

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Pengguna</h2>
                    <p className="page-subtitle">
                        {users.length} pengguna &mdash; {participantCount} peserta
                    </p>
                </div>
                <div className="page-actions">
                    <div className="dropdown-wrapper" ref={exportRef}>
                        <button className="btn btn-outline btn-sm"
                            onClick={() => setExportState((s) => ({ ...s, open: !s.open }))}
                            disabled={exportState.loading}>
                            {exportState.loading ? <span className="spinner spinner-sm" /> : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                            )}
                            Export
                            <svg width="10" height="10" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 1.5L6 6.5L11 1.5"/>
                            </svg>
                        </button>
                        {exportState.open && (
                            <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={handleExportAttendance}>Data Kehadiran</button>
                                <button className="dropdown-item" onClick={handleExportGrades}>Data Nilai</button>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" onClick={handleExportAll}>Semua Data Pengguna</button>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => { setImportRows([]); setImportErrors([]); setImportModal(true); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Import CSV
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                        Tambah Akun
                    </button>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="filter-bar">
                <div className="search-input" style={{ flex: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <input type="text" placeholder="Cari nama, email, atau NIM..."
                        value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
                </div>
                <div className="chip-row">
                    {['', ...ALL_ROLES].map((r) => (
                        <button key={r} className={`chip ${roleFilter === r ? 'active' : ''}`}
                            onClick={() => setRoleFilter(r)}>
                            {r || 'Semua'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── User Table ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <p>Tidak ada pengguna ditemukan</p>
                            <small>Coba ubah filter atau tambah akun baru</small>
                        </div>
                    ) : (
                        <>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}>#</th>
                                            <th>Nama</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>NIM/Kelas</th>
                                            <th>Device</th>
                                            <th>Terdaftar</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedUsers.map((usr, i) => {
                                            const rs = ROLE_BADGE_STYLE[usr.role] ?? { bg: '#eee', color: '#666' };
                                            return (
                                                <tr key={usr.id}>
                                                    <td className="text-xs text-muted">{start + i + 1}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                                                background: rs.bg, display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700,
                                                                color: rs.color,
                                                            }}>
                                                                {usr.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{usr.name}</div>
                                                                {usr.gender && (
                                                                    <div className="text-xs text-muted">
                                                                        {usr.gender === 'LAKI_LAKI' ? '♂ L' : '♀ P'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-sm text-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.email}</td>
                                                    <td>
                                                        <span className="badge" style={{ background: rs.bg, color: rs.color }}>{usr.role}</span>
                                                    </td>
                                                    <td>
                                                        {usr.nim ? (
                                                            <div>
                                                                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{usr.nim}</div>
                                                                {usr.kelas && <div className="text-xs text-muted">{usr.kelas.name}</div>}
                                                            </div>
                                                        ) : <span className="text-muted text-xs">—</span>}
                                                    </td>
                                                    <td>
                                                        {PARTICIPANT_ROLES.includes(usr.role) ? (
                                                            usr.deviceId
                                                                ? <span className="badge badge-success">Terikat</span>
                                                                : <span className="badge badge-warning">Bebas</span>
                                                        ) : <span className="text-muted text-xs">—</span>}
                                                    </td>
                                                    <td className="text-xs text-muted">
                                                        {new Date(usr.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-ghost btn-icon-sm" onClick={() => openRoleModal(usr)} title="Ubah Role" style={{ color: 'var(--color-info)' }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                                </svg>
                                                            </button>
                                                            {PARTICIPANT_ROLES.includes(usr.role) && (
                                                                <button className="btn btn-ghost btn-icon-sm" onClick={() => handleResetDevice(usr)} title="Reset Device (lepas ikatan perangkat agar bisa login di HP baru)" style={{ color: 'var(--color-warning)' }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <button className="btn btn-ghost btn-icon-sm" onClick={() => handleSendAccountInfo(usr)} disabled={emailingId === usr.id} title="Kirim informasi akun ke email pengguna" style={{ color: 'var(--color-info)' }}>
                                                                {emailingId === usr.id ? <span className="spinner spinner-sm" /> : (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>
                                                                    </svg>
                                                                )}
                                                            </button>
                                                            <button className="btn btn-ghost btn-icon-sm" onClick={() => handleDelete(usr)} title="Hapus" style={{ color: 'var(--color-danger)' }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Pagination ── */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderTop: '1px solid var(--color-border-light)',
                                flexWrap: 'wrap', gap: 10,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="text-sm text-muted">
                                        {filteredUsers.length === 0 ? '0' : `${start + 1}–${Math.min(start + perPage, filteredUsers.length)}`} dari {filteredUsers.length}
                                    </span>
                                    <select
                                        className="form-select"
                                        style={{ width: 'auto', padding: '4px 28px 4px 10px', fontSize: '0.8125rem' }}
                                        value={perPage}
                                        onChange={(e) => setPerPage(Number(e.target.value))}
                                    >
                                        {PER_PAGE_OPTIONS.map((n) => (
                                            <option key={n} value={n}>{n} / hal</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '4px 10px' }}
                                        onClick={() => setPage(1)}
                                        disabled={safeePage === 1}
                                    >«</button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '4px 10px' }}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={safeePage === 1}
                                    >‹</button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const offset = Math.max(0, Math.min(safeePage - 3, totalPages - 5));
                                        const pg = i + 1 + offset;
                                        return (
                                            <button
                                                key={pg}
                                                className="btn btn-ghost btn-sm"
                                                style={{
                                                    padding: '4px 10px', minWidth: 34,
                                                    background: pg === safeePage ? 'var(--color-navy)' : undefined,
                                                    color: pg === safeePage ? '#fff' : undefined,
                                                    borderRadius: 'var(--radius-md)',
                                                }}
                                                onClick={() => setPage(pg)}
                                            >
                                                {pg}
                                            </button>
                                        );
                                    })}
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '4px 10px' }}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safeePage === totalPages}
                                    >›</button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '4px 10px' }}
                                        onClick={() => setPage(totalPages)}
                                        disabled={safeePage === totalPages}
                                    >»</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modal: Tambah Akun ── */}
            <Modal isOpen={addModal} onClose={() => { setAddModal(false); setAddForm(EMPTY_FORM); }}
                title="Tambah Akun Baru" disableBackdropClose size="lg"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => { setAddModal(false); setAddForm(EMPTY_FORM); }} disabled={addLoading}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddUser} disabled={addLoading}>
                            {addLoading ? <span className="spinner spinner-sm" /> : null}
                            Buat Akun
                        </button>
                    </>
                }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Nama Lengkap <span className="required">*</span></label>
                            <input className="form-input" placeholder="Ahmad Fauzi" value={addForm.name}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role <span className="required">*</span></label>
                            <select className="form-select" value={addForm.role}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, role: e.target.value as UserRole })}>
                                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Email <span className="required">*</span></label>
                            <input className="form-input" type="email" placeholder="contoh@email.com" value={addForm.email}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, email: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password <span className="required">*</span></label>
                            <PasswordInput placeholder="Min. 8 karakter" value={addForm.password}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, password: e.target.value })} />
                        </div>
                    </div>

                    {needsExtended && (
                        <>
                            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 10 }}>
                                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                    Data Akademik — wajib untuk {addForm.role}
                                </p>
                                <p className="text-xs text-muted">Pilih dari data master. Jika belum ada, tambahkan di menu <strong>Data Referensi</strong>.</p>
                            </div>

                            {refLoading && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="spinner spinner-sm" /> <span className="text-sm text-muted">Memuat data referensi…</span>
                                </div>
                            )}
                            {refError && (
                                <div className="warning-banner">
                                    <span>Gagal memuat data referensi: {refError}. Pastikan jurusan/prodi/kelas sudah ada di menu Data Referensi.</span>
                                </div>
                            )}

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">NIM <span className="required">*</span></label>
                                    <input className="form-input" placeholder="220401001" value={addForm.nim}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, nim: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gender <span className="required">*</span></label>
                                    <select className="form-select" value={addForm.gender}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, gender: e.target.value as Gender })}>
                                        <option value="">-- Pilih Gender --</option>
                                        <option value="LAKI_LAKI">Laki-laki</option>
                                        <option value="PEREMPUAN">Perempuan</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Jurusan <span className="required">*</span></label>
                                    <select className="form-select" value={addForm.jurusanId} disabled={refLoading || refJurusan.length === 0}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, jurusanId: e.target.value, prodiId: '', kelasId: '' })}>
                                        <option value="">{refLoading ? '-- Memuat… --' : (refJurusan.length === 0 ? '-- Belum ada jurusan --' : '-- Pilih Jurusan --')}</option>
                                        {refJurusan.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Program Studi <span className="required">*</span></label>
                                    <select className="form-select" value={addForm.prodiId} disabled={!addForm.jurusanId}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, prodiId: e.target.value, kelasId: '' })}>
                                        <option value="">{!addForm.jurusanId ? '-- Pilih jurusan dulu --' : (prodiOptions.length === 0 ? '-- Belum ada prodi --' : '-- Pilih Prodi --')}</option>
                                        {prodiOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Kelas <span className="required">*</span></label>
                                    <select className="form-select" value={addForm.kelasId} disabled={!addForm.prodiId}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, kelasId: e.target.value })}>
                                        <option value="">{!addForm.prodiId ? '-- Pilih prodi dulu --' : (kelasOptions.length === 0 ? '-- Belum ada kelas --' : '-- Pilih Kelas --')}</option>
                                        {kelasOptions.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kategori <span className="text-muted">(opsional)</span></label>
                                    <select className="form-select" value={addForm.kategoriId} disabled={refKategori.length === 0}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, kategoriId: e.target.value })}>
                                        <option value="">{refKategori.length === 0 ? '-- Tidak ada kategori --' : '-- Tidak ada --'}</option>
                                        {refKategori.map((kt) => <option key={kt.id} value={kt.id}>{kt.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* ── Modal: Import CSV ── */}
            <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Import Akun dari CSV"
                disableBackdropClose size="lg"
                footer={
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Template
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-outline btn-sm" onClick={() => setImportModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleBulkImport} disabled={importRows.length === 0 || importLoading}>
                            {importLoading ? <span className="spinner spinner-sm" /> : null}
                            Import {importRows.length > 0 ? `(${importRows.length})` : ''}
                        </button>
                    </>
                }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="info-banner">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>Kolom: <strong>Nama, Email, Password, Role, NIM, Kelas, Prodi, Jurusan, Gender</strong></span>
                    </div>
                    <div className={`dropzone ${dragOver ? 'drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="dropzone-text">{importRows.length > 0 ? `${importRows.length} baris siap diimpor` : 'Klik atau drag file CSV ke sini'}</span>
                        <span className="dropzone-hint">Format: .csv</span>
                        <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = ''; }} />
                    </div>
                    {importRows.length > 0 && (
                        <div className="table-container" style={{ maxHeight: 180 }}>
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Nama</th><th>Email</th><th>Role</th><th>NIM</th><th>Gender</th></tr></thead>
                                <tbody>
                                    {importRows.slice(0, 10).map((r, i) => (
                                        <tr key={i}>
                                            <td className="text-xs text-muted">{i + 1}</td>
                                            <td style={{ fontWeight: 500 }}>{r.name}</td>
                                            <td className="text-sm text-muted">{r.email}</td>
                                            <td><span className="badge badge-navy">{r.role}</span></td>
                                            <td className="text-sm text-muted">{r.nim || '—'}</td>
                                            <td className="text-sm text-muted">{r.gender || '—'}</td>
                                        </tr>
                                    ))}
                                    {importRows.length > 10 && (
                                        <tr><td colSpan={6} className="text-sm text-muted" style={{ textAlign: 'center', padding: '8px' }}>
                                            +{importRows.length - 10} baris lainnya
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {importErrors.length > 0 && (
                        <div className="warning-banner" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <strong>Peringatan ({importErrors.length}):</strong>
                            {importErrors.slice(0, 5).map((err, i) => <span key={i}>• {err}</span>)}
                            {importErrors.length > 5 && <span>... +{importErrors.length - 5} lainnya</span>}
                        </div>
                    )}
                </div>
            </Modal>

            {/* ── Modal: Ubah Role ── */}
            <Modal isOpen={roleModal.open} onClose={() => setRoleModal({ open: false, user: null, selectedRole: 'MAHASISWA' })}
                title="Ubah Role Pengguna" size="sm"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setRoleModal({ open: false, user: null, selectedRole: 'MAHASISWA' })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAssignRole}>Simpan</button>
                    </>
                }>
                {roleModal.user && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-amber-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-amber-dark)', flexShrink: 0 }}>
                                {roleModal.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roleModal.user.name}</div>
                                <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roleModal.user.email}</div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role Baru</label>
                            <select className="form-select" value={roleModal.selectedRole}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setRoleModal({ ...roleModal, selectedRole: e.target.value as UserRole })}>
                                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
