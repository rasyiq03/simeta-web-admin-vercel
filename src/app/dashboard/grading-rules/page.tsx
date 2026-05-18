'use client';

/**
 * SIMETA CMS — Grading Rules & Simulasi Dry-Run (Gambar 4.6.2)
 * Menampilkan aturan komposisi nilai aktif + simulator yang menghitung
 * nilai akhir & grade dari skor contoh TANPA menyimpan apa pun (dry-run).
 */

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { gradingApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { GradingComposition } from '@/types';

const COMPONENTS = [
    { key: 'attendance',   label: 'Absensi' },
    { key: 'pretest',      label: 'Pretest' },
    { key: 'posttest',     label: 'Posttest' },
    { key: 'resume',       label: 'Resume' },
    { key: 'memorization', label: 'Hafalan' },
] as const;

type CompKey = typeof COMPONENTS[number]['key'];

const GRADE_BANDS: { min: number; grade: string; color: string }[] = [
    { min: 85, grade: 'A', color: 'var(--color-success)' },
    { min: 75, grade: 'B', color: 'var(--color-info)' },
    { min: 65, grade: 'C', color: 'var(--color-amber)' },
    { min: 50, grade: 'D', color: 'var(--color-warning)' },
    { min: 0,  grade: 'E', color: 'var(--color-danger)' },
];
const letterOf = (s: number) => GRADE_BANDS.find((b) => s >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];

export default function GradingRulesPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [comp, setComp] = useState<GradingComposition | null>(null);
    const [loading, setLoading] = useState(true);
    const [scores, setScores] = useState<Record<CompKey, number>>({
        attendance: 80, pretest: 70, posttest: 85, resume: 75, memorization: 90,
    });

    const load = useCallback(async () => {
        setLoading(true);
        try { setComp(await gradingApi.getComposition()); }
        catch (err) { showToast((err as Error).message, 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const weights = useMemo<Record<CompKey, number>>(() => ({
        attendance: comp?.attendance ?? 0,
        pretest: comp?.pretest ?? 0,
        posttest: comp?.posttest ?? 0,
        resume: comp?.resume ?? 0,
        memorization: comp?.memorization ?? 0,
    }), [comp]);

    const totalWeight = COMPONENTS.reduce((a, c) => a + weights[c.key], 0);
    const finalScore = COMPONENTS.reduce((a, c) => a + (scores[c.key] * weights[c.key]) / 100, 0);
    const band = letterOf(finalScore);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Grading Rules &amp; Simulasi</h2>
                    <p className="page-subtitle">Aturan komposisi nilai aktif dan simulator dry-run (tidak menyimpan data)</p>
                </div>
            </div>

            {loading ? (
                <div className="empty-state" style={{ minHeight: 200 }}><div className="spinner spinner-lg" /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
                    {/* Rules */}
                    <div className="card">
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Aturan Komposisi Aktif</span></div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <table className="data-table">
                                <thead><tr><th>Komponen</th><th>Bobot</th></tr></thead>
                                <tbody>
                                    {COMPONENTS.map((c) => (
                                        <tr key={c.key}>
                                            <td style={{ fontWeight: 600 }}>{c.label}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--color-border-light)', borderRadius: 999, maxWidth: 140 }}>
                                                        <div style={{ width: `${weights[c.key]}%`, height: '100%', background: 'var(--color-navy)', borderRadius: 999 }} />
                                                    </div>
                                                    <span className="text-sm" style={{ fontWeight: 600 }}>{weights[c.key]}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td style={{ fontWeight: 700 }}>Total</td>
                                        <td style={{ fontWeight: 700, color: totalWeight === 100 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {totalWeight}% {totalWeight === 100 ? '✓' : '(harus 100%)'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style={{ padding: 12 }}>
                                <p className="text-xs text-muted">Skala grade: A ≥ 85 · B ≥ 75 · C ≥ 65 · D ≥ 50 · E &lt; 50</p>
                            </div>
                        </div>
                    </div>

                    {/* Dry-run */}
                    <div className="card">
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Simulasi Dry-Run</span></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p className="text-xs text-muted">Ubah skor contoh untuk melihat nilai akhir tanpa menyimpan apa pun.</p>
                            {COMPONENTS.map((c) => (
                                <div key={c.key} className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{c.label}</span>
                                        <span className="text-muted">bobot {weights[c.key]}%</span>
                                    </label>
                                    <input className="form-input" type="number" min={0} max={100} value={scores[c.key]}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                            setScores((s) => ({ ...s, [c.key]: v }));
                                        }} />
                                </div>
                            ))}
                            <div style={{
                                marginTop: 6, padding: 16, borderRadius: 'var(--radius-md)',
                                background: 'var(--color-surface-2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div>
                                    <div className="text-sm text-muted">Nilai Akhir (dry-run)</div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: band.color }}>
                                        {finalScore.toFixed(2)}
                                    </div>
                                </div>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%', background: band.color,
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800,
                                }}>
                                    {band.grade}
                                </div>
                            </div>
                            {totalWeight !== 100 && (
                                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                                    Catatan: total bobot {totalWeight}% ≠ 100%, hasil simulasi mungkin tidak proporsional.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
