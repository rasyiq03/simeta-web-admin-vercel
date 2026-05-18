'use client';

/**
 * SIMETA CMS — Manajemen Access Window (Gambar 4.7.1)
 * Atur jendela buka–tutup untuk fitur QUIZ / BAM / ABSENSI.
 */

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { accessWindowApi, toISO } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import type { AccessWindow, AccessWindowFeature } from '@/types';

const FEATURES: AccessWindowFeature[] = ['QUIZ', 'BAM', 'ABSENSI'];
const FEATURE_LABEL: Record<AccessWindowFeature, string> = {
    QUIZ: 'Kuis', BAM: 'BAM', ABSENSI: 'Absensi',
};

function isNotFound(err: unknown): boolean {
    const m = (err as Error)?.message ?? '';
    return /404|not found|cannot (get|post)/i.test(m);
}
function toLocalInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmt(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function AccessWindowPage(): React.JSX.Element {
    const { showToast } = useToast();
    const [list, setList] = useState<AccessWindow[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [modal, setModal] = useState(false);
    const [edit, setEdit] = useState<AccessWindow | null>(null);
    const [form, setForm] = useState({ feature: 'QUIZ' as AccessWindowFeature, openAt: '', closeAt: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setPageError(null);
        try {
            setList(await accessWindowApi.getAll());
        } catch (err) {
            if (isNotFound(err)) setPageError('Endpoint /access-windows belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        } finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const openModal = (w?: AccessWindow) => {
        setEdit(w ?? null);
        setForm({
            feature: w?.feature ?? 'QUIZ',
            openAt: toLocalInput(w?.openAt),
            closeAt: toLocalInput(w?.closeAt),
        });
        setModal(true);
    };

    const save = async () => {
        if (!form.openAt || !form.closeAt) { showToast('Waktu buka & tutup wajib diisi', 'error'); return; }
        setSaving(true);
        try {
            if (edit) {
                await accessWindowApi.update(edit.id, {
                    feature: form.feature,
                    openAt: toISO(form.openAt),
                    closeAt: toISO(form.closeAt),
                });
                showToast('Access window diperbarui', 'success');
            } else {
                await accessWindowApi.create({
                    feature: form.feature,
                    openAt: toISO(form.openAt) as string,
                    closeAt: toISO(form.closeAt) as string,
                });
                showToast('Access window dibuat', 'success');
            }
            setModal(false);
            await load();
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Access Window</h2>
                    <p className="page-subtitle">Atur kapan fitur Kuis, BAM, dan Absensi dibuka untuk peserta</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => openModal()} disabled={!!pageError}>
                        + Tambah Jadwal
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
                        {list.length === 0 ? (
                            <div className="empty-state"><p>Belum ada jadwal access window</p></div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr><th>#</th><th>Fitur</th><th>Buka</th><th>Tutup</th><th>Status</th><th>Aksi</th></tr>
                                </thead>
                                <tbody>
                                    {list.map((w, i) => (
                                        <tr key={w.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{FEATURE_LABEL[w.feature]}</td>
                                            <td className="text-sm text-muted">{fmt(w.openAt)}</td>
                                            <td className="text-sm text-muted">{fmt(w.closeAt)}</td>
                                            <td>
                                                {w.isOpen
                                                    ? <span className="badge badge-success">Terbuka</span>
                                                    : <span className="badge badge-warning">Tertutup</span>}
                                            </td>
                                            <td>
                                                <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openModal(w)} title="Edit">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Access Window' : 'Tambah Access Window'} size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Fitur</label>
                        <select className="form-select" value={form.feature}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, feature: e.target.value as AccessWindowFeature }))}>
                            {FEATURES.map((ff) => <option key={ff} value={ff}>{FEATURE_LABEL[ff]}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Buka</label>
                        <input className="form-input" type="datetime-local" value={form.openAt}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, openAt: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Waktu Tutup</label>
                        <input className="form-input" type="datetime-local" value={form.closeAt}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, closeAt: e.target.value }))} />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
