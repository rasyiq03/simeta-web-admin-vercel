'use client';

/**
 * SIMETA CMS — Audit Log (Gambar 4.16.1)
 * Daftar aksi sistem dengan filter by action / user / resource.
 */

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { auditApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { AuditLog } from '@/types';

function isNotFound(err: unknown): boolean {
    const m = (err as Error)?.message ?? '';
    return /404|not found|cannot (get|post)/i.test(m);
}
function fmt(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function AuditLogPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [fAction, setFAction] = useState('');
    const [fResource, setFResource] = useState('');
    const [fUser, setFUser] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setPageError(null);
        try {
            setLogs(await auditApi.list({
                action: fAction || undefined,
                resource: fResource || undefined,
                userId: fUser || undefined,
            }));
        } catch (err) {
            if (isNotFound(err)) setPageError('Endpoint /audit-logs belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        } finally { setLoading(false); }
    }, [fAction, fResource, fUser, showToast]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Audit Log</h2>
                    <p className="page-subtitle">Catatan aktivitas sistem — filter berdasarkan aksi, pengguna, atau resource</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                        <label className="form-label">Aksi</label>
                        <input className="form-input" placeholder="mis. CREATE / DELETE / LOGIN" value={fAction}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setFAction(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                        <label className="form-label">Resource</label>
                        <input className="form-input" placeholder="mis. User / Mentoring" value={fResource}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setFResource(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                        <label className="form-label">User ID</label>
                        <input className="form-input" placeholder="ID pengguna" value={fUser}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setFUser(e.target.value)} />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
                        {loading ? <span className="spinner spinner-sm" /> : null} Terapkan Filter
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setFAction(''); setFResource(''); setFUser(''); }}>
                        Reset
                    </button>
                </div>
            </div>

            {loading && <div className="empty-state" style={{ minHeight: 200 }}><div className="spinner spinner-lg" /></div>}

            {!loading && pageError && (
                <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Endpoint belum tersedia</div>
                            <div className="text-sm text-muted">{pageError} Hubungi tim backend.</div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && !pageError && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {logs.length === 0 ? (
                            <div className="empty-state"><p>Tidak ada log untuk filter ini</p></div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Waktu</th><th>Aksi</th><th>Resource</th><th>Pengguna</th><th>Detail</th><th>IP</th></tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((l) => (
                                            <tr key={l.id}>
                                                <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(l.createdAt)}</td>
                                                <td><span className="badge badge-navy">{l.action}</span></td>
                                                <td className="text-sm">{l.resource}{l.resourceId ? <span className="text-xs text-muted"> #{l.resourceId.slice(0, 8)}</span> : null}</td>
                                                <td className="text-sm">
                                                    {l.user ? <>{l.user.name}<div className="text-xs text-muted">{l.user.role}</div></> : <span className="text-muted text-xs">—</span>}
                                                </td>
                                                <td className="text-sm text-muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.detail ?? '—'}</td>
                                                <td className="text-xs text-muted">{l.ipAddress ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
