'use client';

/**
 * SIMETA CMS — Riwayat Upload & Status Quota (Gambar 4.14.2)
 * Daftar berkas yang diupload + sisa kuota per pengguna.
 */

import { useCallback, useEffect, useState } from 'react';
import { uploadApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { UploadRecord, UserQuota } from '@/types';

function isNotFound(err: unknown): boolean {
    const m = (err as Error)?.message ?? '';
    return /404|not found|cannot (get|post)/i.test(m);
}
function fmtBytes(b?: number | null): string {
    if (!b || b <= 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(1)} ${u[i]}`;
}
function fmt(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}
const STATUS_BADGE: Record<string, string> = {
    ready: 'badge-success', processing: 'badge-info', queued: 'badge-warning',
    rejected: 'badge-danger', failed: 'badge-danger',
};

export default function UploadHistoryPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [tab, setTab] = useState<'history' | 'quota'>('history');
    const [records, setRecords] = useState<UploadRecord[]>([]);
    const [quota, setQuota] = useState<UserQuota[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setPageError(null);
        try {
            if (tab === 'history') setRecords(await uploadApi.history());
            else setQuota(await uploadApi.quota());
        } catch (err) {
            if (isNotFound(err)) setPageError(`Endpoint /upload/${tab === 'history' ? 'history' : 'quota'} belum tersedia di backend.`);
            else showToast((err as Error).message, 'error');
        } finally { setLoading(false); }
    }, [tab, showToast]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Riwayat Upload &amp; Kuota</h2>
                    <p className="page-subtitle">Pantau berkas yang diunggah dan sisa kuota tiap pengguna</p>
                </div>
            </div>

            <div className="tab-nav" style={{ marginBottom: 20 }}>
                <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Riwayat Upload</button>
                <button className={`tab-btn ${tab === 'quota' ? 'active' : ''}`} onClick={() => setTab('quota')}>Status Kuota</button>
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

            {!loading && !pageError && tab === 'history' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {records.length === 0 ? (
                            <div className="empty-state"><p>Belum ada riwayat upload</p></div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr><th>#</th><th>Berkas</th><th>Pengguna</th><th>Ukuran</th><th>Status</th><th>Waktu</th></tr>
                                    </thead>
                                    <tbody>
                                        {records.map((r, i) => (
                                            <tr key={r.id}>
                                                <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer">{r.fileName}</a> : r.fileName}
                                                </td>
                                                <td className="text-sm">{r.user?.name ?? '—'}</td>
                                                <td className="text-sm text-muted">{fmtBytes(r.sizeBytes)}</td>
                                                <td><span className={`badge ${STATUS_BADGE[r.status] ?? ''}`}>{r.status}</span></td>
                                                <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!loading && !pageError && tab === 'quota' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {quota.length === 0 ? (
                            <div className="empty-state"><p>Belum ada data kuota</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Pengguna</th><th>Terpakai</th><th>Batas</th><th>Penggunaan</th></tr></thead>
                                <tbody>
                                    {quota.map((q, i) => {
                                        const pct = q.limit > 0 ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
                                        const col = pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
                                        return (
                                            <tr key={q.userId}>
                                                <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{q.user?.name ?? q.userId}</td>
                                                <td className="text-sm">{q.used}</td>
                                                <td className="text-sm text-muted">{q.limit}</td>
                                                <td style={{ minWidth: 160 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, height: 6, background: 'var(--color-border-light)', borderRadius: 999 }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 999 }} />
                                                        </div>
                                                        <span className="text-xs" style={{ fontWeight: 600, color: col }}>{pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
