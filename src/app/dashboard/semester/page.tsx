'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
    academicYearApi,
    semesterApi,
    enrollmentApi,
    usersApi,
} from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type {
    AcademicYear,
    Semester,
    Enrollment,
    EnrollmentMahasiswaType,
    SemesterTerm,
    User,
} from '@/types';

type TabKey = 'academic-year' | 'semester' | 'enrollment';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'academic-year', label: 'Tahun Ajaran' },
    { key: 'semester',      label: 'Semester' },
    { key: 'enrollment',    label: 'Peserta per Semester' },
];

const TERMS: SemesterTerm[] = ['GANJIL', 'GENAP', 'PENDEK'];
const MAHASISWA_TYPES: EnrollmentMahasiswaType[] = ['REGULAR', 'MENTOR', 'MENTEE'];

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export default function SemesterPage(): React.JSX.Element {
    const [tab, setTab] = useState<TabKey>('academic-year');
    const { showToast } = useToast();

    // ── Academic Year ──
    const [yearList, setYearList] = useState<AcademicYear[]>([]);
    const [yearModal, setYearModal] = useState(false);
    const [editYear, setEditYear] = useState<AcademicYear | null>(null);
    const [yearForm, setYearForm] = useState({
        code: '', name: '', startDate: '', endDate: '',
    });
    const [savingYear, setSavingYear] = useState(false);

    // ── Semester ──
    const [semesterList, setSemesterList] = useState<Semester[]>([]);
    const [semesterModal, setSemesterModal] = useState(false);
    const [editSemester, setEditSemester] = useState<Semester | null>(null);
    const [semesterForm, setSemesterForm] = useState<{
        academicYearId: string;
        code: string;
        name: string;
        term: SemesterTerm;
        startDate: string;
        endDate: string;
        isActive: boolean;
    }>({
        academicYearId: '',
        code: '',
        name: '',
        term: 'GANJIL',
        startDate: '',
        endDate: '',
        isActive: false,
    });
    const [savingSemester, setSavingSemester] = useState(false);

    // ── Enrollment ──
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
    const [enrollmentList, setEnrollmentList] = useState<Enrollment[]>([]);
    const [enrollModal, setEnrollModal] = useState(false);
    const [mahasiswaUsers, setMahasiswaUsers] = useState<User[]>([]);
    const [enrollForm, setEnrollForm] = useState<{
        userId: string;
        mahasiswaType: EnrollmentMahasiswaType;
    }>({ userId: '', mahasiswaType: 'REGULAR' });
    const [savingEnroll, setSavingEnroll] = useState(false);

    // Copy from semester
    const [copyModal, setCopyModal] = useState(false);
    const [copyForm, setCopyForm] = useState({
        sourceSemesterId: '', onlyActive: true,
    });
    const [copying, setCopying] = useState(false);

    // ── Shared state ──
    const [loading, setLoading] = useState(false);

    // ── Loaders ──
    const loadYears = useCallback(async () => {
        setLoading(true);
        try { setYearList(await academicYearApi.list()); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    const loadSemesters = useCallback(async () => {
        setLoading(true);
        try { setSemesterList(await semesterApi.list()); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    const loadEnrollments = useCallback(async (semId: string) => {
        if (!semId) { setEnrollmentList([]); return; }
        setLoading(true);
        try { setEnrollmentList(await enrollmentApi.list(semId)); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    const loadMahasiswaUsers = useCallback(async () => {
        try {
            const users = await usersApi.getAll();
            setMahasiswaUsers(users.filter((u) => u.role === 'MENTEE' || u.role === 'MENTOR' || u.role === 'PESERTA'));
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (tab === 'academic-year') loadYears();
        else if (tab === 'semester') { loadYears(); loadSemesters(); }
        else if (tab === 'enrollment') {
            loadSemesters();
            loadMahasiswaUsers();
            if (selectedSemesterId) loadEnrollments(selectedSemesterId);
        }
    }, [tab, selectedSemesterId, loadYears, loadSemesters, loadEnrollments, loadMahasiswaUsers]);

    // Auto-select semester aktif saat tab Enrollment dibuka pertama kali.
    useEffect(() => {
        if (tab === 'enrollment' && !selectedSemesterId && semesterList.length > 0) {
            const active = semesterList.find((s) => s.isActive) ?? semesterList[0];
            setSelectedSemesterId(active.id);
        }
    }, [tab, selectedSemesterId, semesterList]);

    // ── Academic Year actions ──
    const openYearModal = (y?: AcademicYear) => {
        setEditYear(y ?? null);
        setYearForm({
            code: y?.code ?? '',
            name: y?.name ?? '',
            startDate: y?.startDate?.slice(0, 10) ?? '',
            endDate: y?.endDate?.slice(0, 10) ?? '',
        });
        setYearModal(true);
    };

    const saveYear = async () => {
        if (!yearForm.code || !yearForm.name || !yearForm.startDate || !yearForm.endDate) {
            showToast('Semua field wajib diisi', 'error');
            return;
        }
        setSavingYear(true);
        try {
            if (editYear) {
                await academicYearApi.update(editYear.id, {
                    name: yearForm.name,
                    startDate: yearForm.startDate,
                    endDate: yearForm.endDate,
                });
                showToast('Tahun ajaran diperbarui', 'success');
            } else {
                await academicYearApi.create(yearForm);
                showToast('Tahun ajaran dibuat', 'success');
            }
            setYearModal(false);
            await loadYears();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setSavingYear(false);
        }
    };

    const deleteYear = async (y: AcademicYear) => {
        if (!confirm(`Hapus tahun ajaran "${y.code}"? Operasi gagal kalau masih punya semester.`)) return;
        try {
            await academicYearApi.delete(y.id);
            showToast('Tahun ajaran dihapus', 'success');
            await loadYears();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    // ── Semester actions ──
    const openSemesterModal = (s?: Semester) => {
        setEditSemester(s ?? null);
        setSemesterForm({
            academicYearId: s?.academicYearId ?? (yearList[0]?.id ?? ''),
            code: s?.code ?? '',
            name: s?.name ?? '',
            term: s?.term ?? 'GANJIL',
            startDate: s?.startDate?.slice(0, 10) ?? '',
            endDate: s?.endDate?.slice(0, 10) ?? '',
            isActive: s?.isActive ?? false,
        });
        setSemesterModal(true);
    };

    const saveSemester = async () => {
        if (!semesterForm.academicYearId || !semesterForm.code || !semesterForm.name
            || !semesterForm.startDate || !semesterForm.endDate) {
            showToast('Semua field wajib diisi', 'error');
            return;
        }
        setSavingSemester(true);
        try {
            if (editSemester) {
                await semesterApi.update(editSemester.id, {
                    name: semesterForm.name,
                    startDate: semesterForm.startDate,
                    endDate: semesterForm.endDate,
                });
                showToast('Semester diperbarui', 'success');
            } else {
                await semesterApi.create(semesterForm);
                showToast('Semester dibuat', 'success');
            }
            setSemesterModal(false);
            await loadSemesters();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setSavingSemester(false);
        }
    };

    const activateSemester = async (s: Semester) => {
        if (!confirm(
            `Aktifkan "${s.code}"? Semester lain yang sedang aktif akan otomatis dinon-aktifkan.`,
        )) return;
        try {
            await semesterApi.activate(s.id);
            showToast(`Semester "${s.code}" diaktifkan`, 'success');
            await loadSemesters();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const deleteSemester = async (s: Semester) => {
        if (!confirm(
            `Hapus semester "${s.code}"? Gagal kalau masih punya enrollment / aktivitas.`,
        )) return;
        try {
            await semesterApi.delete(s.id);
            showToast('Semester dihapus', 'success');
            await loadSemesters();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    // ── Enrollment actions ──
    const openEnrollModal = () => {
        if (!selectedSemesterId) {
            showToast('Pilih semester dulu', 'error');
            return;
        }
        setEnrollForm({ userId: '', mahasiswaType: 'REGULAR' });
        setEnrollModal(true);
    };

    const saveEnroll = async () => {
        if (!enrollForm.userId) {
            showToast('Pilih user dulu', 'error');
            return;
        }
        setSavingEnroll(true);
        try {
            await enrollmentApi.create({
                userId: enrollForm.userId,
                semesterId: selectedSemesterId,
                mahasiswaType: enrollForm.mahasiswaType,
            });
            showToast('Peserta enrolled', 'success');
            setEnrollModal(false);
            await loadEnrollments(selectedSemesterId);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setSavingEnroll(false);
        }
    };

    const updateEnrollmentType = async (e: Enrollment, mahasiswaType: EnrollmentMahasiswaType) => {
        try {
            await enrollmentApi.update(e.id, { mahasiswaType });
            showToast('Tipe peserta diperbarui', 'success');
            await loadEnrollments(selectedSemesterId);
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const toggleEnrollmentActive = async (e: Enrollment) => {
        try {
            await enrollmentApi.update(e.id, { isActive: !e.isActive });
            showToast(`Enrollment di-${!e.isActive ? 'aktifkan' : 'non-aktifkan'}`, 'success');
            await loadEnrollments(selectedSemesterId);
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const deleteEnrollment = async (e: Enrollment) => {
        if (!confirm(`Hapus enrollment "${e.user?.name}" dari semester ini?`)) return;
        try {
            await enrollmentApi.delete(e.id);
            showToast('Enrollment dihapus', 'success');
            await loadEnrollments(selectedSemesterId);
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const openCopyModal = () => {
        if (!selectedSemesterId) {
            showToast('Pilih semester target dulu', 'error');
            return;
        }
        setCopyForm({ sourceSemesterId: '', onlyActive: true });
        setCopyModal(true);
    };

    const runCopy = async () => {
        if (!copyForm.sourceSemesterId) {
            showToast('Pilih semester sumber', 'error');
            return;
        }
        if (copyForm.sourceSemesterId === selectedSemesterId) {
            showToast('Semester sumber dan target tidak boleh sama', 'error');
            return;
        }
        setCopying(true);
        try {
            const res = await enrollmentApi.copyFromSemester({
                sourceSemesterId: copyForm.sourceSemesterId,
                targetSemesterId: selectedSemesterId,
                onlyActive: copyForm.onlyActive,
            });
            showToast(
                `Berhasil copy ${res.created} peserta dari ${res.copiedFrom} (${res.skipped} skip karena sudah ada)`,
                'success',
            );
            setCopyModal(false);
            await loadEnrollments(selectedSemesterId);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setCopying(false);
        }
    };

    const selectedSemester = semesterList.find((s) => s.id === selectedSemesterId);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Semester</h2>
                    <p className="page-subtitle">Kelola tahun ajaran, semester, dan daftar peserta Metagama per semester.</p>
                </div>
                <div className="page-actions">
                    {tab === 'academic-year' && (
                        <button className="btn btn-primary btn-sm" onClick={() => openYearModal()}>
                            + Tambah Tahun Ajaran
                        </button>
                    )}
                    {tab === 'semester' && (
                        <button className="btn btn-primary btn-sm" onClick={() => openSemesterModal()}>
                            + Tambah Semester
                        </button>
                    )}
                    {tab === 'enrollment' && selectedSemesterId && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={openCopyModal}>
                                Copy dari Semester Lain
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={openEnrollModal}>
                                + Enroll Peserta
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-nav" style={{ marginBottom: 20 }}>
                {TABS.map((t) => (
                    <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="empty-state" style={{ minHeight: 200 }}>
                    <div className="spinner spinner-lg" />
                </div>
            )}

            {/* ── Academic Year tab ── */}
            {!loading && tab === 'academic-year' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {yearList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada tahun ajaran</p></div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th><th>Kode</th><th>Nama</th><th>Mulai</th><th>Selesai</th><th>Jumlah Semester</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {yearList.map((y, i) => (
                                        <tr key={y.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{y.code}</td>
                                            <td className="text-sm">{y.name}</td>
                                            <td className="text-sm text-muted">{fmtDate(y.startDate)}</td>
                                            <td className="text-sm text-muted">{fmtDate(y.endDate)}</td>
                                            <td className="text-sm text-muted">{y._count?.semesters ?? y.semesters?.length ?? 0}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openYearModal(y)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteYear(y)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Semester tab ── */}
            {!loading && tab === 'semester' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {semesterList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada semester. Buat tahun ajaran terlebih dahulu.</p></div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th><th>Kode</th><th>Nama</th><th>Term</th><th>Tahun Ajaran</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Statistik</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {semesterList.map((s, i) => (
                                        <tr key={s.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{s.code}</td>
                                            <td className="text-sm">{s.name}</td>
                                            <td><span className="text-xs" style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-surface-2)' }}>{s.term}</span></td>
                                            <td className="text-sm text-muted">{s.academicYear?.code ?? '—'}</td>
                                            <td className="text-sm text-muted">{fmtDate(s.startDate)}</td>
                                            <td className="text-sm text-muted">{fmtDate(s.endDate)}</td>
                                            <td>
                                                {s.isActive ? (
                                                    <span className="text-xs" style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-success)', color: 'white', fontWeight: 600 }}>
                                                        AKTIF
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted">tidak aktif</span>
                                                )}
                                            </td>
                                            <td className="text-xs text-muted">
                                                {s._count?.enrollments ?? 0} peserta<br/>
                                                {s._count?.attendanceSessions ?? 0} absensi · {s._count?.quizzes ?? 0} kuis
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {!s.isActive && (
                                                        <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-success)' }} onClick={() => activateSemester(s)} title="Aktifkan">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                                        </button>
                                                    )}
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openSemesterModal(s)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteSemester(s)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Enrollment tab ── */}
            {!loading && tab === 'enrollment' && (
                <>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label className="form-label" style={{ margin: 0 }}>Semester:</label>
                            <select
                                className="form-input"
                                style={{ maxWidth: 360 }}
                                value={selectedSemesterId}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedSemesterId(e.target.value)}
                            >
                                <option value="">— Pilih semester —</option>
                                {semesterList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.code} {s.isActive ? '(AKTIF)' : ''} — {s.name}
                                    </option>
                                ))}
                            </select>
                            {selectedSemester && (
                                <span className="text-sm text-muted">
                                    {fmtDate(selectedSemester.startDate)} – {fmtDate(selectedSemester.endDate)}
                                </span>
                            )}
                        </div>
                    </div>

                    {selectedSemesterId && (
                        <div className="card">
                            <div className="card-body" style={{ padding: 0 }}>
                                {enrollmentList.length === 0 ? (
                                    <div className="empty-state">
                                        <p>Belum ada peserta di semester ini</p>
                                        <p className="text-sm text-muted">Klik &quot;Enroll Peserta&quot; atau &quot;Copy dari Semester Lain&quot;.</p>
                                    </div>
                                ) : (
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>#</th><th>Nama</th><th>Email / NIM</th><th>Tipe Peserta</th><th>Status</th><th>Catatan</th><th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {enrollmentList.map((e, i) => (
                                                <tr key={e.id} style={{ opacity: e.isActive ? 1 : 0.5 }}>
                                                    <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                    <td style={{ fontWeight: 600 }}>{e.user?.name ?? '—'}</td>
                                                    <td className="text-xs text-muted">
                                                        {e.user?.email}<br/>
                                                        {e.user?.nim && <>NIM: {e.user.nim}</>}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="form-input"
                                                            style={{ minWidth: 110, padding: '4px 8px', fontSize: '0.8rem' }}
                                                            value={e.mahasiswaType}
                                                            onChange={(ev: ChangeEvent<HTMLSelectElement>) => updateEnrollmentType(e, ev.target.value as EnrollmentMahasiswaType)}
                                                        >
                                                            {MAHASISWA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => toggleEnrollmentActive(e)}
                                                            title="Toggle aktif"
                                                        >
                                                            {e.isActive
                                                                ? <span className="text-xs" style={{ color: 'var(--color-success)' }}>● Aktif</span>
                                                                : <span className="text-xs text-muted">○ Non-aktif</span>}
                                                        </button>
                                                    </td>
                                                    <td className="text-xs text-muted">{e.notes ?? '—'}</td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteEnrollment(e)} title="Hapus">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Year Modal ── */}
            <Modal
                isOpen={yearModal}
                onClose={() => setYearModal(false)}
                title={editYear ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
                footer={
                    <>
                        <button className="btn btn-ghost" onClick={() => setYearModal(false)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveYear} disabled={savingYear}>
                            {savingYear ? 'Menyimpan…' : 'Simpan'}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Kode (YYYY/YYYY)</label>
                    <input
                        className="form-input"
                        placeholder="2026/2027"
                        value={yearForm.code}
                        disabled={!!editYear}
                        onChange={(e) => setYearForm((f) => ({ ...f, code: e.target.value }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Nama</label>
                    <input
                        className="form-input"
                        placeholder="Tahun Ajaran 2026/2027"
                        value={yearForm.name}
                        onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Tanggal Mulai</label>
                        <input
                            type="date"
                            className="form-input"
                            value={yearForm.startDate}
                            onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tanggal Selesai</label>
                        <input
                            type="date"
                            className="form-input"
                            value={yearForm.endDate}
                            onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* ── Semester Modal ── */}
            <Modal
                isOpen={semesterModal}
                onClose={() => setSemesterModal(false)}
                title={editSemester ? 'Edit Semester' : 'Tambah Semester'}
                size="lg"
                footer={
                    <>
                        <button className="btn btn-ghost" onClick={() => setSemesterModal(false)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveSemester} disabled={savingSemester}>
                            {savingSemester ? 'Menyimpan…' : 'Simpan'}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Tahun Ajaran</label>
                    <select
                        className="form-input"
                        value={semesterForm.academicYearId}
                        disabled={!!editSemester}
                        onChange={(e) => setSemesterForm((f) => ({ ...f, academicYearId: e.target.value }))}
                    >
                        <option value="">— Pilih tahun ajaran —</option>
                        {yearList.map((y) => <option key={y.id} value={y.id}>{y.code} — {y.name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Kode</label>
                        <input
                            className="form-input"
                            placeholder="2026-2027-GANJIL"
                            value={semesterForm.code}
                            disabled={!!editSemester}
                            onChange={(e) => setSemesterForm((f) => ({ ...f, code: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Term</label>
                        <select
                            className="form-input"
                            value={semesterForm.term}
                            disabled={!!editSemester}
                            onChange={(e) => setSemesterForm((f) => ({ ...f, term: e.target.value as SemesterTerm }))}
                        >
                            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Nama</label>
                    <input
                        className="form-input"
                        placeholder="Semester Ganjil 2026/2027"
                        value={semesterForm.name}
                        onChange={(e) => setSemesterForm((f) => ({ ...f, name: e.target.value }))}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Tanggal Mulai</label>
                        <input
                            type="date"
                            className="form-input"
                            value={semesterForm.startDate}
                            onChange={(e) => setSemesterForm((f) => ({ ...f, startDate: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tanggal Selesai</label>
                        <input
                            type="date"
                            className="form-input"
                            value={semesterForm.endDate}
                            onChange={(e) => setSemesterForm((f) => ({ ...f, endDate: e.target.value }))}
                        />
                    </div>
                </div>
                {!editSemester && (
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={semesterForm.isActive}
                                onChange={(e) => setSemesterForm((f) => ({ ...f, isActive: e.target.checked }))}
                            />
                            <span className="text-sm">Aktifkan langsung (semester lain otomatis dinon-aktifkan)</span>
                        </label>
                    </div>
                )}
            </Modal>

            {/* ── Enroll Modal ── */}
            <Modal
                isOpen={enrollModal}
                onClose={() => setEnrollModal(false)}
                title="Enroll Peserta ke Semester"
                footer={
                    <>
                        <button className="btn btn-ghost" onClick={() => setEnrollModal(false)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveEnroll} disabled={savingEnroll}>
                            {savingEnroll ? 'Menyimpan…' : 'Enroll'}
                        </button>
                    </>
                }
            >
                <div className="info-banner" style={{ marginBottom: 12 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Enroll ke semester <strong>{selectedSemester?.code}</strong></span>
                </div>
                <div className="form-group">
                    <label className="form-label">User</label>
                    <select
                        className="form-input"
                        value={enrollForm.userId}
                        onChange={(e) => setEnrollForm((f) => ({ ...f, userId: e.target.value }))}
                    >
                        <option value="">— Pilih user —</option>
                        {mahasiswaUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Tipe Peserta di Semester Ini</label>
                    <select
                        className="form-input"
                        value={enrollForm.mahasiswaType}
                        onChange={(e) => setEnrollForm((f) => ({ ...f, mahasiswaType: e.target.value as EnrollmentMahasiswaType }))}
                    >
                        {MAHASISWA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </Modal>

            {/* ── Copy from Semester Modal ── */}
            <Modal
                isOpen={copyModal}
                onClose={() => setCopyModal(false)}
                title="Copy Peserta dari Semester Lain"
                footer={
                    <>
                        <button className="btn btn-ghost" onClick={() => setCopyModal(false)}>Batal</button>
                        <button className="btn btn-primary" onClick={runCopy} disabled={copying}>
                            {copying ? 'Memproses…' : 'Copy'}
                        </button>
                    </>
                }
            >
                <div className="info-banner" style={{ marginBottom: 12 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Copy daftar peserta dari semester sumber ke semester <strong>{selectedSemester?.code}</strong>. Yang sudah ter-enroll akan di-skip.</span>
                </div>
                <div className="form-group">
                    <label className="form-label">Semester Sumber</label>
                    <select
                        className="form-input"
                        value={copyForm.sourceSemesterId}
                        onChange={(e) => setCopyForm((f) => ({ ...f, sourceSemesterId: e.target.value }))}
                    >
                        <option value="">— Pilih semester sumber —</option>
                        {semesterList.filter((s) => s.id !== selectedSemesterId).map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.code} — {s._count?.enrollments ?? 0} peserta
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={copyForm.onlyActive}
                            onChange={(e) => setCopyForm((f) => ({ ...f, onlyActive: e.target.checked }))}
                        />
                        <span className="text-sm">Hanya copy peserta yang isActive=true</span>
                    </label>
                </div>
            </Modal>
        </div>
    );
}
