'use client';

import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import {
    attendanceApi, quizApi, resumeSessionApi, resumeApi,
    dashboardApi, usersApi,
} from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type { User, ResumeSession, AttendanceStatus, StudentGrade } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'attendance' | 'pretest' | 'posttest' | 'resume' | 'memorization';

interface SessionDef {
    id: string;
    category: Category;
    label: string;
    date: string;
}

interface StudentScore {
    score: number;
    label: string;
    missing: boolean;
}

interface EnrichedGrade extends StudentGrade {
    kelas?: string;
    prodi?: string;
}

interface GradeBand {
    id: string;
    letter: string;    // e.g. "A", "B+", "C"
    minScore: number;  // score >= minScore gets this grade
    color: string;     // hex color
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_META: Record<Category, { label: string; color: string }> = {
    attendance:   { label: 'Kehadiran', color: '#16A34A' },
    pretest:      { label: 'Pretest',   color: '#2563EB' },
    posttest:     { label: 'Posttest',  color: '#7C3AED' },
    resume:       { label: 'Resume',    color: '#D97706' },
    memorization: { label: 'Hafalan',   color: '#DE902A' },
};

const CAT_BUDGET: Record<Category, number> = {
    attendance: 30, pretest: 10, posttest: 10, resume: 20, memorization: 30,
};

const ATTEND_SCORE: Record<AttendanceStatus, number> = {
    PRESENT: 100, LATE: 75, PERMIT: 50, ABSENT: 0,
};
const ATTEND_LABEL: Record<AttendanceStatus, string> = {
    PRESENT: 'Hadir', LATE: 'Terlambat', PERMIT: 'Izin', ABSENT: 'Alpha',
};

const WEIGHT_KEY     = 'simeta_grading_weights_v2';
const GRADE_BAND_KEY = 'simeta_grade_bands_v1';

const DEFAULT_BANDS: GradeBand[] = [
    { id: 'b1', letter: 'A',  minScore: 85, color: '#16A34A' },
    { id: 'b2', letter: 'B+', minScore: 75, color: '#65A30D' },
    { id: 'b3', letter: 'B',  minScore: 65, color: '#CA8A04' },
    { id: 'b4', letter: 'C+', minScore: 55, color: '#EA580C' },
    { id: 'b5', letter: 'C',  minScore: 45, color: '#DC2626' },
    { id: 'b6', letter: 'D',  minScore: 0,  color: '#9F1239' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _n = 0;
const uid = () => `${Date.now()}${++_n}`;

/** Find the best matching grade band for a score. */
function resolveGrade(score: number, bands: GradeBand[]): { letter: string; color: string } {
    const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);
    const match  = sorted.find((b) => score >= b.minScore);
    return match ?? { letter: '—', color: 'var(--color-text-secondary)' };
}

function fmtDate(s: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function distribute(budget: number, n: number): number[] {
    if (n === 0) return [];
    const base  = Math.round((budget / n) * 100) / 100;
    const arr   = Array<number>(n).fill(base);
    const drift = Math.round((budget - arr.reduce((s, v) => s + v, 0)) * 100) / 100;
    arr[n - 1]  = Math.round((arr[n - 1] + drift) * 100) / 100;
    return arr;
}

function readWeights(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(WEIGHT_KEY) ?? '{}'); } catch { return {}; }
}
function writeWeights(w: Record<string, number>) {
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(w));
}

