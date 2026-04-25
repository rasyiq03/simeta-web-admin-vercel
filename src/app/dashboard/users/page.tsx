'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { usersApi, authApi, dashboardApi, attendanceApi, exportToCSV, parseCSV } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import PasswordInput from '@/components/PasswordInput';
import type { User, UserRole, BulkCreateUserItem } from '@/types';

interface RoleModalState { open: boolean; user: User | null; selectedRole: UserRole; }
interface AddMenteeForm { name: string; email: string; password: string; role: UserRole; }
interface ExportDropdownState { open: boolean; loading: boolean; }

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR', 'MENTEE'];

const IMPORT_TEMPLATE = [
    ['Nama', 'Email', 'Password', 'Role'],
    ['Ahmad Fauzi', 'ahmad@example.com', 'Password123!', 'MENTEE'],
    ['Siti Aisyah', 'siti@example.com', 'Password123!', 'MENTOR'],
];

const ROLE_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
    ADMIN:   { bg: 'rgba(222,144,42,0.1)',  color: '#B87420' },
    PANITIA: { bg: 'rgba(234,88,12,0.1)',   color: '#EA580C' },
    DOSEN:   { bg: 'rgba(37,99,235,0.1)',   color: '#2563EB' },
    MENTOR:  { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
    MENTEE:  { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED' },
};

export default function UsersPage(): React.JSX.Element {
    const [users, setUsers]                       = useState<User[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [search, setSearch]                     = useState('');
    const [roleFilter, setRoleFilter]             = useState('');
    const [roleModal, setRoleModal]               = useState<RoleModalState>({ open: false, user: null, selectedRole: 'MENTEE' });
    const [addModal, setAddModal]                 = useState(false);
    const [importModal, setImportModal]           = useState(false);
    const [addForm, setAddForm]                   = useState<AddMenteeForm>({ name: '', email: '', password: '', role: 'MENTEE' });
    const [importRows, setImportRows]             = useState<BulkCreateUserItem[]>([]);
    const [importErrors, setImportErrors]         = useState<string[]>([]);
    const [importLoading, setImportLoading]       = useState(false);
    const [exportState, setExportState]           = useState<ExportDropdownState>({ open: false, loading: false });
    const [dragOver, setDragOver]                 = useState(false);
    const fileInputRef                            = useRef<HTMLInputElement>(null);
    const exportRef                               = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await usersApi.getAll();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    /* Close export dropdown on outside click */
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
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = !roleFilter || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    /* ── Assign Role ── */
    const openRoleModal = (usr: User) => setRoleModal({ open: true, user: usr, selectedRole: usr.role });

    const handleAssignRole = async () => {
        if (!roleModal.user) return;
        try {
            await usersApi.assignRole(roleModal.user.id, roleModal.selectedRole);
            showToast('Role berhasil diperbarui', 'success');
            setRoleModal({ open: false, user: null, selectedRole: 'MENTEE' });
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

    /* ── Delete ── */
    const handleDelete = async (usr: User) => {
        if (!confirm(`Hapus akun "${usr.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
        try {
            await usersApi.delete(usr.id);
            showToast('Akun berhasil dihapus', 'success');
            fetchUsers();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── Add Single User ── */
    const handleAddMentee = async () => {
        if (!addForm.name || !addForm.email || !addForm.password) {
            showToast('Nama, email, dan password wajib diisi', 'error');
            return;
        }
        try {
            await authApi.register({ name: addForm.name, email: addForm.email, password: addForm.password });
            if (addForm.role !== 'MENTEE') {
                const allUsers = await usersApi.getAll();
                const created = allUsers.find((u) => u.email === addForm.email);
                if (created) await usersApi.assignRole(created.id, addForm.role);
            }
            showToast(`Akun ${addForm.name} berhasil dibuat`, 'success');
            setAddModal(false);
            setAddForm({ name: '', email: '', password: '', role: 'MENTEE' });
            fetchUsers();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── Download Import Template ── */
    const downloadTemplate = () => {
        exportToCSV('template_import_mahasiswa.csv', IMPORT_TEMPLATE[0], IMPORT_TEMPLATE.slice(1));
        showToast('Template CSV berhasil diunduh', 'success');
    };

    /* ── Parse CSV File ── */
    const handleCSVFile = (file: File) => {
        if (!file.name.match(/\.(csv|txt)$/i)) {
            showToast('Hanya file CSV yang didukung', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { showToast('File kosong atau format tidak valid', 'error'); return; }
            const header = rows[0].map((h) => h.toLowerCase());
            const nameIdx  = header.findIndex((h) => h.includes('nama') || h === 'name');
            const emailIdx = header.findIndex((h) => h.includes('email'));
            const passIdx  = header.findIndex((h) => h.includes('password') || h.includes('pass'));
            const roleIdx  = header.findIndex((h) => h.includes('role'));
            if (nameIdx < 0 || emailIdx < 0 || passIdx < 0) {
                showToast('Kolom Nama, Email, Password harus ada', 'error');
                return;
            }
            const errors: string[] = [];
            const items: BulkCreateUserItem[] = rows.slice(1)
                .filter((r) => r.some((c) => c))
                .map((r, i) => {
                    const name  = r[nameIdx]  || '';
                    const email = r[emailIdx] || '';
                    const pass  = r[passIdx]  || '';
                    const rawRole = (r[roleIdx] || '').toUpperCase() as UserRole;
                    const role: UserRole = ROLE_OPTIONS.includes(rawRole) ? rawRole : 'MENTEE';
                    if (!name || !email || !pass) errors.push(`Baris ${i + 2}: data tidak lengkap`);
                    return { name, email, password: pass, role };
                });
            setImportErrors(errors);
            setImportRows(items);
        };
        reader.readAsText(file, 'UTF-8');
    };

    /* ── Bulk Import Submit ── */
    const handleBulkImport = async () => {
        if (importRows.length === 0) { showToast('Tidak ada data untuk diimpor', 'error'); return; }
        setImportLoading(true);
        let success = 0; const failed: string[] = [];
        for (const item of importRows) {
            try {
                await authApi.register({ name: item.name, email: item.email, password: item.password });
                if (item.role && item.role !== 'MENTEE') {
                    const all = await usersApi.getAll();
                    const usr = all.find((u) => u.email === item.email);
                    if (usr) await usersApi.assignRole(usr.id, item.role);
                }
                success++;
            } catch (err) {
                failed.push(`${item.email}: ${(err as Error).message}`);
            }
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

    /* ── Export Functions ── */
    const handleExportAttendance = async () => {
        setExportState({ open: false, loading: true });
        try {
            const sessions = await attendanceApi.getAll();
            const headers = ['Sesi', 'Jumlah Hadir', 'Mulai', 'Selesai'];
            const rows = sessions.map((s) => [
                s.title,
                s._count?.records ?? 0,
                new Date(s.startTime).toLocaleString('id-ID'),
                new Date(s.endTime).toLocaleString('id-ID'),
            ]);
            exportToCSV(`export_kehadiran_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
            showToast('Export kehadiran berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const handleExportGrades = async () => {
        setExportState({ open: false, loading: true });
        try {
            const grades = await dashboardApi.getAllGrades();
            const headers = ['Nama', 'Email', 'Kehadiran', 'Pretest', 'Posttest', 'Resume', 'Hafalan', 'Nilai Akhir', 'Grade'];
            const rows = grades.map((g) => [
                g.student?.name ?? '',
                g.student?.email ?? '',
                g.breakdown.attendance?.score ?? '',
                g.breakdown.pretest?.score ?? '',
                g.breakdown.posttest?.score ?? '',
                g.breakdown.resume?.score ?? '',
                g.breakdown.memorization?.score ?? '',
                g.finalScore,
                g.letterGrade,
            ]);
            exportToCSV(`export_nilai_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
            showToast('Export nilai berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const handleExportAll = async () => {
        setExportState({ open: false, loading: true });
        try {
            const allUsers = await usersApi.getAll();
            const headers = ['Nama', 'Email', 'Role', 'Device ID', 'Kuota Izin', 'Terdaftar'];
            const rows = allUsers.map((u) => [
                u.name, u.email, u.role,
                u.deviceId ?? '—',
                u.leaveQuota,
                new Date(u.createdAt).toLocaleDateString('id-ID'),
            ]);
            exportToCSV(`export_semua_data_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
            showToast('Export semua data berhasil', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExportState({ open: false, loading: false }); }
    };

    const menteeCount = users.filter((u) => u.role === 'MENTEE').length;

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Pengguna</h2>
                    <p className="page-subtitle">
                        {users.length} pengguna terdaftar &mdash; {menteeCount} mahasiswa
                    </p>
                </div>
                <div className="page-actions">
                    {/* Export Dropdown */}
                    <div className="dropdown-wrapper" ref={exportRef}>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setExportState((s) => ({ ...s, open: !s.open }))}
                            disabled={exportState.loading}
                        >
                            {exportState.loading ? (
                                <span className="spinner spinner-sm" />
                            ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                            )}
                            Export
                            <svg width="11" height="11" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 1.5L6 6.5L11 1.5"/>
                            </svg>
                        </button>
                        {exportState.open && (
                            <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={handleExportAttendance}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    Data Kehadiran
                                </button>
                                <button className="dropdown-item" onClick={handleExportGrades}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
                                    </svg>
                                    Data Nilai
                                </button>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" onClick={handleExportAll}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                                    </svg>
                                    Semua Data Pengguna
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Import Button */}
                    <button className="btn btn-excel btn-sm" onClick={() => { setImportRows([]); setImportErrors([]); setImportModal(true); }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Import CSV
                    </button>

                    {/* Add Mentee Button */}
                    <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <line x1="19" y1="8" x2="19" y2="14"/>
                            <line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                        Tambah Akun
                    </button>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="filter-bar">
                <div className="search-input">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Cari nama atau email..."
                        value={search}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['', ...ROLE_OPTIONS].map((r) => (
                        <button
                            key={r}
                            className={`chip ${roleFilter === r ? 'active' : ''}`}
                            onClick={() => setRoleFilter(r)}
                        >
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
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <p>Tidak ada pengguna ditemukan</p>
                            <small>Coba ubah filter atau tambah akun baru</small>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Nama</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Device</th>
                                        <th>Terdaftar</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((usr, i) => {
                                        const rs = ROLE_BADGE_STYLE[usr.role] ?? { bg: '#eee', color: '#666' };
                                        return (
                                            <tr key={usr.id}>
                                                <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{
                                                            width: 32, height: 32, borderRadius: '50%',
                                                            background: `linear-gradient(135deg, ${rs.bg.replace('0.1', '0.4')}, ${rs.bg})`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.8125rem', fontWeight: 700, color: rs.color,
                                                            flexShrink: 0,
                                                        }}>
                                                            {usr.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{usr.name}</span>
                                                    </div>
                                                </td>
                                                <td className="text-sm text-muted">{usr.email}</td>
                                                <td>
                                                    <span className="badge" style={{ background: rs.bg, color: rs.color }}>
                                                        {usr.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    {(usr.role === 'MENTOR' || usr.role === 'MENTEE') ? (
                                                        usr.deviceId ? (
                                                            <span className="badge badge-success" title={usr.deviceId}>Terikat</span>
                                                        ) : (
                                                            <span className="badge badge-warning">Bebas</span>
                                                        )
                                                    ) : (
                                                        <span className="text-muted text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="text-xs text-muted">
                                                    {new Date(usr.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-icon-sm" onClick={() => openRoleModal(usr)} title="Ubah Role"
                                                            style={{ color: 'var(--color-info)' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                            </svg>
                                                        </button>
                                                        {(usr.role === 'MENTOR' || usr.role === 'MENTEE') && (
                                                            <button className="btn btn-ghost btn-icon-sm" onClick={() => handleResetDevice(usr)} title="Reset Device"
                                                                style={{ color: 'var(--color-warning)' }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="23 4 23 10 17 10"/>
                                                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button className="btn btn-ghost btn-icon-sm" onClick={() => handleDelete(usr)} title="Hapus"
                                                            style={{ color: 'var(--color-danger)' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"/>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
                    )}
                </div>
            </div>

            {/* ── Modal: Tambah Akun ── */}
            <Modal
                isOpen={addModal}
                onClose={() => setAddModal(false)}
                title="Tambah Akun Baru"
                disableBackdropClose
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setAddModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddMentee}>Buat Akun</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Nama Lengkap <span className="required">*</span></label>
                        <input className="form-input" placeholder="Contoh: Ahmad Fauzi"
                            value={addForm.name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email <span className="required">*</span></label>
                        <input className="form-input" type="email" placeholder="contoh@email.com"
                            value={addForm.email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password <span className="required">*</span></label>
                        <PasswordInput
                            placeholder="Min. 8 karakter, huruf besar, angka, simbol"
                            value={addForm.password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddForm({ ...addForm, password: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <select className="form-select" value={addForm.role}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddForm({ ...addForm, role: e.target.value as UserRole })}>
                            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Import CSV ── */}
            <Modal
                isOpen={importModal}
                onClose={() => setImportModal(false)}
                title="Import Akun dari CSV"
                disableBackdropClose
                size="lg"
                footer={
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Unduh Template
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-outline btn-sm" onClick={() => setImportModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleBulkImport} disabled={importRows.length === 0 || importLoading}>
                            {importLoading ? <span className="spinner spinner-sm" /> : null}
                            Import {importRows.length > 0 ? `(${importRows.length})` : ''}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="info-banner">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>Format CSV: <strong>Nama, Email, Password, Role</strong>. Role default = MENTEE. Unduh template untuk contoh format.</span>
                    </div>

                    {/* Dropzone */}
                    <div
                        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            const file = e.dataTransfer.files[0];
                            if (file) handleCSVFile(file);
                        }}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span className="dropzone-text">
                            {importRows.length > 0
                                ? `${importRows.length} data siap diimpor`
                                : 'Klik atau drag file CSV ke sini'}
                        </span>
                        <span className="dropzone-hint">Format: .csv (dibuka dari Excel pun bisa)</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.txt"
                            style={{ display: 'none' }}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const file = e.target.files?.[0];
                                if (file) handleCSVFile(file);
                                e.target.value = '';
                            }}
                        />
                    </div>

                    {/* Preview */}
                    {importRows.length > 0 && (
                        <div className="table-container" style={{ maxHeight: 200 }}>
                            <table className="data-table">
                                <thead>
                                    <tr><th>#</th><th>Nama</th><th>Email</th><th>Role</th></tr>
                                </thead>
                                <tbody>
                                    {importRows.slice(0, 10).map((r, i) => (
                                        <tr key={i}>
                                            <td className="text-xs text-muted">{i + 1}</td>
                                            <td style={{ fontWeight: 500 }}>{r.name}</td>
                                            <td className="text-sm text-muted">{r.email}</td>
                                            <td><span className="badge badge-navy">{r.role}</span></td>
                                        </tr>
                                    ))}
                                    {importRows.length > 10 && (
                                        <tr>
                                            <td colSpan={4} className="text-sm text-muted" style={{ textAlign: 'center' }}>
                                                ... dan {importRows.length - 10} data lainnya
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Errors */}
                    {importErrors.length > 0 && (
                        <div className="warning-banner" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <strong>Peringatan ({importErrors.length}):</strong>
                            {importErrors.slice(0, 5).map((err, i) => <span key={i}>• {err}</span>)}
                            {importErrors.length > 5 && <span>... dan {importErrors.length - 5} lainnya</span>}
                        </div>
                    )}
                </div>
            </Modal>

            {/* ── Modal: Assign Role ── */}
            <Modal
                isOpen={roleModal.open}
                onClose={() => setRoleModal({ open: false, user: null, selectedRole: 'MENTEE' })}
                title="Ubah Role Pengguna"
                size="sm"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setRoleModal({ open: false, user: null, selectedRole: 'MENTEE' })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAssignRole}>Simpan</button>
                    </>
                }
            >
                {roleModal.user && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-amber-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-amber-dark)' }}>
                                {roleModal.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{roleModal.user.name}</div>
                                <div className="text-sm text-muted">{roleModal.user.email}</div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role Baru</label>
                            <select className="form-select" value={roleModal.selectedRole}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                    setRoleModal({ ...roleModal, selectedRole: e.target.value as UserRole })
                                }>
                                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
