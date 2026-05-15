'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { resumeApi, resumeSessionApi, exportToCSV } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type { Resume, ResumeSession, CreateResumeSessionRequest } from '@/types';

type TabKey = 'resumes' | 'sessions';

const EMPTY_SESSION_FORM: CreateResumeSessionRequest = {
    title: '', description: '', openAt: '', closeAt: '',
};

function toDatetimeLocal(iso: string): string {
    if (!iso) return '';
    return iso.slice(0, 16);
}

function SessionStatusBadge({ session }: { session: ResumeSession }) {
    const now = Date.now();
    const open = new Date(session.openAt).getTime();
    const close = new Date(session.closeAt).getTime();
    if (now < open) return <span className="badge badge-warning">Belum Dibuka</span>;
    if (now > close) return <span className="badge" style={{ background: 'rgba(100,100,100,0.1)', color: '#666' }}>Ditutup</span>;
    return <span className="badge badge-success">Aktif</span>;
}

export default function ResumePage(): React.JSX.Element {
    const [activeTab, setActiveTab]     = useState<TabKey>('resumes');
    const [resumes, setResumes]         = useState<Resume[]>([]);
    const [sessions, setSessions]       = useState<ResumeSession[]>([]);
    const [loadingR, setLoadingR]       = useState(true);
    const [loadingS, setLoadingS]       = useState(true);
    const [detailResume, setDetailResume] = useState<Resume | null>(null);

    // Session modal state
    const [sessionModal, setSessionModal]   = useState(false);
    const [editingSession, setEditingSession] = useState<ResumeSession | null>(null);
    const [sessionForm, setSessionForm]     = useState<CreateResumeSessionRequest>(EMPTY_SESSION_FORM);
    const [savingSession, setSavingSession] = useState(false);

    const { hasRole } = useAuth();
    const { showToast } = useToast();

    const isManager = hasRole('ADMIN', 'PANITIA', 'DOSEN');

    const fetchResumes = useCallback(async () => {
        try {
            setLoadingR(true);
            const data = isManager ? await resumeApi.getAll() : await resumeApi.getMy();
            setResumes(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoadingR(false);
        }
    }, [isManager, showToast]);

    const fetchSessions = useCallback(async () => {
        try {
            setLoadingS(true);
            const data = await resumeSessionApi.getAll();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoadingS(false);
        }
    }, [showToast]);

    useEffect(() => { fetchResumes(); }, [fetchResumes]);
    useEffect(() => { if (activeTab === 'sessions') fetchSessions(); }, [activeTab, fetchSessions]);

    // ── Resume actions ──
    const handleDeleteResume = async (r: Resume) => {
        if (!confirm('Yakin ingin menghapus resume ini?')) return;
        try {
            await resumeApi.delete(r.id);
            showToast('Resume berhasil dihapus', 'success');
            fetchResumes();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    // ── Session modal ──
    const openCreateSession = () => {
        setEditingSession(null);
        setSessionForm(EMPTY_SESSION_FORM);
        setSessionModal(true);
    };

    const openEditSession = (s: ResumeSession) => {
        setEditingSession(s);
        setSessionForm({
            title: s.title,
            description: s.description || '',
            openAt: toDatetimeLocal(s.openAt),
            closeAt: toDatetimeLocal(s.closeAt),
        });
        setSessionModal(true);
    };

    const handleSaveSession = async () => {
        if (!sessionForm.title.trim()) { showToast('Judul sesi wajib diisi', 'error'); return; }
        if (!sessionForm.openAt)       { showToast('Waktu buka wajib diisi', 'error'); return; }
        if (!sessionForm.closeAt)      { showToast('Waktu tutup wajib diisi', 'error'); return; }
        if (sessionForm.closeAt <= sessionForm.openAt) {
            showToast('Waktu tutup harus setelah waktu buka', 'error'); return;
        }
        setSavingSession(true);
        try {
            const body: CreateResumeSessionRequest = {
                title: sessionForm.title.trim(),
                description: sessionForm.description?.trim() || undefined,
                openAt: new Date(sessionForm.openAt).toISOString(),
                closeAt: new Date(sessionForm.closeAt).toISOString(),
            };
            if (editingSession) {
                await resumeSessionApi.update(editingSession.id, body);
                showToast('Sesi berhasil diperbarui', 'success');
            } else {
                await resumeSessionApi.create(body);
                showToast('Sesi berhasil dibuat', 'success');
            }
            setSessionModal(false);
            fetchSessions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setSavingSession(false);
        }
    };

    const handleDeleteSession = async (s: ResumeSession) => {
        if (!confirm(`Hapus sesi "${s.title}"?\n\nResume yang sudah dikumpulkan tidak akan terhapus.`)) return;
        try {
            await resumeSessionApi.delete(s.id);
            showToast('Sesi dihapus', 'success');
            fetchSessions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const truncate = (text: string | undefined, max = 80): string => {
        if (!text) return '—';
        return text.length > max ? text.slice(0, max) + '...' : text;
    };

    const handleExportResumes = () => {
        const headers = ['Mahasiswa', 'Email', 'Sesi', 'Konten', 'File URL', 'Tanggal'];
        const rows = resumes.map((r) => [
            r.user?.name || '-',
            r.user?.email || '-',
            r.session?.title || '-',
            r.content || '-',
            r.fileUrl || '-',
            new Date(r.createdAt).toLocaleString('id-ID'),
        ]);
        exportToCSV('daftar-resume.csv', headers, rows);
    };

    const handleExportSessions = () => {
        const headers = ['Judul Sesi', 'Buka', 'Tutup', 'Jumlah Resume'];
        const rows = sessions.map((s) => [
            s.title,
            new Date(s.openAt).toLocaleString('id-ID'),
            new Date(s.closeAt).toLocaleString('id-ID'),
            s._count?.resumes || 0,
        ]);
        exportToCSV('sesi-pengumpulan-resume.csv', headers, rows);
    };

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Resume</h2>
                    <p className="page-subtitle">Kelola sesi pengumpulan dan daftar resume mahasiswa</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outline btn-sm" onClick={activeTab === 'resumes' ? handleExportResumes : handleExportSessions}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                    {activeTab === 'sessions' && isManager && (
                        <button className="btn btn-primary btn-sm" onClick={openCreateSession}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Buat Sesi
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="tab-nav" style={{ marginBottom: 20 }}>
                <button
                    className={`tab-btn ${activeTab === 'resumes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('resumes')}
                >
                    Daftar Resume
                    {resumes.length > 0 && (
                        <span className="badge" style={{ marginLeft: 6 }}>{resumes.length}</span>
                    )}
                </button>
                {isManager && (
                    <button
                        className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sessions')}
                    >
                        Sesi Pengumpulan
                        {sessions.length > 0 && (
                            <span className="badge" style={{ marginLeft: 6 }}>{sessions.length}</span>
                        )}
                    </button>
                )}
            </div>

            {/* ── Tab: Daftar Resume ── */}
            {activeTab === 'resumes' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {loadingR ? (
                            <div className="empty-state"><div className="spinner spinner-lg" /></div>
                        ) : resumes.length === 0 ? (
                            <div className="empty-state"><p>Belum ada resume</p></div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Mahasiswa</th>
                                            <th>Sesi Pengumpulan</th>
                                            <th>Preview</th>
                                            <th>File</th>
                                            <th>Tanggal</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resumes.map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <div>
                                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{r.user?.name || '-'}</div>
                                                        <div className="text-xs text-muted">{r.user?.email || ''}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {r.session ? (
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-navy)' }}>
                                                                {r.session.title}
                                                            </div>
                                                            <div className="text-xs text-muted">
                                                                Tutup: {new Date(r.session.closeAt).toLocaleDateString('id-ID', {
                                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted">—</span>
                                                    )}
                                                </td>
                                                <td className="text-sm" style={{ maxWidth: 260 }}>{truncate(r.content)}</td>
                                                <td>
                                                    {r.fileUrl ? (
                                                        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                                                            className="btn btn-ghost btn-sm" style={{ color: 'var(--color-info)' }}>
                                                            📎 File
                                                        </a>
                                                    ) : '—'}
                                                </td>
                                                <td className="text-xs text-muted">
                                                    {new Date(r.createdAt).toLocaleDateString('id-ID')}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => setDetailResume(r)}
                                                            title="Lihat Detail"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                        </button>
                                                        {isManager && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                style={{ color: 'var(--color-danger)' }}
                                                                onClick={() => handleDeleteResume(r)}
                                                                title="Hapus"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                                    <path d="M10 11v6M14 11v6" />
                                                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
            )}

            {/* ── Tab: Sesi Pengumpulan ── */}
            {activeTab === 'sessions' && isManager && (
                <div>
                    {loadingS ? (
                        <div className="empty-state" style={{ minHeight: 200 }}>
                            <div className="spinner spinner-lg" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-state" style={{ minHeight: 200 }}>
                            <p>Belum ada sesi pengumpulan</p>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={openCreateSession}>
                                Buat Sesi Pertama
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {sessions.map((s) => {
                                const resumeCount = s._count?.resumes ?? 0;
                                return (
                                    <div key={s.id} className="card">
                                        <div className="card-body">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{s.title}</span>
                                                        <SessionStatusBadge session={s} />
                                                    </div>
                                                    {s.description && (
                                                        <p className="text-sm text-muted" style={{ margin: '0 0 8px' }}>{s.description}</p>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                                        <div>
                                                            <span className="text-xs text-muted">Dibuka</span>
                                                            <div className="text-sm" style={{ fontWeight: 500 }}>
                                                                {new Date(s.openAt).toLocaleDateString('id-ID', {
                                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                                })}
                                                                {' '}
                                                                {new Date(s.openAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-muted">Ditutup</span>
                                                            <div className="text-sm" style={{ fontWeight: 500, color: 'var(--color-danger)' }}>
                                                                {new Date(s.closeAt).toLocaleDateString('id-ID', {
                                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                                })}
                                                                {' '}
                                                                {new Date(s.closeAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-muted">Resume Masuk</span>
                                                            <div className="text-sm" style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                                                                {resumeCount}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                    <button
                                                        className="btn btn-outline btn-sm"
                                                        onClick={() => openEditSession(s)}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: 'var(--color-danger)' }}
                                                        onClick={() => handleDeleteSession(s)}
                                                        title="Hapus sesi"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal: Detail Resume ── */}
            <Modal
                isOpen={!!detailResume}
                onClose={() => setDetailResume(null)}
                title="Detail Resume"
                size="lg"
            >
                {detailResume && (
                    <div>
                        <div style={{ marginBottom: 14 }}>
                            <span className="text-sm text-muted">Ditulis oleh</span>
                            <p style={{ fontWeight: 600, margin: '2px 0 0' }}>
                                {detailResume.user?.name || '-'}{' '}
                                <span className="text-sm text-muted">({detailResume.user?.email})</span>
                            </p>
                        </div>
                        {detailResume.session && (
                            <div style={{
                                marginBottom: 14, padding: '10px 14px',
                                background: 'rgba(18,29,89,0.05)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border-light)',
                            }}>
                                <span className="text-xs text-muted">Sesi Pengumpulan</span>
                                <div style={{ fontWeight: 600, color: 'var(--color-navy)', marginTop: 2 }}>
                                    {detailResume.session.title}
                                </div>
                                <div className="text-xs text-muted">
                                    Batas: {new Date(detailResume.session.closeAt).toLocaleDateString('id-ID', {
                                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </div>
                            </div>
                        )}
                        <div style={{ marginBottom: 14 }}>
                            <span className="text-sm text-muted">Tanggal Pengumpulan</span>
                            <p style={{ margin: '2px 0 0' }}>{new Date(detailResume.createdAt).toLocaleDateString('id-ID', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            })}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted">Isi Resume</span>
                            <div style={{
                                marginTop: 8, padding: 16, background: 'var(--color-bg)',
                                borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
                                lineHeight: 1.8, whiteSpace: 'pre-wrap',
                            }}>
                                {detailResume.content}
                            </div>
                        </div>
                        {detailResume.fileUrl && (
                            <div style={{ marginTop: 16 }}>
                                <a href={detailResume.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                    📎 Buka File Lampiran
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ── Modal: Create / Edit Session ── */}
            <Modal
                isOpen={sessionModal}
                onClose={() => setSessionModal(false)}
                title={editingSession ? 'Edit Sesi Pengumpulan' : 'Buat Sesi Pengumpulan'}
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Judul Sesi <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            className="form-input"
                            placeholder="cth: Resume Pertemuan 3 — Fiqh Puasa"
                            value={sessionForm.title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Deskripsi</label>
                        <input
                            className="form-input"
                            placeholder="Opsional"
                            value={sessionForm.description || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, description: e.target.value }))}
                        />
                    </div>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Waktu Dibuka <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={sessionForm.openAt}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, openAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Batas Waktu <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={sessionForm.closeAt}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, closeAt: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setSessionModal(false)} disabled={savingSession}>
                            Batal
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveSession} disabled={savingSession}>
                            {savingSession ? <span className="spinner spinner-sm" /> : null}
                            {editingSession ? 'Simpan Perubahan' : 'Buat Sesi'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