function readBands(): GradeBand[] {
    try {
        const raw = localStorage.getItem(GRADE_BAND_KEY);
        return raw ? (JSON.parse(raw) as GradeBand[]) : DEFAULT_BANDS;
    } catch { return DEFAULT_BANDS; }
}
function writeBands(bands: GradeBand[]) {
    localStorage.setItem(GRADE_BAND_KEY, JSON.stringify(bands));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradingPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [tab, setTab] = useState<'komposisi' | 'daftar' | 'grade'>('komposisi');

    // ── Shared: user list + grade bands ───────────────────────────────────────
    const [allUsers, setAllUsers]     = useState<User[]>([]);
    const [gradeBands, setGradeBands] = useState<GradeBand[]>(DEFAULT_BANDS);

    // Load grade bands from localStorage on mount (client only)
    useEffect(() => { setGradeBands(readBands()); }, []);

    const updateBand = (id: string, patch: Partial<GradeBand>) => {
        setGradeBands((prev) => {
            const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
            writeBands(next);
            return next;
        });
    };
    const addBand = () => {
        const next = [...gradeBands, { id: uid(), letter: 'X', minScore: 0, color: '#6B7280' }];
        setGradeBands(next);
        writeBands(next);
    };
    const removeBand = (id: string) => {
        const next = gradeBands.filter((b) => b.id !== id);
        setGradeBands(next);
        writeBands(next);
    };
    const resetBands = () => { setGradeBands(DEFAULT_BANDS); writeBands(DEFAULT_BANDS); };

    // Sorted bands (descending minScore) — used for display & logic
    const sortedBands = useMemo(() =>
        [...gradeBands].sort((a, b) => b.minScore - a.minScore),
        [gradeBands]
    );

    // ══════════════════════════════════════════════════════════════════════════
    // TAB 1 — Komposisi
    // ══════════════════════════════════════════════════════════════════════════

    const [sessions, setSessions]               = useState<SessionDef[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [weights, setWeights]                 = useState<Record<string, number>>({});
    const [selectedId, setSelectedId]           = useState('');
    const [loadingScores, setLoadingScores]     = useState(false);
    const [scores, setScores]                   = useState<Record<string, StudentScore>>({});

    const loadSessions = useCallback(async () => {
        setLoadingSessions(true);
        try {
            const [attSessions, quizList, resumeSess, users] = await Promise.all([
                attendanceApi.getAll(),
                quizApi.getAll(),
                resumeSessionApi.getAll().catch(() => [] as ResumeSession[]),
                usersApi.getAll(),
            ]);
            setAllUsers(users);

            const defs: SessionDef[] = [
                ...attSessions.map((s) => ({ id: `a:${s.id}`, category: 'attendance'   as Category, label: s.title,  date: s.startTime })),
                ...quizList   .map((q) => ({ id: `q:${q.id}`, category: (q.type === 'PRETEST' ? 'pretest' : 'posttest') as Category, label: q.title, date: '' })),
                ...resumeSess .map((s) => ({ id: `r:${s.id}`, category: 'resume'        as Category, label: s.title,  date: s.closeAt  })),
                { id: 'memorization', category: 'memorization' as Category, label: 'Hafalan Al-Quran', date: '' },
            ];
            setSessions(defs);

            const stored = readWeights(), newWeights = { ...stored };
            const fresh  = defs.filter((s) => !(s.id in stored));
            if (fresh.length > 0) {
                const catCount = {} as Record<Category, number>;
                for (const s of fresh) catCount[s.category] = (catCount[s.category] ?? 0) + 1;
                const catDist  = {} as Record<Category, number[]>;
                for (const cat of Object.keys(CAT_BUDGET) as Category[]) {
                    if (catCount[cat]) catDist[cat] = distribute(CAT_BUDGET[cat], catCount[cat]);
                }
                const catIdx = {} as Record<Category, number>;
                for (const s of fresh) {
                    const i = catIdx[s.category] ?? 0; catIdx[s.category] = i + 1;
                    newWeights[s.id] = catDist[s.category]?.[i] ?? 0;
                }
            }
            setWeights(newWeights);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoadingSessions(false); }
    }, [showToast]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const setWeight = (id: string, w: number) => {
        setWeights((prev) => { const next = { ...prev, [id]: w }; writeWeights(next); return next; });
    };

    const loadScores = useCallback(async (studentId: string) => {
        if (!studentId) { setScores({}); return; }
        setLoadingScores(true);
        const result: Record<string, StudentScore> = {};
        try {
            const attIds = sessions.filter((s) => s.category === 'attendance').map((s) => s.id.slice(2));
            await Promise.all(attIds.map(async (sid) => {
                const detail = await attendanceApi.getSessionDetail(sid).catch(() => null);
                const rec    = detail?.records.find((r) => r.userId === studentId);
                const status: AttendanceStatus = rec?.status ?? 'ABSENT';
                const score  = rec ? ATTEND_SCORE[status] : 0;
                result[`a:${sid}`] = { score, label: rec ? `${ATTEND_LABEL[status]} (${score})` : 'Alpha (0)', missing: !rec || status === 'ABSENT' };
            }));
            const qIds = sessions.filter((s) => s.category === 'pretest' || s.category === 'posttest').map((s) => s.id.slice(2));
            await Promise.all(qIds.map(async (qid) => {
                const results = await quizApi.getResults(qid).catch(() => []);
                const r       = results.find((x) => x.userId === studentId);
                result[`q:${qid}`] = { score: r?.score ?? 0, label: r ? String(r.score) : 'Belum dikerjakan (0)', missing: !r };
            }));
            const allResumes = await resumeApi.getAll().catch(() => []);
            const myResumes  = allResumes.filter((r) => r.userId === studentId);
            for (const sess of sessions.filter((s) => s.category === 'resume')) {
                const rsid = sess.id.slice(2), submitted = myResumes.find((r) => r.sessionId === rsid);
                result[sess.id] = { score: submitted ? 100 : 0, label: submitted ? 'Dikumpulkan (100)' : 'Belum dikumpulkan (0)', missing: !submitted };
            }
            let memScore = 0, memDetail = '';
            try { const g = await dashboardApi.getStudentGrades(studentId); memScore = g.breakdown.memorization?.score ?? 0; memDetail = g.breakdown.memorization?.detail ?? ''; } catch { /* not fatal */ }
            result['memorization'] = { score: memScore, label: memDetail ? `${memScore} — ${memDetail}` : String(memScore), missing: memScore === 0 };
            setScores(result);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoadingScores(false); }
    }, [sessions, showToast]);

    useEffect(() => { loadScores(selectedId); }, [selectedId, loadScores]);

    const totalWeight = useMemo(() => sessions.reduce((s, sess) => s + (weights[sess.id] ?? 0), 0), [sessions, weights]);
    const isValid     = sessions.length > 0 && Math.abs(totalWeight - 100) < 0.05;
    const finalGrade  = useMemo(() => sessions.reduce((s, sess) => s + ((weights[sess.id] ?? 0) / 100) * (scores[sess.id]?.score ?? 0), 0), [sessions, weights, scores]);
    const { letter: gradeLetter, color: gradeColor } = resolveGrade(finalGrade, gradeBands);
    const tab1Students   = useMemo(() => allUsers.filter((u) => ['MENTEE', 'PESERTA', 'MENTOR'].includes(u.role)), [allUsers]);
    const selectedStudent = tab1Students.find((s) => s.id === selectedId);

    const catSummary = useMemo(() =>
        (Object.keys(CAT_META) as Category[]).map((cat) => {
            const cs = sessions.filter((s) => s.category === cat);
            return { cat, ...CAT_META[cat], count: cs.length, totalWeight: cs.reduce((s, sess) => s + (weights[sess.id] ?? 0), 0), contribution: cs.reduce((s, sess) => s + ((weights[sess.id] ?? 0) / 100) * (scores[sess.id]?.score ?? 0), 0) };
        }).filter((c) => c.count > 0),
        [sessions, weights, scores]
    );

    // ══════════════════════════════════════════════════════════════════════════
    // TAB 2 — Daftar Nilai
    // ══════════════════════════════════════════════════════════════════════════

    const [grades, setGrades]           = useState<StudentGrade[]>([]);
    const [loadingGrades, setLoadingGrades] = useState(false);
    const [gradesFetched, setGradesFetched] = useState(false);
    const [exporting, setExporting]     = useState(false);
    const [search, setSearch]           = useState('');
    const [kelasFilter, setKelasFilter] = useState('');
    const [detailModal, setDetailModal] = useState<{ open: boolean; student: StudentGrade | null }>({ open: false, student: null });

    const loadGrades = useCallback(async () => {
        setLoadingGrades(true);
        try { const data = await dashboardApi.getAllGrades(); setGrades(Array.isArray(data) ? data : []); setGradesFetched(true); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoadingGrades(false); }
    }, [showToast]);

    useEffect(() => { if (tab === 'daftar' && !gradesFetched) loadGrades(); }, [tab, gradesFetched, loadGrades]);

    const enrichedGrades = useMemo((): EnrichedGrade[] => {
        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        return grades.map((g) => { const u = g.student?.id ? userMap.get(g.student.id) : undefined; return { ...g, kelas: u?.kelas?.name, prodi: u?.prodi?.name }; });
    }, [grades, allUsers]);

    const kelasList = useMemo(() => { const s = new Set<string>(); for (const g of enrichedGrades) if (g.kelas) s.add(g.kelas); return [...s].sort(); }, [enrichedGrades]);

    const filteredGrades = useMemo(() => {
        const q = search.toLowerCase();
        return enrichedGrades.filter((g) =>
            (!q || g.student?.name?.toLowerCase().includes(q) || g.student?.email?.toLowerCase().includes(q)) &&
            (!kelasFilter || g.kelas === kelasFilter)
        );
    }, [enrichedGrades, search, kelasFilter]);

    const gradeDist = useMemo(() =>
        filteredGrades.reduce((acc, g) => { const l = resolveGrade(g.finalScore ?? 0, gradeBands).letter; acc[l] = (acc[l] ?? 0) + 1; return acc; }, {} as Record<string, number>),
        [filteredGrades, gradeBands]
    );

    const handleExportExcel = async () => {
        setExporting(true);
        try { await dashboardApi.exportExcel(); showToast('File Excel berhasil diunduh', 'success'); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setExporting(false); }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Nilai</h2>
                    <p className="page-subtitle">Komposisi bobot, daftar nilai, dan konfigurasi grade</p>
                </div>
                {tab === 'daftar' && (
                    <button className="btn btn-outline btn-sm" onClick={handleExportExcel} disabled={exporting}>
                        {exporting ? <span className="spinner spinner-sm" /> : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        )}
                        Export Excel
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="tab-nav" style={{ marginBottom: 20 }}>
                <button className={`tab-btn ${tab === 'komposisi' ? 'active' : ''}`} onClick={() => setTab('komposisi')}>Komposisi Bobot</button>
                <button className={`tab-btn ${tab === 'daftar'    ? 'active' : ''}`} onClick={() => setTab('daftar')}>Daftar Nilai</button>
                <button className={`tab-btn ${tab === 'grade'     ? 'active' : ''}`} onClick={() => setTab('grade')}>Konfigurasi Grade</button>
            </div>

            {/* ════════════ TAB 1: Komposisi ════════════ */}
            {tab === 'komposisi' && (
                <>
                    {loadingSessions ? (
                        <div className="empty-state" style={{ minHeight: 200 }}><div className="spinner spinner-lg" /><p style={{ marginTop: 12 }}>Memuat sesi…</p></div>
                    ) : (
                        <>
                            <div className={isValid ? 'info-banner' : 'warning-banner'} style={{ marginBottom: 20 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    {isValid ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                                </svg>
                                <span>Total bobot: <strong>{totalWeight.toFixed(2)}%</strong>{isValid ? ' — Valid. Berlaku sama untuk semua peserta.' : ` — Harus tepat 100% (${totalWeight < 100 ? `kurang ${(100 - totalWeight).toFixed(2)}%` : `lebih ${(totalWeight - 100).toFixed(2)}%`}).`}</span>
                            </div>

                            <div className="grading-layout">
                                <div>
                                    <div className="card">
                                        <div className="card-body" style={{ padding: 0 }}>
                                            <table className="data-table">
                                                <thead>
                                                    <tr><th>Sesi / Komponen</th><th>Tanggal</th><th style={{ width: 100 }}>Bobot (%)</th><th>Nilai / Status</th><th style={{ width: 90 }}>Kontribusi</th></tr>
                                                </thead>
                                                {(Object.keys(CAT_META) as Category[]).map((cat) => {
                                                    const catSess = sessions.filter((s) => s.category === cat);
                                                    if (catSess.length === 0) return null;
                                                    const meta = CAT_META[cat];
                                                    const catTotal = catSess.reduce((s, sess) => s + (weights[sess.id] ?? 0), 0);
                                                    return (
                                                        <tbody key={cat}>
                                                            <tr style={{ background: `${meta.color}14` }}>
                                                                <td colSpan={5} style={{ padding: '7px 16px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                                                                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: meta.color }}>{meta.label}</span>
                                                                        <span className="text-xs text-muted">({catSess.length} sesi · {catTotal.toFixed(1)}%)</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {catSess.map((sess) => {
                                                                const sc = scores[sess.id], w = weights[sess.id] ?? 0, contrib = (w / 100) * (sc?.score ?? 0), hasStu = Boolean(selectedId);
                                                                return (
                                                                    <tr key={sess.id} style={hasStu && sc?.missing ? { opacity: 0.65 } : {}}>
                                                                        <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{sess.label}</td>
                                                                        <td className="text-sm text-muted">{fmtDate(sess.date)}</td>
                                                                        <td>
                                                                            <input type="number" min={0} max={100} className="form-input" style={{ width: 70, textAlign: 'center', padding: '5px 6px', fontSize: '0.875rem' }} value={w}
                                                                                onChange={(e: ChangeEvent<HTMLInputElement>) => setWeight(sess.id, Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
                                                                        </td>
                                                                        <td>
                                                                            {loadingScores ? <span className="spinner spinner-sm" /> : hasStu
                                                                                ? <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: sc?.missing ? 'var(--color-danger)' : meta.color }}>{sc?.label ?? '—'}</span>
                                                                                : <span className="text-xs text-muted">— pilih peserta</span>}
                                                                        </td>
                                                                        <td>{hasStu && !loadingScores ? <span style={{ fontWeight: 700, color: meta.color }}>{contrib.toFixed(2)}</span> : <span className="text-xs text-muted">—</span>}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    );
                                                })}
                                                <tfoot>
                                                    <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border)' }}>
                                                        <td colSpan={2} style={{ fontWeight: 700, fontSize: '0.875rem', padding: '10px 16px' }}>Total ({sessions.length})</td>
                                                        <td style={{ padding: '10px 16px' }}><span style={{ fontWeight: 800, color: isValid ? 'var(--color-success)' : 'var(--color-danger)' }}>{totalWeight.toFixed(2)}%</span></td>
                                                        <td style={{ padding: '10px 16px' }} />
                                                        <td style={{ padding: '10px 16px' }}>{selectedId && !loadingScores && <span style={{ fontWeight: 800, color: gradeColor }}>{finalGrade.toFixed(2)}</span>}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted" style={{ marginTop: 8, paddingLeft: 4 }}>Bobot berlaku sama untuk semua peserta dan disimpan otomatis.</p>
                                </div>

                                <div style={{ position: 'sticky', top: 88 }}>
                                    <div className="card" style={{ marginBottom: 16 }}>
                                        <div className="card-header"><span style={{ fontWeight: 700 }}>Pilih Peserta</span></div>
                                        <div className="card-body" style={{ paddingTop: 12 }}>
                                            <select className="form-select" value={selectedId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedId(e.target.value)}>
                                                <option value="">-- Pilih peserta --</option>
                                                {tab1Students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.nim ? ` (${s.nim})` : ''}{s.kelas?.name ? ` — ${s.kelas.name}` : ''}</option>)}
                                            </select>
                                            {selectedStudent && <div className="text-xs text-muted" style={{ marginTop: 8 }}>{[selectedStudent.kelas?.name, selectedStudent.prodi?.name].filter(Boolean).join(' · ')}</div>}
                                        </div>
                                    </div>

                                    {selectedId ? (
                                        <>
                                            <div className="card" style={{ marginBottom: 16 }}>
                                                <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                                                    {loadingScores ? <div className="spinner spinner-lg" /> : <>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 8 }}>Nilai Akhir — {selectedStudent?.name}</div>
                                                        <div style={{ fontSize: '4.5rem', fontWeight: 900, color: gradeColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{finalGrade.toFixed(1)}</div>
                                                        <div style={{ display: 'inline-block', marginTop: 10, fontSize: '1.125rem', fontWeight: 800, color: gradeColor, background: `${gradeColor}18`, border: `1.5px solid ${gradeColor}40`, borderRadius: 'var(--radius-md)', padding: '4px 20px' }}>{gradeLetter}</div>
                                                        {!isValid && <div className="text-xs text-muted" style={{ marginTop: 10 }}>* Estimasi — bobot ≠ 100%</div>}
                                                    </>}
                                                </div>
                                            </div>
                                            {!loadingScores && (
                                                <div className="card">
                                                    <div className="card-header"><span style={{ fontWeight: 700 }}>Per Kategori</span></div>
                                                    <div className="card-body">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                            {catSummary.map(({ cat, label, color, count, totalWeight: tw, contribution }) => (
                                                                <div key={cat}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                                        <div style={{ flex: 1, fontSize: '0.875rem' }}>{label}<span className="text-xs text-muted" style={{ marginLeft: 6 }}>({count})</span></div>
                                                                        <div className="text-xs text-muted">{tw.toFixed(1)}%</div>
                                                                        <div style={{ fontWeight: 700, color, minWidth: 44, textAlign: 'right' }}>{contribution.toFixed(2)}</div>
                                                                    </div>
                                                                    <div style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginLeft: 19 }}>
                                                                        <div style={{ height: '100%', width: `${tw > 0 ? Math.min(100, (contribution / tw) * 100) : 0}%`, background: color, borderRadius: 'var(--radius-full)', transition: 'width 300ms ease' }} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                                                <span>Total</span><span style={{ color: gradeColor }}>{finalGrade.toFixed(2)} poin</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="card">
                                            <div className="card-body" style={{ textAlign: 'center', padding: '32px 20px' }}>
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                                </svg>
                                                <p className="text-sm text-muted">Pilih peserta untuk melihat nilai akhirnya</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ════════════ TAB 2: Daftar Nilai ════════════ */}
            {tab === 'daftar' && (
                <>
                    {/* Grade distribution using configured bands */}
                    <div className="stats-grid" style={{ marginBottom: 24 }}>
                        {sortedBands.map((b) => (
                            <div key={b.id} className="stat-card">
                                <div className="stat-icon" style={{ background: `${b.color}20`, color: b.color, fontWeight: 900, fontSize: '1.1rem' }}>{b.letter}</div>
                                <div className="stat-info">
                                    <div className="stat-label">Grade {b.letter} (≥{b.minScore})</div>
                                    <div className="stat-value">{gradeDist[b.letter] ?? 0}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="filter-bar" style={{ marginBottom: 16 }}>
                        <div className="search-input">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            <input type="text" placeholder="Cari nama / email…" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
                        </div>
                        <select className="form-select" style={{ maxWidth: 200 }} value={kelasFilter} onChange={(e: ChangeEvent<HTMLSelectElement>) => setKelasFilter(e.target.value)}>
                            <option value="">Semua Kelas</option>
                            {kelasList.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <span className="text-sm text-muted">{filteredGrades.length} peserta</span>
                    </div>

                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            {loadingGrades ? (
                                <div className="empty-state"><div className="spinner spinner-lg" /></div>
                            ) : filteredGrades.length === 0 ? (
                                <div className="empty-state"><p>Tidak ada data nilai</p></div>
                            ) : (
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr><th>#</th><th>Mahasiswa</th><th>Kelas</th><th>Kehadiran</th><th>Pretest</th><th>Posttest</th><th>Resume</th><th>Hafalan</th><th>Skor Final</th><th>Grade</th><th></th></tr>
                                        </thead>
                                        <tbody>
                                            {filteredGrades.map((g, idx) => {
                                                const { letter, color } = resolveGrade(g.finalScore ?? 0, gradeBands);
                                                return (
                                                    <tr key={g.student?.id ?? idx}>
                                                        <td className="text-xs text-muted">{idx + 1}</td>
                                                        <td><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{g.student?.name ?? '—'}</div><div className="text-xs text-muted">{g.student?.email}</div></td>
                                                        <td className="text-sm text-muted">{g.kelas ?? '—'}</td>
                                                        <td className="text-sm">{g.breakdown?.attendance?.score ?? '—'}</td>
                                                        <td className="text-sm">{g.breakdown?.pretest?.score ?? '—'}</td>
                                                        <td className="text-sm">{g.breakdown?.posttest?.score ?? '—'}</td>
                                                        <td className="text-sm">{g.breakdown?.resume?.score ?? '—'}</td>
                                                        <td className="text-sm">{g.breakdown?.memorization?.score ?? '—'}</td>
                                                        <td><span style={{ fontWeight: 700, fontSize: '1rem', color }}>{g.finalScore?.toFixed(1) ?? '—'}</span></td>
                                                        <td><span style={{ fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontSize: '0.8125rem' }}>{letter}</span></td>
                                                        <td>
                                                            <button className="btn btn-ghost btn-icon-sm" onClick={() => setDetailModal({ open: true, student: g })} title="Detail">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ════════════ TAB 3: Konfigurasi Grade ════════════ */}
            {tab === 'grade' && (
                <div className="grading-layout">
                    <div>
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700 }}>Skala Penilaian</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-outline btn-sm" onClick={resetBands}>Reset Default</button>
                                    <button className="btn btn-primary btn-sm" onClick={addBand}>+ Tambah Grade</button>
                                </div>
                            </div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 56 }}>Warna</th>
                                            <th style={{ width: 140 }}>Huruf Grade</th>
                                            <th>Nilai Minimum (≥)</th>
                                            <th className="text-muted text-sm">Rentang</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedBands.map((band, idx) => {
                                            const nextBand = sortedBands[idx + 1];
                                            const maxScore = idx === 0 ? 100 : sortedBands[idx - 1].minScore - 1;
                                            const rangeLabel = nextBand
                                                ? `${band.minScore} – ${maxScore}`
                                                : `0 – ${maxScore}`;
                                            return (
                                                <tr key={band.id}>
                                                    <td>
                                                        <input
                                                            type="color"
                                                            value={band.color}
                                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateBand(band.id, { color: e.target.value })}
                                                            style={{ width: 36, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'none' }}
                                                            title="Pilih warna"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="form-input"
                                                            style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center', color: band.color, width: 100, padding: '5px 8px' }}
                                                            value={band.letter}
                                                            maxLength={4}
                                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateBand(band.id, { letter: e.target.value })}
                                                            placeholder="A"
                                                        />
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <input
                                                                type="number" min={0} max={100}
                                                                className="form-input"
                                                                style={{ width: 80, textAlign: 'center', padding: '5px 8px' }}
                                                                value={band.minScore}
                                                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateBand(band.id, { minScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                                            />
                                                            <span className="text-sm text-muted">dan di atas</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: band.color, background: `${band.color}15`, padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
                                                            {rangeLabel}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-ghost btn-icon-sm"
                                                            style={{ color: 'var(--color-danger)' }}
                                                            onClick={() => removeBand(band.id)}
                                                            title="Hapus grade ini"
                                                            disabled={gradeBands.length <= 1}
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <p className="text-xs text-muted" style={{ marginTop: 8, paddingLeft: 4 }}>
                            Diurutkan otomatis dari nilai tertinggi ke terendah. Perubahan langsung berlaku di semua tab dan disimpan otomatis.
                        </p>
                    </div>

                    {/* Right: live preview */}
                    <div style={{ position: 'sticky', top: 88 }}>
                        <div className="card">
                            <div className="card-header"><span style={{ fontWeight: 700 }}>Preview Grade</span></div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sortedBands.map((band, idx) => {
                                        const prevBand  = sortedBands[idx - 1];
                                        const maxDisplay = prevBand ? prevBand.minScore - 1 : 100;
                                        return (
                                            <div key={band.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: `${band.color}10`, borderRadius: 'var(--radius-md)', border: `1px solid ${band.color}30` }}>
                                                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: band.color, minWidth: 36, textAlign: 'center' }}>{band.letter || '?'}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ height: 6, background: `${band.color}25`, borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${maxDisplay}%`, background: band.color, borderRadius: 'var(--radius-full)' }} />
                                                    </div>
                                                </div>
                                                <span className="text-sm text-muted" style={{ minWidth: 70, textAlign: 'right' }}>
                                                    {band.minScore} – {maxDisplay}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-xs text-muted" style={{ marginTop: 16, borderTop: '1px solid var(--color-border-light)', paddingTop: 12 }}>
                                    {gradeBands.length} grade terdefinisi · Grade terendah berlaku untuk semua skor di bawah {Math.min(...gradeBands.map((b) => b.minScore))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Detail Modal ── */}
            <Modal isOpen={detailModal.open} onClose={() => setDetailModal({ open: false, student: null })} title={`Nilai: ${detailModal.student?.student?.name ?? ''}`}>
                {detailModal.student && (() => {
                    const g = detailModal.student;
                    const enriched = enrichedGrades.find((e) => e.student?.id === g.student?.id);
                    const { letter, color } = resolveGrade(g.finalScore ?? 0, gradeBands);
                    const cats: { label: string; key: keyof typeof g.breakdown; cat: Category }[] = [
                        { label: 'Kehadiran', key: 'attendance',   cat: 'attendance'   },
                        { label: 'Pretest',   key: 'pretest',      cat: 'pretest'      },
                        { label: 'Posttest',  key: 'posttest',     cat: 'posttest'     },
                        { label: 'Resume',    key: 'resume',       cat: 'resume'       },
                        { label: 'Hafalan',   key: 'memorization', cat: 'memorization' },
                    ];
                    return (
                        <div>
                            {enriched?.kelas && <div className="text-sm text-muted" style={{ marginBottom: 16 }}>{[enriched.kelas, enriched.prodi].filter(Boolean).join(' · ')}</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {cats.map(({ label, key, cat }) => {
                                    const item = g.breakdown?.[key], score = item?.score ?? 0, catColor = CAT_META[cat].color;
                                    return (
                                        <div key={key}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span className="text-sm" style={{ fontWeight: 600 }}>{label}</span>
                                                <span style={{ fontWeight: 700, color: catColor }}>{score}</span>
                                            </div>
                                            <div style={{ height: 6, background: 'var(--color-border-light)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${Math.min(score, 100)}%`, background: catColor, borderRadius: 'var(--radius-full)', transition: 'width 500ms ease' }} />
                                            </div>
                                            {item?.detail && <p className="text-xs text-muted" style={{ marginTop: 2 }}>{item.detail}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: 24, padding: 20, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p className="text-sm text-muted">Skor Final</p>
                                <p style={{ fontSize: '2.5rem', fontWeight: 900, color, lineHeight: 1.1 }}>{g.finalScore?.toFixed(1) ?? '—'}</p>
                                <div style={{ marginTop: 8 }}>
                                    <span style={{ fontWeight: 700, color, background: `${color}18`, border: `1.5px solid ${color}40`, borderRadius: 'var(--radius-md)', padding: '4px 16px', fontSize: '1rem' }}>{letter}</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
