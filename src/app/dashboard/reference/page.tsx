'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { referenceApi, usersApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import { UPLOAD_SETTINGS_KEY, getUploadSettings, type UploadSettings } from '@/components/ImageUpload';
import type { Jurusan, Prodi, Kelas, Kategori, DosenKelas, User } from '@/types';

type TabKey = 'jurusan' | 'prodi' | 'kelas' | 'kategori' | 'dosen-kelas' | 'upload';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'jurusan',    label: 'Jurusan' },
    { key: 'prodi',      label: 'Program Studi' },
    { key: 'kelas',      label: 'Kelas' },
    { key: 'kategori',   label: 'Kategori' },
    { key: 'dosen-kelas', label: 'Dosen Pengampu' },
    { key: 'upload',     label: 'Pengaturan Upload' },
];

function isNotFound(err: unknown): boolean {
    const msg = (err as Error)?.message ?? '';
    return msg.includes('Cannot GET') || msg.includes('404') || msg.includes('Not Found');
}

export default function ReferencePage(): React.JSX.Element {
    const [tab, setTab] = useState<TabKey>('jurusan');
    const { showToast } = useToast();

    // ── Jurusan state ──
    const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
    const [jurusanModal, setJurusanModal] = useState(false);
    const [editJurusan, setEditJurusan] = useState<Jurusan | null>(null);
    const [jurusanName, setJurusanName] = useState('');
    const [savingJurusan, setSavingJurusan] = useState(false);

    // ── Prodi state ──
    const [prodiList, setProdiList] = useState<Prodi[]>([]);
    const [prodiModal, setProdiModal] = useState(false);
    const [editProdi, setEditProdi] = useState<Prodi | null>(null);
    const [prodiForm, setProdiForm] = useState({ name: '', jurusanId: '' });
    const [savingProdi, setSavingProdi] = useState(false);

    // ── Kelas state ──
    const [kelasList, setKelasList] = useState<Kelas[]>([]);
    const [kelasModal, setKelasModal] = useState(false);
    const [editKelas, setEditKelas] = useState<Kelas | null>(null);
    const [kelasForm, setKelasForm] = useState({ name: '', prodiId: '' });
    const [savingKelas, setSavingKelas] = useState(false);

    // ── Kategori state ──
    const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
    const [kategoriModal, setKategoriModal] = useState(false);
    const [editKategori, setEditKategori] = useState<Kategori | null>(null);
    const [kategoriName, setKategoriName] = useState('');
    const [savingKategori, setSavingKategori] = useState(false);

    // ── DosenKelas state ──
    const [dosenKelasList, setDosenKelasList] = useState<DosenKelas[]>([]);
    const [dosenKelasModal, setDosenKelasModal] = useState(false);
    const [dosenKelasForm, setDosenKelasForm] = useState({ dosenId: '', kelasId: '' });
    const [savingDosenKelas, setSavingDosenKelas] = useState(false);
    const [dosenList, setDosenList] = useState<User[]>([]);

    // ── Upload settings (localStorage, client-only) ──
    const [uploadSettings, setUploadSettings] = useState<UploadSettings>({ folderId: '', maxSizeMB: 5 });
    const [uploadSaved, setUploadSaved] = useState(false);

    // ── Loading / error state per tab ──
    const [loading, setLoading] = useState(false);
    const [tabError, setTabError] = useState<string | null>(null);

    const loadJurusan = useCallback(async () => {
        setLoading(true); setTabError(null);
        try { setJurusanList(await referenceApi.getJurusan()); }
        catch (err) {
            if (isNotFound(err)) setTabError('Endpoint /reference/jurusan belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        }
        finally { setLoading(false); }
    }, [showToast]);

    const loadProdi = useCallback(async () => {
        setLoading(true); setTabError(null);
        try { setProdiList(await referenceApi.getProdi()); }
        catch (err) {
            if (isNotFound(err)) setTabError('Endpoint /reference/prodi belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        }
        finally { setLoading(false); }
    }, [showToast]);

    const loadKelas = useCallback(async () => {
        setLoading(true); setTabError(null);
        try { setKelasList(await referenceApi.getKelas()); }
        catch (err) {
            if (isNotFound(err)) setTabError('Endpoint /reference/kelas belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        }
        finally { setLoading(false); }
    }, [showToast]);

    const loadKategori = useCallback(async () => {
        setLoading(true); setTabError(null);
        try { setKategoriList(await referenceApi.getKategori()); }
        catch (err) {
            if (isNotFound(err)) setTabError('Endpoint /reference/kategori belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        }
        finally { setLoading(false); }
    }, [showToast]);

    const loadDosenKelas = useCallback(async () => {
        setLoading(true); setTabError(null);
        try {
            const allUsers = await usersApi.getAll();
            const dosenUsers = allUsers.filter((u) => u.role === 'DOSEN');
            setDosenList(dosenUsers);
            const results = await Promise.all(
                dosenUsers.map((d) => referenceApi.getKelasByDosen(d.id).catch(() => [] as DosenKelas[]))
            );
            setDosenKelasList(results.flat());
        } catch (err) {
            if (isNotFound(err)) setTabError('Endpoint dosen-kelas belum tersedia di backend.');
            else showToast((err as Error).message, 'error');
        }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => {
        setTabError(null);
        if (tab === 'jurusan')    loadJurusan();
        if (tab === 'prodi')      { loadJurusan(); loadProdi(); }
        if (tab === 'kelas')      { loadProdi(); loadKelas(); }
        if (tab === 'kategori')   loadKategori();
        if (tab === 'dosen-kelas') { loadKelas(); loadDosenKelas(); }
        if (tab === 'upload')     setUploadSettings(getUploadSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // ── Jurusan CRUD ──
    const saveJurusan = async () => {
        if (!jurusanName.trim()) { showToast('Nama jurusan wajib diisi', 'error'); return; }
        setSavingJurusan(true);
        try {
            if (editJurusan) {
                const updated = await referenceApi.updateJurusan(editJurusan.id, { name: jurusanName.trim() });
                setJurusanList((l) => l.map((j) => j.id === updated.id ? updated : j));
            } else {
                const created = await referenceApi.createJurusan({ name: jurusanName.trim() });
                setJurusanList((l) => [...l, created]);
            }
            showToast('Jurusan disimpan', 'success');
            setJurusanModal(false);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSavingJurusan(false); }
    };
    const deleteJurusan = async (j: Jurusan) => {
        if (!confirm(`Hapus jurusan "${j.name}"?`)) return;
        try {
            await referenceApi.deleteJurusan(j.id);
            setJurusanList((l) => l.filter((x) => x.id !== j.id));
            showToast('Jurusan dihapus', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Prodi CRUD ──
    const saveProdi = async () => {
        if (!prodiForm.name.trim() || !prodiForm.jurusanId) { showToast('Nama dan jurusan wajib diisi', 'error'); return; }
        setSavingProdi(true);
        try {
            if (editProdi) {
                const updated = await referenceApi.updateProdi(editProdi.id, prodiForm);
                setProdiList((l) => l.map((p) => p.id === updated.id ? updated : p));
            } else {
                const created = await referenceApi.createProdi({ name: prodiForm.name.trim(), jurusanId: prodiForm.jurusanId });
                setProdiList((l) => [...l, created]);
            }
            showToast('Program studi disimpan', 'success');
            setProdiModal(false);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSavingProdi(false); }
    };
    const deleteProdi = async (p: Prodi) => {
        if (!confirm(`Hapus prodi "${p.name}"?`)) return;
        try {
            await referenceApi.deleteProdi(p.id);
            setProdiList((l) => l.filter((x) => x.id !== p.id));
            showToast('Prodi dihapus', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Kelas CRUD ──
    const saveKelas = async () => {
        if (!kelasForm.name.trim() || !kelasForm.prodiId) { showToast('Nama kelas dan prodi wajib diisi', 'error'); return; }
        setSavingKelas(true);
        try {
            if (editKelas) {
                const updated = await referenceApi.updateKelas(editKelas.id, kelasForm);
                setKelasList((l) => l.map((k) => k.id === updated.id ? updated : k));
            } else {
                const created = await referenceApi.createKelas({ name: kelasForm.name.trim(), prodiId: kelasForm.prodiId });
                setKelasList((l) => [...l, created]);
            }
            showToast('Kelas disimpan', 'success');
            setKelasModal(false);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSavingKelas(false); }
    };
    const deleteKelas = async (k: Kelas) => {
        if (!confirm(`Hapus kelas "${k.name}"?`)) return;
        try {
            await referenceApi.deleteKelas(k.id);
            setKelasList((l) => l.filter((x) => x.id !== k.id));
            showToast('Kelas dihapus', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Kategori CRUD ──
    const saveKategori = async () => {
        if (!kategoriName.trim()) { showToast('Nama kategori wajib diisi', 'error'); return; }
        setSavingKategori(true);
        try {
            if (editKategori) {
                const updated = await referenceApi.updateKategori(editKategori.id, { name: kategoriName.trim() });
                setKategoriList((l) => l.map((k) => k.id === updated.id ? updated : k));
            } else {
                const created = await referenceApi.createKategori({ name: kategoriName.trim() });
                setKategoriList((l) => [...l, created]);
            }
            showToast('Kategori disimpan', 'success');
            setKategoriModal(false);
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSavingKategori(false); }
    };
    const deleteKategori = async (k: Kategori) => {
        if (!confirm(`Hapus kategori "${k.name}"?`)) return;
        try {
            await referenceApi.deleteKategori(k.id);
            setKategoriList((l) => l.filter((x) => x.id !== k.id));
            showToast('Kategori dihapus', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── DosenKelas ──
    const saveDosenKelas = async () => {
        if (!dosenKelasForm.dosenId || !dosenKelasForm.kelasId) { showToast('Pilih dosen dan kelas', 'error'); return; }
        setSavingDosenKelas(true);
        try {
            const created = await referenceApi.assignDosenKelas(dosenKelasForm);
            setDosenKelasList((l) => [...l, created]);
            showToast('Dosen pengampu ditambahkan', 'success');
            setDosenKelasModal(false);
            setDosenKelasForm({ dosenId: '', kelasId: '' });
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSavingDosenKelas(false); }
    };
    const removeDosenKelas = async (dk: DosenKelas) => {
        if (!confirm('Hapus penugasan dosen ini?')) return;
        try {
            await referenceApi.removeDosenKelas(dk.id);
            setDosenKelasList((l) => l.filter((x) => x.id !== dk.id));
            showToast('Penugasan dihapus', 'success');
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    const openJurusanModal = (j?: Jurusan) => {
        setEditJurusan(j ?? null);
        setJurusanName(j?.name ?? '');
        setJurusanModal(true);
    };
    const openProdiModal = (p?: Prodi) => {
        setEditProdi(p ?? null);
        setProdiForm({ name: p?.name ?? '', jurusanId: p?.jurusanId ?? '' });
        setProdiModal(true);
    };
    const openKelasModal = (k?: Kelas) => {
        setEditKelas(k ?? null);
        setKelasForm({ name: k?.name ?? '', prodiId: k?.prodiId ?? '' });
        setKelasModal(true);
    };
    const openKategoriModal = (k?: Kategori) => {
        setEditKategori(k ?? null);
        setKategoriName(k?.name ?? '');
        setKategoriModal(true);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Data Referensi</h2>
                    <p className="page-subtitle">Kelola data master: jurusan, prodi, kelas, kategori, dan dosen pengampu</p>
                </div>
                <div className="page-actions">
                    {tab === 'jurusan'     && <button className="btn btn-primary btn-sm" onClick={() => openJurusanModal()}>+ Tambah Jurusan</button>}
                    {tab === 'prodi'       && <button className="btn btn-primary btn-sm" onClick={() => openProdiModal()}>+ Tambah Prodi</button>}
                    {tab === 'kelas'       && <button className="btn btn-primary btn-sm" onClick={() => openKelasModal()}>+ Tambah Kelas</button>}
                    {tab === 'kategori'    && <button className="btn btn-primary btn-sm" onClick={() => openKategoriModal()}>+ Tambah Kategori</button>}
                    {tab === 'dosen-kelas' && <button className="btn btn-primary btn-sm" onClick={() => setDosenKelasModal(true)}>+ Tambah Pengampu</button>}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-nav" style={{ marginBottom: 20 }}>
                {TABS.map((t) => (
                    <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && <div className="empty-state" style={{ minHeight: 200 }}><div className="spinner spinner-lg" /></div>}

            {!loading && tabError && (
                <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Endpoint belum tersedia</div>
                            <div className="text-sm text-muted">{tabError} Hubungi tim backend untuk mengimplementasikan endpoint ini.</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Jurusan tab ── */}
            {!loading && !tabError && tab === 'jurusan' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {jurusanList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada jurusan</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Nama Jurusan</th><th>Jumlah Prodi</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {jurusanList.map((j, i) => (
                                        <tr key={j.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{j.name}</td>
                                            <td className="text-sm text-muted">{j._count?.prodis ?? '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openJurusanModal(j)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteJurusan(j)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Prodi tab ── */}
            {!loading && !tabError && tab === 'prodi' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {prodiList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada program studi</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Nama Prodi</th><th>Jurusan</th><th>Jumlah Kelas</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {prodiList.map((p, i) => (
                                        <tr key={p.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                                            <td className="text-sm text-muted">{p.jurusan?.name ?? '—'}</td>
                                            <td className="text-sm text-muted">{p._count?.kelas ?? '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openProdiModal(p)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteProdi(p)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Kelas tab ── */}
            {!loading && !tabError && tab === 'kelas' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {kelasList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada kelas</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Nama Kelas</th><th>Program Studi</th><th>Jumlah Anggota</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {kelasList.map((k, i) => (
                                        <tr key={k.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{k.name}</td>
                                            <td className="text-sm text-muted">{k.prodi?.name ?? '—'}</td>
                                            <td className="text-sm text-muted">{k._count?.members ?? '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openKelasModal(k)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteKelas(k)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Kategori tab ── */}
            {!loading && !tabError && tab === 'kategori' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {kategoriList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada kategori</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Nama Kategori</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {kategoriList.map((k, i) => (
                                        <tr key={k.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{k.name}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-info)' }} onClick={() => openKategoriModal(k)} title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteKategori(k)} title="Hapus">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Dosen-Kelas tab ── */}
            {!loading && !tabError && tab === 'dosen-kelas' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {dosenKelasList.length === 0 ? (
                            <div className="empty-state"><p>Belum ada penugasan dosen pengampu</p></div>
                        ) : (
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Dosen</th><th>Kelas</th><th>Program Studi</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {dosenKelasList.map((dk, i) => (
                                        <tr key={dk.id}>
                                            <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{dk.dosen?.name ?? '—'}</div>
                                                <div className="text-xs text-muted">{dk.dosen?.email}</div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{dk.kelas?.name ?? '—'}</td>
                                            <td className="text-sm text-muted">{dk.kelas?.prodi?.name ?? '—'}</td>
                                            <td>
                                                <button className="btn btn-ghost btn-icon-sm" style={{ color: 'var(--color-danger)' }} onClick={() => removeDosenKelas(dk)} title="Hapus">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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

            {/* ── Upload Settings tab ── */}
            {tab === 'upload' && (
                <div style={{ maxWidth: 560 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Konfigurasi Upload File</span></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div className="info-banner">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span>Pengaturan ini disimpan di browser dan berlaku untuk semua upload gambar (berita &amp; kuis). Backend harus mendukung parameter <code>folderId</code> pada endpoint <code>POST /upload</code>.</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label">ID Folder Tujuan Upload</label>
                                <input
                                    className="form-input"
                                    placeholder="contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                                    value={uploadSettings.folderId}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        setUploadSettings((s) => ({ ...s, folderId: e.target.value }));
                                        setUploadSaved(false);
                                    }}
                                />
                                <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                                    ID Folder Google Drive atau path direktori di server. Kosongkan untuk menggunakan folder default backend.
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ukuran File Maksimal (MB)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min={1} max={100}
                                    style={{ maxWidth: 160 }}
                                    value={uploadSettings.maxSizeMB}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        const v = Math.max(1, Math.min(100, Number(e.target.value) || 5));
                                        setUploadSettings((s) => ({ ...s, maxSizeMB: v }));
                                        setUploadSaved(false);
                                    }}
                                />
                                <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                                    File melebihi batas ini akan ditolak sebelum dikirim ke server.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        localStorage.setItem(UPLOAD_SETTINGS_KEY, JSON.stringify(uploadSettings));
                                        setUploadSaved(true);
                                    }}
                                >
                                    Simpan Pengaturan
                                </button>
                                {uploadSaved && (
                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        Tersimpan
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><span style={{ fontWeight: 700 }}>Penggunaan Saat Ini</span></div>
                        <div className="card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                                    <span className="text-sm" style={{ fontWeight: 600 }}>Folder ID</span>
                                    <span className="text-sm text-muted" style={{ fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>
                                        {uploadSettings.folderId || <em>default backend</em>}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                                    <span className="text-sm" style={{ fontWeight: 600 }}>Maks. ukuran file</span>
                                    <span className="text-sm text-muted">{uploadSettings.maxSizeMB} MB</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                                    <span className="text-sm" style={{ fontWeight: 600 }}>Berlaku di</span>
                                    <span className="text-sm text-muted">Form Berita, Gambar Soal Kuis, Gambar Opsi Kuis</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modals ── */}
            <Modal isOpen={jurusanModal} onClose={() => setJurusanModal(false)} title={editJurusan ? 'Edit Jurusan' : 'Tambah Jurusan'} size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setJurusanModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={saveJurusan} disabled={savingJurusan}>{savingJurusan ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div className="form-group">
                    <label className="form-label">Nama Jurusan *</label>
                    <input className="form-input" placeholder="cth: Ilmu Komputer" value={jurusanName} onChange={(e: ChangeEvent<HTMLInputElement>) => setJurusanName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveJurusan()} autoFocus />
                </div>
            </Modal>

            <Modal isOpen={prodiModal} onClose={() => setProdiModal(false)} title={editProdi ? 'Edit Prodi' : 'Tambah Prodi'} size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setProdiModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={saveProdi} disabled={savingProdi}>{savingProdi ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Jurusan *</label>
                        <select className="form-select" value={prodiForm.jurusanId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setProdiForm((f) => ({ ...f, jurusanId: e.target.value }))}>
                            <option value="">-- Pilih Jurusan --</option>
                            {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nama Program Studi *</label>
                        <input className="form-input" placeholder="cth: Teknik Informatika" value={prodiForm.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setProdiForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                </div>
            </Modal>

            <Modal isOpen={kelasModal} onClose={() => setKelasModal(false)} title={editKelas ? 'Edit Kelas' : 'Tambah Kelas'} size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setKelasModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={saveKelas} disabled={savingKelas}>{savingKelas ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Program Studi *</label>
                        <select className="form-select" value={kelasForm.prodiId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setKelasForm((f) => ({ ...f, prodiId: e.target.value }))}>
                            <option value="">-- Pilih Prodi --</option>
                            {prodiList.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.jurusan?.name})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nama Kelas *</label>
                        <input className="form-input" placeholder="cth: TI-A 2022" value={kelasForm.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setKelasForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                </div>
            </Modal>

            <Modal isOpen={kategoriModal} onClose={() => setKategoriModal(false)} title={editKategori ? 'Edit Kategori' : 'Tambah Kategori'} size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setKategoriModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={saveKategori} disabled={savingKategori}>{savingKategori ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div className="form-group">
                    <label className="form-label">Nama Kategori *</label>
                    <input className="form-input" placeholder="cth: Muallam 1" value={kategoriName} onChange={(e: ChangeEvent<HTMLInputElement>) => setKategoriName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKategori()} autoFocus />
                </div>
            </Modal>

            <Modal isOpen={dosenKelasModal} onClose={() => setDosenKelasModal(false)} title="Tambah Dosen Pengampu" size="sm"
                footer={<><button className="btn btn-outline btn-sm" onClick={() => setDosenKelasModal(false)}>Batal</button><button className="btn btn-primary btn-sm" onClick={saveDosenKelas} disabled={savingDosenKelas}>{savingDosenKelas ? <span className="spinner spinner-sm" /> : null}Simpan</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Dosen *</label>
                        <select className="form-select" value={dosenKelasForm.dosenId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setDosenKelasForm((f) => ({ ...f, dosenId: e.target.value }))}>
                            <option value="">-- Pilih Dosen --</option>
                            {dosenList.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Kelas yang Diampu *</label>
                        <select className="form-select" value={dosenKelasForm.kelasId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setDosenKelasForm((f) => ({ ...f, kelasId: e.target.value }))}>
                            <option value="">-- Pilih Kelas --</option>
                            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.prodi?.name})</option>)}
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
