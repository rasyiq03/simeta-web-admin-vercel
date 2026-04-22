/**
 * =============================================================
 * SIMETA CMS — Attendance Management Page (TypeScript)
 * Buat sesi absensi, lihat daftar sesi, hapus sesi.
 * Diakses oleh ADMIN.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { attendanceApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type { AttendanceSession, CreateSessionRequest } from '@/types';

export default function AttendancePage(): React.JSX.Element {
    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [form, setForm] = useState<CreateSessionRequest>({ title: '', startTime: '', endTime: '' });
    const { showToast } = useToast();

    /** Fetch semua sesi absensi */
    const fetchSessions = useCallback(async (): Promise<void> => {
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

    /** Submit form buat sesi baru */
    const handleCreate = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
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

    /** Hapus sesi */
    const handleDelete = async (session: AttendanceSession): Promise<void> => {
        if (!confirm(`Hapus sesi "${session.title}"?`)) return;
        try {
            await attendanceApi.delete(session.id);
            showToast('Sesi berhasil dihapus', 'success');
            fetchSessions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Helper: format datetime ke lokal Indonesia */
    const formatDateTime = (dateStr: string): string =>
        new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Absensi</h2>
                    <p className="page-subtitle">Kelola sesi absensi mahasiswa</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        + Buat Sesi
                    </button>
                </div>
            </div>

            {/* Session Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-state"><p>Belum ada sesi absensi</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Judul Sesi</th>
                                        <th>Mulai</th>
                                        <th>Selesai</th>
                                        <th>Check-in</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((s) => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 500 }}>{s.title}</td>
                                            <td className="text-sm text-muted">{formatDateTime(s.startTime)}</td>
                                            <td className="text-sm text-muted">{formatDateTime(s.endTime)}</td>
                                            <td><span className="badge badge-info">{s._count?.records || 0}</span></td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(s)}
                                                    title="Hapus" style={{ color: 'var(--color-danger)' }}>
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Create Session */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Buat Sesi Absensi"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" form="create-session-form" type="submit">Buat Sesi</button>
                    </>
                }
            >
                <form id="create-session-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Judul Sesi</label>
                        <input className="form-input" placeholder="Pertemuan ke-1"
                            value={form.title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Mulai</label>
                        <input className="form-input" type="datetime-local"
                            value={form.startTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Selesai</label>
                        <input className="form-input" type="datetime-local"
                            value={form.endTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, endTime: e.target.value })} />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
