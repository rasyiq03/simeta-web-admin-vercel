/**
 * =============================================================
 * SIMETA CMS — Permission Management Page (TypeScript)
 * Kelola pengajuan izin: lihat daftar, filter by status,
 * approve/reject satu-satu atau bulk.
 * Hanya ADMIN yang bisa mengakses halaman ini.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { permissionApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import StatusBadge from '@/components/StatusBadge';
import type { Permission, PermissionStatus } from '@/types';

export default function PermissionPage(): React.JSX.Element {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [statusFilter, setStatusFilter] = useState<PermissionStatus | ''>('');
    const { showToast } = useToast();

    /** Fetch semua izin, opsional filter by status */
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

    /** Approve satu izin */
    const handleApprove = async (id: string): Promise<void> => {
        try {
            await permissionApi.approve(id);
            showToast('Izin disetujui', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Reject satu izin */
    const handleReject = async (id: string): Promise<void> => {
        try {
            await permissionApi.reject(id);
            showToast('Izin ditolak', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Approve semua pending */
    const handleApproveAll = async (): Promise<void> => {
        if (!confirm('Setujui semua izin yang masih pending?')) return;
        try {
            const result = await permissionApi.approveAll();
            showToast(result?.message || 'Semua izin disetujui', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Reject semua pending */
    const handleRejectAll = async (): Promise<void> => {
        if (!confirm('Tolak semua izin yang masih pending?')) return;
        try {
            const result = await permissionApi.rejectAll();
            showToast(result?.message || 'Semua izin ditolak', 'success');
            fetchPermissions();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const pendingCount: number = permissions.filter((p) => p.status === 'PENDING').length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Pengajuan Izin</h2>
                    <p className="page-subtitle">Kelola pengajuan izin mahasiswa</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-success btn-sm" onClick={handleApproveAll} disabled={pendingCount === 0}>
                        ✓ Approve Semua
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleRejectAll} disabled={pendingCount === 0}>
                        ✕ Reject Semua
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div className="filter-bar">
                <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as PermissionStatus | '')}
                    style={{ maxWidth: 200 }}
                >
                    <option value="">Semua Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                </select>
                {pendingCount > 0 && (
                    <span className="badge badge-warning">{pendingCount} pending</span>
                )}
            </div>

            {/* Tabel Izin */}
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
                                        <th>Alasan</th>
                                        <th>Sesi</th>
                                        <th>Bukti</th>
                                        <th>Status</th>
                                        <th>Tanggal</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.map((p) => (
                                        <tr key={p.id}>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.user?.name || '-'}</div>
                                                    <div className="text-xs text-muted">{p.user?.email || ''}</div>
                                                </div>
                                            </td>
                                            <td className="text-sm" style={{ maxWidth: 200 }}>{p.reason}</td>
                                            <td className="text-sm text-muted">{p.session?.title || '—'}</td>
                                            <td>
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
                                            <td>
                                                {p.status === 'PENDING' && (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(p.id)} title="Approve">✓</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(p.id)} title="Reject">✕</button>
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
        </div>
    );
}
