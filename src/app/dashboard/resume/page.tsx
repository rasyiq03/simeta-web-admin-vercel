/**
 * =============================================================
 * SIMETA CMS — Resume Management Page (TypeScript)
 * Lihat semua resume mahasiswa, detail, dan hapus.
 * Admin melihat semua, user melihat miliknya sendiri.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { resumeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type { Resume } from '@/types';

/** State modal detail resume */
interface DetailModalState {
    open: boolean;
    resume: Resume | null;
}

export default function ResumePage(): React.JSX.Element {
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [detailModal, setDetailModal] = useState<DetailModalState>({ open: false, resume: null });
    const { hasRole } = useAuth();
    const { showToast } = useToast();

    /** Fetch semua resume */
    const fetchResumes = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const data = hasRole('ADMIN') ? await resumeApi.getAll() : await resumeApi.getMy();
            setResumes(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [hasRole, showToast]);

    useEffect(() => { fetchResumes(); }, [fetchResumes]);

    /** Hapus resume */
    const handleDelete = async (resume: Resume): Promise<void> => {
        if (!confirm('Yakin ingin menghapus resume ini?')) return;
        try {
            await resumeApi.delete(resume.id);
            showToast('Resume berhasil dihapus', 'success');
            fetchResumes();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Truncate teks untuk preview */
    const truncate = (text: string | undefined, maxLen: number = 100): string => {
        if (!text) return '—';
        return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Resume</h2>
                    <p className="page-subtitle">Lihat dan kelola resume pertemuan mahasiswa</p>
                </div>
            </div>

            {/* Tabel Resume */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : resumes.length === 0 ? (
                        <div className="empty-state"><p>Belum ada resume</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Mahasiswa</th>
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
                                            <td className="text-sm" style={{ maxWidth: 300 }}>{truncate(r.content, 80)}</td>
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
                                                    <button className="btn btn-ghost btn-sm"
                                                        onClick={() => setDetailModal({ open: true, resume: r })} title="Lihat Detail">
                                                        👁️
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm"
                                                        onClick={() => handleDelete(r)} title="Hapus" style={{ color: 'var(--color-danger)' }}>
                                                        🗑️
                                                    </button>
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

            {/* Modal: Detail Resume */}
            <Modal
                isOpen={detailModal.open}
                onClose={() => setDetailModal({ open: false, resume: null })}
                title="Detail Resume"
                size="lg"
            >
                {detailModal.resume && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <span className="text-sm text-muted">Ditulis oleh</span>
                            <p style={{ fontWeight: 600 }}>
                                {detailModal.resume.user?.name || '-'} ({detailModal.resume.user?.email || ''})
                            </p>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <span className="text-sm text-muted">Tanggal</span>
                            <p>{new Date(detailModal.resume.createdAt).toLocaleDateString('id-ID', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            })}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted">Isi Resume</span>
                            <div style={{
                                marginTop: 8, padding: 16, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                                fontSize: '0.875rem', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                            }}>
                                {detailModal.resume.content}
                            </div>
                        </div>
                        {detailModal.resume.fileUrl && (
                            <div style={{ marginTop: 16 }}>
                                <a href={detailModal.resume.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                    📎 Buka File Lampiran
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
