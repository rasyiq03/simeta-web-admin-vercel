/**
 * =============================================================
 * SIMETA CMS — Grades / Ranking Page (TypeScript)
 * Lihat nilai semua mahasiswa (ranking), detail breakdown,
 * dan distribusi grade. Hanya diakses oleh ADMIN.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { dashboardApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useSemester } from '@/lib/semester-context';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import type { StudentGrade, LetterGrade } from '@/types';

/** State modal detail nilai */
interface DetailModalState {
    open: boolean;
    student: StudentGrade | null;
}

/** Konfigurasi breakdown scoring */
interface BreakdownConfig {
    label: string;
    key: string;
    weight: string;
}

const breakdownItems: BreakdownConfig[] = [
    { label: 'Absensi', key: 'attendance', weight: '30%' },
    { label: 'Pretest', key: 'pretest', weight: '10%' },
    { label: 'Posttest', key: 'posttest', weight: '10%' },
    { label: 'Resume', key: 'resume', weight: '20%' },
    { label: 'Hafalan', key: 'memorization', weight: '30%' },
];

/**
 * Warna berdasarkan skor
 */
const scoreColor = (score: number): string => {
    if (score >= 85) return 'var(--color-success)';
    if (score >= 75) return 'var(--color-info)';
    if (score >= 65) return 'var(--color-amber)';
    if (score >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
};

export default function GradesPage(): React.JSX.Element {
    const [grades, setGrades] = useState<StudentGrade[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [exporting, setExporting] = useState(false);
    const [search, setSearch] = useState<string>('');
    const [detailModal, setDetailModal] = useState<DetailModalState>({ open: false, student: null });
    const { showToast } = useToast();
    const { selectedSemesterId } = useSemester();

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await dashboardApi.exportExcel();
            showToast('File Excel berhasil diunduh', 'success');
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setExporting(false);
        }
    };

    /** Fetch ranking semua mahasiswa */
    const fetchGrades = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const data = await dashboardApi.getAllGrades(selectedSemesterId || undefined);
            setGrades(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast, selectedSemesterId]);

    useEffect(() => { fetchGrades(); }, [fetchGrades]);

    /** Hitung distribusi grade */
    const gradeDistribution: Record<string, number> = grades.reduce((acc, g) => {
        const letter = g.letterGrade || '—';
        acc[letter] = (acc[letter] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    /** Filter by search */
    const filteredGrades = grades.filter((g) => {
        if (!search) return true;
        return g.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
            g.student?.email?.toLowerCase().includes(search.toLowerCase());
    });

    /** Grade distribution card config */
    const gradeCards: { letter: LetterGrade; colorClass: string }[] = [
        { letter: 'A', colorClass: 'success' },
        { letter: 'B', colorClass: 'info' },
        { letter: 'C', colorClass: 'amber' },
        { letter: 'D', colorClass: 'amber' },
        { letter: 'E', colorClass: 'danger' },
    ];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Nilai & Ranking</h2>
                    <p className="page-subtitle">Lihat nilai agregat semua mahasiswa</p>
                </div>
                <button
                    className="btn btn-outline btn-sm"
                    onClick={handleExportExcel}
                    disabled={exporting}
                >
                    {exporting ? <span className="spinner" /> : '⬇ Export Excel'}
                </button>
            </div>

            {/* Grade Distribution Cards */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {gradeCards.map(({ letter, colorClass }) => (
                    <div key={letter} className="stat-card">
                        <div className={`stat-icon ${colorClass}`}>{letter}</div>
                        <div className="stat-info">
                            <div className="stat-label">Grade {letter}</div>
                            <div className="stat-value">{gradeDistribution[letter] || 0}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="filter-bar">
                <div className="search-input">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                    </svg>
                    <input type="text" placeholder="Cari mahasiswa..."
                        value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
                </div>
                <span className="text-sm text-muted">{filteredGrades.length} mahasiswa</span>
            </div>

            {/* Ranking Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner spinner-lg" /></div>
                    ) : filteredGrades.length === 0 ? (
                        <div className="empty-state"><p>Tidak ada data nilai</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Mahasiswa</th>
                                        <th>Absensi</th>
                                        <th>Pretest</th>
                                        <th>Posttest</th>
                                        <th>Resume</th>
                                        <th>Hafalan</th>
                                        <th>Skor Final</th>
                                        <th>Grade</th>
                                        <th>Detail</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGrades.map((g, idx) => (
                                        <tr key={g.student?.id || idx}>
                                            <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{g.student?.name || '-'}</div>
                                                    <div className="text-xs text-muted">{g.student?.email || ''}</div>
                                                </div>
                                            </td>
                                            <td className="text-sm">{g.breakdown?.attendance?.score ?? '—'}</td>
                                            <td className="text-sm">{g.breakdown?.pretest?.score ?? '—'}</td>
                                            <td className="text-sm">{g.breakdown?.posttest?.score ?? '—'}</td>
                                            <td className="text-sm">{g.breakdown?.resume?.score ?? '—'}</td>
                                            <td className="text-sm">{g.breakdown?.memorization?.score ?? '—'}</td>
                                            <td>
                                                <span style={{ fontWeight: 700, fontSize: '1rem', color: scoreColor(g.finalScore) }}>
                                                    {g.finalScore?.toFixed(1) ?? '—'}
                                                </span>
                                            </td>
                                            <td><StatusBadge status={g.letterGrade || '—'} /></td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm"
                                                    onClick={() => setDetailModal({ open: true, student: g })}>👁️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Detail Nilai */}
            <Modal
                isOpen={detailModal.open}
                onClose={() => setDetailModal({ open: false, student: null })}
                title={`Nilai: ${detailModal.student?.student?.name || ''}`}
            >
                {detailModal.student && (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {breakdownItems.map(({ label, key, weight }) => {
                                const breakdown = detailModal.student!.breakdown;
                                const item = breakdown?.[key as keyof typeof breakdown];
                                const score = item?.score ?? 0;
                                return (
                                    <div key={key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span className="text-sm" style={{ fontWeight: 500 }}>
                                                {label} <span className="text-xs text-muted">({weight})</span>
                                            </span>
                                            <span className="text-sm" style={{ fontWeight: 600, color: scoreColor(score) }}>{score}</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', width: `${Math.min(score, 100)}%`, background: scoreColor(score),
                                                borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease',
                                            }} />
                                        </div>
                                        {item?.detail && <p className="text-xs text-muted" style={{ marginTop: 2 }}>{item.detail}</p>}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{
                            marginTop: 24, padding: 20, background: 'var(--color-bg)',
                            borderRadius: 'var(--radius-md)', textAlign: 'center',
                        }}>
                            <p className="text-sm text-muted">Skor Final</p>
                            <p style={{
                                fontSize: '2rem', fontWeight: 800, color: scoreColor(detailModal.student.finalScore), lineHeight: 1.2,
                            }}>
                                {detailModal.student.finalScore?.toFixed(1) ?? '—'}
                            </p>
                            <div style={{ marginTop: 8 }}>
                                <StatusBadge status={detailModal.student.letterGrade || '—'} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
