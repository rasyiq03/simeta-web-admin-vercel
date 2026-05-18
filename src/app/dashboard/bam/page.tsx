'use client';

/**
 * SIMETA CMS — Rekap BAM & Skor Kinerja Mentor (Gambar 4.5.2)
 * Daftar sesi BAM (Bimbingan/Aktivitas Mentor) + skor kinerja per mentor.
 */

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { bamApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { BAMSession, MentorScore } from '@/types';

function isNotFound(err: unknown): boolean {
    const m = (err as Error)?.message ?? '';
    return /404|not found|cannot (get|post)/i.test(m);
}
const STATUS_BADGE: Record<string, string> = {
    APPROVED: 'badge-success', PENDING: 'badge-warning', REJECTED: 'badge-danger',
};
function fmt(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BamPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [sessions, setSessions] = useState<BAMSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [mentorId, setMentorId] = useState('');
    const [score, setScore] = useState<MentorScore | null>(null);
    const [scoreLoading, setScoreLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setPageError(null);
        try {
            setSessions(await bamApi.getSessions());
        } catch (err) {
            if (isNotFound(err)) setPageError('Endpoint /bam/sessions belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        } finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const mentors = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of sessions) if (s.mentor) map.set(s.mentor.id, s.mentor.name);
        return Array.from(map, ([id, name]) => ({ id, name }));
    }, [sessions]);

    const loadScore = useCallback(async (id: string) => {
        setMentorId(id);
        setScore(null);
        if (!id) return;
        setScoreLoading(true);
        try { setScore(await bamApi.getMentorScore(id)); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setScoreLoading(false); }
    }, [showToast]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Rekap BAM &amp; Skor Mentor</h2>
                    <p className="page-subtitle">Daftar sesi BAM dan skor kinerja per mentor</p>
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
                <>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Skor Kinerja Mentor</span></div>
                        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
                                <label className="form-label">Pilih Mentor</label>
                                <select className="form-select" value={mentorId}
                                    onChange={(e: ChangeEvent<HTMLSelectElement>) => loadScore(e.target.value)}>
                                    <option value="">— pilih mentor —</option>
                                    {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            {scoreLoading && <span className="spinner spinner-sm" />}
                            {score && !scoreLoading && (
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <div>
                                        <div className="text-xs text-muted">Total Sesi</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{score.totalSessions}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted">Disetujui</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{score.approvedSessions}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted">Skor</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-amber-dark)' }}>{score.score}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Daftar Sesi BAM</span></div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {sessions.length === 0 ? (
                                <div className="empty-state"><p>Belum ada sesi BAM</p></div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr><th>#</th><th>Tanggal</th><th>Mentor</th><th>Kelompok</th><th>Topik</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s, i) => (
                                            <tr key={s.id}>
                                                <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                <td className="text-sm text-muted">{fmt(s.date)}</td>
                                                <td style={{ fontWeight: 600 }}>{s.mentor?.name ?? '—'}</td>
                                                <td className="text-sm">{s.group?.name ?? '—'}</td>
                                                <td className="text-sm">{s.topic}</td>
                                                <td><span className={`badge ${STATUS_BADGE[s.status] ?? ''}`}>{s.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
