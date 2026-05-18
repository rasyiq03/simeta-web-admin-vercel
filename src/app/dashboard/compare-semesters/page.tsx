'use client';

/**
 * SIMETA CMS — Perbandingan Antar-Semester (Gambar 4.9.2)
 * Pilih dua semester → bandingkan statistik & rata-rata nilai.
 */

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { semesterApi, dashboardApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { Semester, StudentGrade } from '@/types';

interface SemStat {
    semester: Semester;
    grades: StudentGrade[];
    avg: number;
    dist: Record<string, number>;
}

async function buildStat(s: Semester): Promise<SemStat> {
    let grades: StudentGrade[] = [];
    try { grades = await dashboardApi.getAllGrades(s.id); } catch { grades = []; }
    const avg = grades.length
        ? grades.reduce((a, g) => a + (g.finalScore || 0), 0) / grades.length
        : 0;
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const g of grades) dist[g.letterGrade] = (dist[g.letterGrade] ?? 0) + 1;
    return { semester: s, grades, avg, dist };
}

function StatCol({ stat }: { stat: SemStat | null }) {
    if (!stat) return <div className="empty-state"><p className="text-sm text-muted">Pilih semester</p></div>;
    const c = stat.semester._count ?? {};
    const rows: [string, string | number][] = [
        ['Peserta (enrollment)', c.enrollments ?? 0],
        ['Sesi Absensi', c.attendanceSessions ?? 0],
        ['Kuis', c.quizzes ?? 0],
        ['Kelompok Mentoring', c.mentoringGroups ?? 0],
        ['Jumlah Nilai Terhitung', stat.grades.length],
        ['Rata-rata Nilai Akhir', stat.avg.toFixed(2)],
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{stat.semester.code}</div>
            <div className="text-xs text-muted">{stat.semester.name}</div>
            {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                    <span className="text-sm" style={{ fontWeight: 600 }}>{k}</span>
                    <span className="text-sm">{v}</span>
                </div>
            ))}
            <div style={{ marginTop: 4 }}>
                <div className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>Distribusi Grade</div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => (
                        <div key={g} style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontWeight: 700 }}>{stat.dist[g] ?? 0}</div>
                            <div className="text-xs text-muted">{g}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function CompareSemestersPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [aId, setAId] = useState('');
    const [bId, setBId] = useState('');
    const [statA, setStatA] = useState<SemStat | null>(null);
    const [statB, setStatB] = useState<SemStat | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const list = await semesterApi.list();
                const sorted = [...list].sort((x, y) => new Date(y.startDate).getTime() - new Date(x.startDate).getTime());
                setSemesters(sorted);
                if (sorted[0]) setAId(sorted[0].id);
                if (sorted[1]) setBId(sorted[1].id);
            } catch (err) { showToast((err as Error).message, 'error'); }
        })();
    }, [showToast]);

    const compare = useCallback(async () => {
        if (!aId || !bId) { showToast('Pilih dua semester', 'error'); return; }
        if (aId === bId) { showToast('Pilih dua semester berbeda', 'error'); return; }
        setLoading(true);
        try {
            const a = semesters.find((s) => s.id === aId)!;
            const b = semesters.find((s) => s.id === bId)!;
            const [sa, sb] = await Promise.all([buildStat(a), buildStat(b)]);
            setStatA(sa); setStatB(sb);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [aId, bId, semesters, showToast]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Perbandingan Antar-Semester</h2>
                    <p className="page-subtitle">Bandingkan statistik &amp; capaian nilai dua semester</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                        <label className="form-label">Semester A</label>
                        <select className="form-select" value={aId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setAId(e.target.value)}>
                            <option value="">— pilih —</option>
                            {semesters.map((s) => <option key={s.id} value={s.id}>{s.code}{s.isActive ? ' (aktif)' : ''}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                        <label className="form-label">Semester B</label>
                        <select className="form-select" value={bId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setBId(e.target.value)}>
                            <option value="">— pilih —</option>
                            {semesters.map((s) => <option key={s.id} value={s.id}>{s.code}{s.isActive ? ' (aktif)' : ''}</option>)}
                        </select>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={compare} disabled={loading}>
                        {loading ? <span className="spinner spinner-sm" /> : null} Bandingkan
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card"><div className="card-body"><StatCol stat={statA} /></div></div>
                <div className="card"><div className="card-body"><StatCol stat={statB} /></div></div>
            </div>

            {statA && statB && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="text-sm" style={{ fontWeight: 600 }}>Selisih rata-rata nilai (A − B):</span>
                        <span style={{
                            fontWeight: 800,
                            color: statA.avg - statB.avg >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                            {(statA.avg - statB.avg >= 0 ? '+' : '') + (statA.avg - statB.avg).toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
