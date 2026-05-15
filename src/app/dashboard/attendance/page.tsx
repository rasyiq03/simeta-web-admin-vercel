'use client';

import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { attendanceApi, exportToCSV } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/Modal';
import type { AttendanceSession, AttendanceSessionDetail, AttendanceRecordDetail, AttendanceStatus, CreateSessionRequest } from '@/types';

const STATUS_OPTS: AttendanceStatus[] = ['PRESENT', 'LATE', 'PERMIT', 'ABSENT'];

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; color: string; label: string }> = {
    PRESENT: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'Hadir' },
    LATE:    { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', label: 'Terlambat' },
    PERMIT:  { bg: 'var(--color-info-bg)',    color: 'var(--color-info)',    label: 'Izin' },
    ABSENT:  { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  label: 'Absen' },
};

interface EditSessionForm { title: string; startTime: string; endTime: string; }

export default function AttendancePage(): React.JSX.Element {
    const [sessions, setSessions]                 = useState<AttendanceSession[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [showCreateModal, setShowCreateModal]   = useState(false);
    const [editSessionModal, setEditSessionModal] = useState<{ open: boolean; session: AttendanceSession | null }>({ open: false, session: null });
    const [detailModal, setDetailModal]           = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null });
    const [detailData, setDetailData]             = useState<AttendanceSessionDetail | null>(null);
    const [detailLoading, setDetailLoading]       = useState(false);
    const [editingRecord, setEditingRecord]       = useState<{ id: string; status: AttendanceStatus } | null>(null);
    const [savingRecord, setSavingRecord]         = useState(false);
    const [form, setForm]                         = useState<CreateSessionRequest>({ title: '', startTime: '', endTime: '' });
    const [editForm, setEditForm]                 = useState<EditSessionForm>({ title: '', startTime: '', endTime: '' });
    const { showToast } = useToast();
    const { hasRole } = useAuth();

    const isManager = hasRole('ADMIN', 'PANITIA', 'DOSEN');

    const fetchSessions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await attendanceApi.getAll();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    /* ── Open session detail ── */
    const openDetail = async (sessionId: string) => {
        setDetailModal({ open: true, sessionId });
        setDetailLoading(true);
        setDetailData(null);
        try {
            const data = await attendanceApi.getSessionDetail(sessionId);
            setDetailData(data);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    /* ── Create session ── */
    const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!form.title || !form.startTime || !form.endTime) {
            showToast('Semua field wajib diisi', 'error');
            return;
        }
        try {
            await attendanceApi.createSession(form);
            showToast('Sesi absensi berhasil dibuat', 'success');
            setShowCreateModal(false);
            setForm({ title: '', startTime: '', endTime: '' });
            fetchSessions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /* ── Edit session ── */
    const openEditSession = (session: AttendanceSession) => {
        const toLocal = (iso: string) => new Date(iso).toISOString().slice(0, 16);
        setEditForm({
            title: session.title,
            startTime: toLocal(session.startTime),
            endTime: toLocal(session.endTime),
        });
        setEditSessionModal({ open: true, session });
    };

    const handleEditSession = async () => {
        if (!editSessionModal.session) return;
        try {
            await attendanceApi.update(editSessionModal.session.id, {
                title: editForm.title,
                startTime: new Date(editForm.startTime).toISOString(),
                endTime: new Date(editForm.endTime).toISOString(),
            });
            showToast('Sesi berhasil diperbarui', 'success');
            setEditSessionModal({ open: false, session: null });
            fetchSessions();
            if (detailData?.id === editSessionModal.session.id) {
                openDetail(editSessionModal.session.id);
            }
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /* ── Delete session ── */
    const handleDelete = async (session: AttendanceSession) => {
        if (!confirm(`Hapus sesi "${session.title}"? Semua data check-in akan ikut terhapus.`)) return;
        try {
            await attendanceApi.delete(session.id);
            showToast('Sesi berhasil dihapus', 'success');
            fetchSessions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /* ── Edit attendance record status ── */
    const handleSaveRecord = async () => {
        if (!editingRecord || !detailModal.sessionId) return;
        setSavingRecord(true);
        try {
            await attendanceApi.updateRecord(detailModal.sessionId, editingRecord.id, editingRecord.status);
            showToast('Status kehadiran berhasil diubah', 'success');
            setEditingRecord(null);
            // Refresh detail
            const updated = await attendanceApi.getSessionDetail(detailModal.sessionId);
            setDetailData(updated);
        } catch (err) {
            const msg = (err as Error).message;
            if (msg.includes('404') || msg.includes('not found')) {
                showToast('Endpoint edit record belum tersedia di backend (backend request)', 'info');
            } else {
                showToast(msg, 'error');
            }
            setEditingRecord(null);
        } finally {
            setSavingRecord(false);
        }
    };

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

    const statusCount = (records: AttendanceRecordDetail[], s: AttendanceStatus) =>
        records.filter((r) => r.status === s).length;

    const handleExportSessions = () => {
        const headers = ['ID', 'Judul Sesi', 'Waktu Mulai', 'Waktu Selesai', 'Jumlah Peserta'];
        const rows = sessions.map((s) => [
            s.id,
            s.title,
            new Date(s.startTime).toLocaleString('id-ID'),
            new Date(s.endTime).toLocaleString('id-ID'),
            s._count?.records || 0,
        ]);
        exportToCSV('daftar-sesi-absensi.csv', headers, rows);
    };

    const handleExportDetail = () => {
        if (!detailData) return;
        const headers = ['Nama Peserta', 'Email', 'User ID', 'Waktu Check-in', 'Status'];
        const rows = (detailData.records || []).map((r) => [
            r.user?.name || '-',
            r.user?.email || '-',
            r.userId,
            r.checkInTime ? new Date(r.checkInTime).toLocaleString('id-ID') : '-',
            STATUS_STYLE[r.status]?.label || r.status,
        ]);
        exportToCSV(`absensi-${detailData.title.replace(/\s+/g, '-')}.csv', headers, rows);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Absensi</h2>
                    <p className="page-subtitle">Kelola sesi absensi dan data kehadiran peserta</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outline btn-sm" onClick={handleExportSessions}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                    {hasRole('ADMIN') && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Buat Sesi
                        </button>
                    )}
                </div>
            </div>

            {/* ── Sessions Table ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            <p>Belum ada sesi absensi</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th><th>Judul Sesi</th><th>Mulai</th><th>Selesai</th>
                                        <th>Check-in</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((s, i) => (
                                        <tr key={s.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{s.title}</td>
                                            <td className="text-sm text-muted">{fmt(s.startTime)}</td>
                                            <td className="text-sm text-muted">{fmt(s.endTime)}</td>
                                            <td>
                                                <span className="badge badge-info">{s._count?.records || 0} peserta</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {/* View detail */}
                                                    <button className="btn btn-ghost btn-icon-sm" title="Lihat Detail"
                                                        style={{ color: 'var(--color-info)' }}
                                                        onClick={() => openDetail(s.id)}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                            <circle cx="12" cy="12" r="3"/>
                                                        </svg>
                                                    </button>
                                                    {/* Edit session (ADMIN/PANITIA/DOSEN) */}
                                                    {isManager && (
                                                        <button className="btn btn-ghost btn-icon-sm" title="Edit Sesi"
                                                            style={{ color: 'var(--color-warning)' }}
                                                            onClick={() => openEditSession(s)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {/* Delete (ADMIN only) */}
                                                    {hasRole('ADMIN') && (
                                                        <button className="btn btn-ghost btn-icon-sm" title="Hapus"
                                                            style={{ color: 'var(--color-danger)' }}
                                                            onClick={() => handleDelete(s)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"/>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal: Create Session ── */}
            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Buat Sesi Absensi"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" form="create-session-form" type="submit">Buat Sesi</button>
                    </>
                }>
                <form id="create-session-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Judul Sesi <span className="required">*</span></label>
                        <input className="form-input" placeholder="Pertemuan ke-1" value={form.title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Waktu Mulai <span className="required">*</span></label>
                            <input className="form-input" type="datetime-local" value={form.startTime}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, startTime: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Waktu Selesai <span className="required">*</span></label>
                            <input className="form-input" type="datetime-local" value={form.endTime}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, endTime: e.target.value })} />
                        </div>
                    </div>
                </form>
            </Modal>

            {/* ── Modal: Edit Session ── */}
            <Modal isOpen={editSessionModal.open} onClose={() => setEditSessionModal({ open: false, session: null })}
                title="Edit Sesi Absensi" size="sm"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditSessionModal({ open: false, session: null })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleEditSession}>Simpan</button>
                    </>
                }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Judul Sesi</label>
                        <input className="form-input" value={editForm.title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Mulai</label>
                        <input className="form-input" type="datetime-local" value={editForm.startTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, startTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Selesai</label>
                        <input className="form-input" type="datetime-local" value={editForm.endTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, endTime: e.target.value })} />
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Session Detail + Edit Records ── */}
            <Modal isOpen={detailModal.open} onClose={() => { setDetailModal({ open: false, sessionId: null }); setDetailData(null); setEditingRecord(null); }}
                title={detailData ? `Detail: ${detailData.title}` : 'Detail Sesi'} size="lg"
                footer={
                    detailData && (
                        <button className="btn btn-outline btn-sm" onClick={handleExportDetail}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download CSV
                        </button>
                    )
                }>
                {detailLoading ? (
                    <div className="empty-state"><div className="spinner spinner-lg" /></div>
                ) : detailData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Session meta */}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Mulai', value: fmt(detailData.startTime) },
                                { label: 'Selesai', value: fmt(detailData.endTime) },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'var(--color-surface-2)', padding: '8px 16px', borderRadius: 'var(--radius-md)', flex: 1 }}>
                                    <div className="text-xs text-muted">{label}</div>
                                    <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Status summary */}
                        {detailData.records && detailData.records.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {STATUS_OPTS.map((s) => {
                                    const { bg, color, label } = STATUS_STYLE[s];
                                    const count = statusCount(detailData.records, s);
                                    return (
                                        <div key={s} style={{ padding: '6px 12px', background: bg, borderRadius: 'var(--radius-md)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ color, fontWeight: 700, fontSize: '1rem' }}>{count}</span>
                                            <span style={{ color, fontSize: '0.8125rem' }}>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Records table */}
                        {!detailData.records || detailData.records.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                <p>Belum ada peserta yang check-in</p>
                            </div>
                        ) : (
                            <div className="table-container" style={{ maxHeight: 340 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Peserta</th><th>Check-in</th>
                                            <th>Status</th>{isManager && <th>Ubah Status</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailData.records.map((rec: AttendanceRecordDetail, i: number) => {
                                            const { bg, color, label } = STATUS_STYLE[rec.status] ?? STATUS_STYLE.ABSENT;
                                            const isEditing = editingRecord?.id === rec.id;
                                            return (
                                                <tr key={rec.id}>
                                                    <td className="text-xs text-muted">{i + 1}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{rec.user?.name || rec.userId}</div>
                                                        {rec.user?.email && <div className="text-xs text-muted">{rec.user.email}</div>}
                                                    </td>
                                                    <td className="text-sm text-muted">
                                                        {rec.checkInTime ? fmt(rec.checkInTime) : '—'}
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ background: bg, color }}>{label}</span>
                                                    </td>
                                                    {isManager && (
                                                        <td>
                                                            {isEditing ? (
                                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                    <select className="form-select" style={{ padding: '4px 8px', fontSize: '0.8125rem', width: 'auto' }}
                                                                        value={editingRecord.status}
                                                                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                                                            setEditingRecord({ id: rec.id, status: e.target.value as AttendanceStatus })
                                                                        }>
                                                                        {STATUS_OPTS.map((s) => (
                                                                            <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button className="btn btn-success btn-xs" onClick={handleSaveRecord} disabled={savingRecord}>
                                                                        {savingRecord ? <span className="spinner spinner-sm" /> : '✓'}
                                                                    </button>
                                                                    <button className="btn btn-outline btn-xs" onClick={() => setEditingRecord(null)}>✕</button>
                                                                </div>
                                                            ) : (
                                                                <button className="btn btn-ghost btn-icon-sm"
                                                                    title="Ubah status"
                                                                    style={{ color: 'var(--color-text-muted)' }}
                                                                    onClick={() => setEditingRecord({ id: rec.id, status: rec.status })}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {isManager && (
                            <div className="info-banner">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span>Perubahan status kehadiran memerlukan endpoint <code>PATCH /attendance/:id/records/:recordId</code> di backend.</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-state"><p>Gagal memuat detail sesi</p></div>
                )}
            </Modal>
        </div>
    );
}
