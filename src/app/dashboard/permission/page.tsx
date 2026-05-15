'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { permissionApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import StatusBadge from '@/components/StatusBadge';
import type { Permission, PermissionStatus } from '@/types';

export default function PermissionPage(): React.JSX.Element {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading]         = useState<boolean>(true);
    const [statusFilter, setStatusFilter] = useState<PermissionStatus | ''>('');
    const [detail, setDetail]           = useState<Permission | null>(null);
    const { showToast } = useToast();

    const fetchPermissions = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const data = await permissionApi.getAll(statusFilter || undefined);
            setPermissions(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, showToast]);

    useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

    const handleApprove = async (p: Permission): Promise<void> => {
        const sessionInfo = p.session
            ? `sesi "${p.session.title}"`
            : 'izin ini (tidak terkait sesi absensi)';
        if (!confirm(`Setujui ${sessionInfo}?\n\nStatus absensi terkait akan otomatis berubah menjadi IZIN.`)) return;
        try {
            await permissionApi.approve(p.id);
            showToast('Izin disetujui — status absensi diubah menjadi IZIN', 'success');
            fetchPermissions();
            if (detail?.id === p.id) setDetail(null);
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const handleReject = async (p: Permission): Promise<void> => {
        const sessionInfo = p.session
            ? `sesi "${p.session.title}"`
            : 'izin ini';
        if (!confirm(`Tolak ${sessionInfo}?\n\nStatus absensi terkait akan otomatis berubah menjadi ALPHA (tidak hadir).`)) return;
        try {
            await permissionApi.reject(p.id);
            showToast('Izin ditolak — status absensi diubah menjadi ALPHA', 'success');
            fetchPermissions();
            if (detail?.id === p.id) setDetail(null);
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const handleApproveAll = async (): Promise<void> => {
        const pending = permissions.filter((p) => p.status === 'PENDING');
        if (!confirm(`Setujui semua ${pending.length} izin pending?\n\nSemua status absensi terkait akan berubah menjadi IZIN.`)) return;
        try {
            const result = await permissionApi.approveAll();
            showToast(result?.message || 'Semua izin disetujui — status absensi diperbarui', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const handleRejectAll = async (): Promise<void> => {
        const pending = permissions.filter((p) => p.status === 'PENDING');
        if (!confirm(`Tolak semua ${pending.length} izin pending?\n\nSemua status absensi terkait akan berubah menjadi ALPHA.`)) return;
        try {
            const result = await permissionApi.rejectAll();
            showToast(result?.message || 'Semua izin ditolak — status absensi diperbarui', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const pendingCount = permissions.filter((p) => p.status === 'PENDING').length;

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Pengajuan Izin</h2>
                    <p className="page-subtitle">Kelola pengajuan izin mahasiswa per sesi absensi</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-success btn-sm" onClick={handleApproveAll} disabled={pendingCount === 0}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Approve Semua ({pendingCount})
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleRejectAll} disabled={pendingCount === 0}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Reject Semua
                    </button>
                </div>
            </div>

            {/* ── Cascade Info Banner ── */}
            <div className="info-banner" style={{ marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                    <strong>Perhatian:</strong> Approve → status absensi terkait menjadi <strong>IZIN</strong>.
                    Reject → status absensi terkait menjadi <strong>ALPHA</strong>.
                </span>
            </div>

            {/* ── Filter ── */}
            <div className="filter-bar">
                <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as PermissionStatus | '')}
                    style={{ maxWidth: 200 }}
                >
                    <option value="">Semua Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Disetujui</option>
                    <option value="REJECTED">Ditolak</option>
                </select>
                {pendingCount > 0 && (
                    <span className="badge badge-warning">{pendingCount} pending</span>
                )}
            </div>

            {/* ── Table ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : permissions.length === 0 ? (
                        <div className="empty-state"><p>Tidak ada pengajuan izin</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Mahasiswa</th>
                                        <th>Sesi Absensi</th>
                                        <th>Alasan</th>
                                        <th>Bukti</th>
                                        <th>Status</th>
                                        <th>Tanggal</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.map((p) => (
                                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(p)}>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.user?.name || '-'}</div>
                                                    <div className="text-xs text-muted">{p.user?.email || ''}</div>
                                                </div>
                                            </td>
                                            <td>
                                                {p.session ? (
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-navy)' }}>
                                                            {p.session.title}
                                                        </div>
                                                        <div className="text-xs text-muted">
                                                            {new Date(p.session.startTime).toLocaleDateString('id-ID', {
                                                                day: 'numeric', month: 'short', year: 'numeric',
                                                            })}
                                                            {' · '}
                                                            {new Date(p.session.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted">—</span>
                                                )}
                                            </td>
                                            <td className="text-sm" style={{ maxWidth: 200 }}>{p.reason}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                {p.proofUrl ? (
                                                    <a href={p.proofUrl} target="_blank" rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm" style={{ color: 'var(--color-info)' }}>
                                                        📎 Lihat
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td><StatusBadge status={p.status} /></td>
                                            <td className="text-xs text-muted">
                                                {new Date(p.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                {p.status === 'PENDING' && (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button
                                                            className="btn btn-success btn-sm"
                                                            onClick={() => handleApprove(p)}
                                                            title="Approve — absensi jadi IZIN"
                                                        >✓</button>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => handleReject(p)}
                                                            title="Reject — absensi jadi ALPHA"
                                                        >✕</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Detail Slide-over ── */}
            {detail && (
                <>
                    <div
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                            zIndex: 150, backdropFilter: 'blur(2px)',
                        }}
                        onClick={() => setDetail(null)}
                    />
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw',
                        background: 'var(--color-surface)', boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
                        zIndex: 200, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Detail Pengajuan Izin</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
                        </div>

                        {/* Mahasiswa */}
                        <div>
                            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Mahasiswa</div>
                            <div style={{ fontWeight: 600 }}>{detail.user?.name || '-'}</div>
                            <div className="text-sm text-muted">{detail.user?.email}</div>
                            {detail.user?.role && (
                                <span className="badge" style={{ marginTop: 4 }}>{detail.user.role}</span>
                            )}
                        </div>

                        {/* Sesi absensi */}
                        <div style={{
                            background: detail.session ? 'rgba(18,29,89,0.06)' : 'var(--color-surface-2)',
                            borderRadius: 'var(--radius-md)', padding: '12px 16px',
                            border: '1px solid var(--color-border-light)',
                        }}>
                            <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Sesi Absensi yang Diizinkan</div>
                            {detail.session ? (
                                <>
                                    <div style={{ fontWeight: 700, color: 'var(--color-navy)', fontSize: '0.9375rem' }}>
                                        {detail.session.title}
                                    </div>
                                    <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                                        {new Date(detail.session.startTime).toLocaleDateString('id-ID', {
                                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                        })}
                                    </div>
                                    <div className="text-sm text-muted">
                                        {new Date(detail.session.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        {' – '}
                                        {new Date(detail.session.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-muted">Tidak terkait sesi absensi tertentu</div>
                            )}
                        </div>

                        {/* Alasan */}
                        <div>
                            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Alasan</div>
                            <div style={{
                                background: 'var(--color-surface-2)', padding: '10px 14px',
                                borderRadius: 'var(--radius-md)', fontSize: '0.875rem', lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {detail.reason}
                            </div>
                        </div>

                        {/* Bukti */}
                        {detail.proofUrl && (
                            <div>
                                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Bukti Lampiran</div>
                                <a href={detail.proofUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                    📎 Buka File Bukti
                                </a>
                            </div>
                        )}

                        {/* Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div>
                                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Status</div>
                                <StatusBadge status={detail.status} />
                            </div>
                            <div>
                                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Diajukan</div>
                                <div className="text-sm">{new Date(detail.createdAt).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'long', year: 'numeric',
                                })}</div>
                            </div>
                        </div>

                        {/* Cascade info */}
                        {detail.status === 'PENDING' && (
                            <div className="warning-banner" style={{ fontSize: '0.8125rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                <span>Approve → absensi jadi <strong>IZIN</strong> · Reject → absensi jadi <strong>ALPHA</strong></span>
                            </div>
                        )}

                        {/* Action buttons */}
                        {detail.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
                                <button
                                    className="btn btn-success"
                                    style={{ flex: 1 }}
                                    onClick={() => handleApprove(detail)}
                                >
                                    ✓ Approve Izin
                                </button>
                                <button
                                    className="btn btn-danger"
                                    style={{ flex: 1 }}
                                    onClick={() => handleReject(detail)}
                                >
                                    ✕ Reject Izin
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
