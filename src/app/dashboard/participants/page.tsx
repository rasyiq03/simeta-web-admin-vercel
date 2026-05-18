'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { usersApi, enrollmentApi, exportToCSV } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useSemester } from '@/lib/semester-context';
import Modal from '@/components/Modal';
import type { User, UserRole, Enrollment, EnrollmentMahasiswaType } from '@/types';

const MAHASISWA_TYPES: EnrollmentMahasiswaType[] = ['REGULAR', 'MENTEE', 'MENTOR'];
const TYPE_LABEL: Record<EnrollmentMahasiswaType, string> = {
    REGULAR: 'Reguler', MENTEE: 'Mentee', MENTOR: 'Mentor',
};

// Backend kini memakai role MAHASISWA (mentor/mentee per-semester via Enrollment).
const PARTICIPANT_ROLES: UserRole[] = ['MAHASISWA', 'MENTEE', 'MENTOR', 'PESERTA'];

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
    MAHASISWA: { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED' },
    MENTOR:  { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
    MENTEE:  { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED' },
    PESERTA: { bg: 'rgba(14,165,233,0.1)',  color: '#0284C7' },
};

type ViewMode = 'table' | 'kelas';

export default function ParticipantsPage(): React.JSX.Element {
    const [participants, setParticipants]     = useState<User[]>([]);
    const [loading, setLoading]               = useState(true);
    const [viewMode, setViewMode]             = useState<ViewMode>('table');
    const [search, setSearch]                 = useState('');
    const [roleFilter, setRoleFilter]         = useState<UserRole | ''>('');
    const [kelasFilter, setKelasFilter]       = useState('');
    const [prodiFilter, setProdiFilter]       = useState('');
    const [jurusanFilter, setJurusanFilter]   = useState('');
    const [genderFilter, setGenderFilter]     = useState('');
    const [detailUser, setDetailUser]         = useState<User | null>(null);
    const [expandedKelas, setExpandedKelas]   = useState<Set<string>>(new Set());
    const [enrollByUser, setEnrollByUser] = useState<Record<string, Enrollment>>({});
    const [savingTypeId, setSavingTypeId] = useState<string | null>(null);
    const { showToast } = useToast();
    const { selectedSemesterId, selectedSemester } = useSemester();

    const fetchParticipants = useCallback(async () => {
        try {
            setLoading(true);
            const data = await usersApi.getParticipants(selectedSemesterId || undefined);
            setParticipants(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast, selectedSemesterId]);

    // FIX #3 — muat enrollment semester terpilih agar bisa menampilkan &
    // mengubah status mentor/mentee/reguler per mahasiswa.
    const fetchEnrollments = useCallback(async () => {
        if (!selectedSemesterId) { setEnrollByUser({}); return; }
        try {
            const list = await enrollmentApi.list(selectedSemesterId);
            const map: Record<string, Enrollment> = {};
            for (const e of list) map[e.userId] = e;
            setEnrollByUser(map);
        } catch {
            setEnrollByUser({}); // endpoint tak tersedia → kontrol disembunyikan
        }
    }, [selectedSemesterId]);

    useEffect(() => { fetchParticipants(); }, [fetchParticipants]);
    useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

    // FIX #3 — set/ubah tipe peserta untuk semester terpilih.
    const changeType = async (usr: User, type: EnrollmentMahasiswaType) => {
        if (!selectedSemesterId) {
            showToast('Pilih semester di header terlebih dahulu', 'error');
            return;
        }
        setSavingTypeId(usr.id);
        try {
            const existing = enrollByUser[usr.id];
            const saved = existing
                ? await enrollmentApi.update(existing.id, { mahasiswaType: type })
                : await enrollmentApi.create({
                    userId: usr.id, semesterId: selectedSemesterId, mahasiswaType: type,
                });
            setEnrollByUser((m) => ({ ...m, [usr.id]: saved }));
            showToast(`${usr.name}: ${TYPE_LABEL[type]} di ${selectedSemester?.code ?? 'semester ini'}`, 'success');
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setSavingTypeId(null);
        }
    };

    /* ── Filter options derived from data ── */
    const kelasList   = [...new Set(participants.map((u) => u.kelas?.name).filter(Boolean))] as string[];
    const prodiList   = [...new Set(participants.map((u) => u.prodi?.name).filter(Boolean))] as string[];
    const jurusanList = [...new Set(participants.map((u) => u.jurusan?.name).filter(Boolean))] as string[];

    const filtered = participants.filter((u) => {
        const matchSearch  = !search  || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || (u.nim ?? '').includes(search);
        const matchRole    = !roleFilter    || u.role    === roleFilter;
        const matchKelas   = !kelasFilter   || u.kelas?.name   === kelasFilter;
        const matchProdi   = !prodiFilter   || u.prodi?.name   === prodiFilter;
        const matchJurusan = !jurusanFilter || u.jurusan?.name === jurusanFilter;
        const matchGender  = !genderFilter  || u.gender  === genderFilter;
        return matchSearch && matchRole && matchKelas && matchProdi && matchJurusan && matchGender;
    });

    /* ── Per-kelas grouping ── */
    const kelasBuckets = (() => {
        const map = new Map<string, { label: string; prodi: string; users: User[] }>();
        for (const u of filtered) {
            const key   = u.kelas?.id ?? '__none__';
            const label = u.kelas?.name ?? 'Tanpa Kelas';
            const prodi = u.prodi?.name ?? '';
            if (!map.has(key)) map.set(key, { label, prodi, users: [] });
            map.get(key)!.users.push(u);
        }
        return [...map.entries()].sort((a, b) => {
            if (a[0] === '__none__') return 1;
            if (b[0] === '__none__') return -1;
            return a[1].label.localeCompare(b[1].label);
        });
    })();

    const toggleKelas = (key: string) => {
        setExpandedKelas((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleExport = () => {
        exportToCSV(
            `peserta_${new Date().toISOString().slice(0, 10)}.csv`,
            ['Nama', 'Email', 'Role', 'NIM', 'Kelas', 'Prodi', 'Jurusan', 'Gender'],
            filtered.map((u) => [u.name, u.email, u.role, u.nim ?? '', u.kelas?.name ?? '', u.prodi?.name ?? '', u.jurusan?.name ?? '', u.gender ?? '']),
        );
        showToast('Data peserta berhasil diekspor', 'success');
    };

    const menteeCount  = participants.filter((u) => u.role === 'MENTEE').length;
    const mentorCount  = participants.filter((u) => u.role === 'MENTOR').length;
    const pesertaCount = participants.filter((u) => u.role === 'PESERTA').length;

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Data Peserta</h2>
                    <p className="page-subtitle">
                        {participants.length} peserta &mdash; {menteeCount} mentee &middot; {mentorCount} mentor &middot; {pesertaCount} peserta umum
                    </p>
                </div>
                <div className="page-actions">
                    {/* View toggle */}
                    <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <button
                            className="btn btn-sm"
                            style={{
                                borderRadius: 0, border: 'none',
                                background: viewMode === 'table' ? 'var(--color-navy)' : 'transparent',
                                color: viewMode === 'table' ? '#fff' : 'var(--color-text-muted)',
                                padding: '5px 14px',
                            }}
                            onClick={() => setViewMode('table')}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                                <path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M9 3h6"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M3 9v6"/><path d="M21 9v6"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M9 21h6"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/>
                            </svg>
                            Tabel
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{
                                borderRadius: 0, border: 'none',
                                borderLeft: '1px solid var(--color-border)',
                                background: viewMode === 'kelas' ? 'var(--color-navy)' : 'transparent',
                                color: viewMode === 'kelas' ? '#fff' : 'var(--color-text-muted)',
                                padding: '5px 14px',
                            }}
                            onClick={() => setViewMode('kelas')}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                            </svg>
                            Per Kelas
                        </button>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={filtered.length === 0}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Summary Stat Cards ── */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                {[
                    { label: 'Total Peserta', value: participants.length, color: 'navy' },
                    { label: 'Mentee',        value: menteeCount,         color: 'purple' },
                    { label: 'Mentor',        value: mentorCount,         color: 'success' },
                    { label: 'Peserta Umum',  value: pesertaCount,        color: 'info' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="stat-card">
                        <div className={`stat-icon ${color}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div className="stat-info">
                            <div className="stat-label">{label}</div>
                            <div className="stat-value">{loading ? '—' : value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filter Bar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                        </svg>
                        <input type="text" placeholder="Cari nama, email, atau NIM..."
                            value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
                    </div>
                    {[
                        { label: 'Kelas', value: kelasFilter, options: kelasList, onChange: setKelasFilter },
                        { label: 'Prodi', value: prodiFilter, options: prodiList, onChange: setProdiFilter },
                        { label: 'Jurusan', value: jurusanFilter, options: jurusanList, onChange: setJurusanFilter },
                    ].map(({ label, value, options, onChange }) => (
                        <select key={label} className="form-select" style={{ width: 'auto', minWidth: 130 }}
                            value={value} onChange={(e) => onChange(e.target.value)}>
                            <option value="">Semua {label}</option>
                            {options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ))}
                    <select className="form-select" style={{ width: 'auto', minWidth: 130 }}
                        value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                        <option value="">Semua Gender</option>
                        <option value="LAKI_LAKI">Laki-laki</option>
                        <option value="PEREMPUAN">Perempuan</option>
                    </select>
                </div>
                <div className="chip-row">
                    {(['', ...PARTICIPANT_ROLES] as Array<UserRole | ''>).map((r) => (
                        <button key={r} className={`chip ${roleFilter === r ? 'active' : ''}`}
                            onClick={() => setRoleFilter(r)}>
                            {r || 'Semua Peran'}
                        </button>
                    ))}
                    {(search || roleFilter || kelasFilter || prodiFilter || jurusanFilter || genderFilter) && (
                        <button className="chip" style={{ color: 'var(--color-danger)' }}
                            onClick={() => { setSearch(''); setRoleFilter(''); setKelasFilter(''); setProdiFilter(''); setJurusanFilter(''); setGenderFilter(''); }}>
                            ✕ Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* ── TABLE VIEW ── */}
            {viewMode === 'table' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="empty-state"><div className="spinner spinner-lg" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                <p>Tidak ada peserta ditemukan</p>
                                <small>Coba ubah filter pencarian</small>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Nama</th><th>NIM</th>
                                            <th>Peran</th><th>Kelas</th><th>Prodi / Jurusan</th>
                                            <th>Gender</th>
                                            <th>Tipe {selectedSemester ? `(${selectedSemester.code})` : '(Semester)'}</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((usr, i) => {
                                            const rs = ROLE_BADGE[usr.role] ?? { bg: '#eee', color: '#666' };
                                            return (
                                                <tr key={usr.id}>
                                                    <td className="text-xs text-muted" style={{ width: 40 }}>{i + 1}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 32, height: 32, borderRadius: '50%',
                                                                background: `linear-gradient(135deg, ${rs.bg.replace('0.1', '0.3')}, ${rs.bg})`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.8125rem', fontWeight: 700, color: rs.color, flexShrink: 0,
                                                            }}>
                                                                {usr.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{usr.name}</div>
                                                                <div className="text-xs text-muted">{usr.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.875rem' }}>{usr.nim || <span className="text-muted text-xs">—</span>}</td>
                                                    <td>
                                                        <span className="badge" style={{ background: rs.bg, color: rs.color }}>{usr.role}</span>
                                                    </td>
                                                    <td className="text-sm">{usr.kelas?.name || <span className="text-muted text-xs">—</span>}</td>
                                                    <td>
                                                        {usr.prodi ? (
                                                            <div>
                                                                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{usr.prodi.name}</div>
                                                                {usr.jurusan && <div className="text-xs text-muted">{usr.jurusan.name}</div>}
                                                            </div>
                                                        ) : <span className="text-muted text-xs">—</span>}
                                                    </td>
                                                    <td>
                                                        {usr.gender ? (
                                                            <span style={{
                                                                fontSize: '0.8125rem', fontWeight: 500,
                                                                color: usr.gender === 'LAKI_LAKI' ? 'var(--color-info)' : 'var(--color-purple)',
                                                            }}>
                                                                {usr.gender === 'LAKI_LAKI' ? '♂ L' : '♀ P'}
                                                            </span>
                                                        ) : <span className="text-muted text-xs">—</span>}
                                                    </td>
                                                    <td>
                                                        {selectedSemesterId ? (
                                                            <select
                                                                className="form-select"
                                                                style={{ minWidth: 104, padding: '4px 8px', fontSize: '0.8rem' }}
                                                                value={enrollByUser[usr.id]?.mahasiswaType ?? ''}
                                                                disabled={savingTypeId === usr.id}
                                                                onChange={(e: ChangeEvent<HTMLSelectElement>) => changeType(usr, e.target.value as EnrollmentMahasiswaType)}
                                                                title="Atur status mentor/mentee untuk semester terpilih"
                                                            >
                                                                {!enrollByUser[usr.id] && <option value="">— belum —</option>}
                                                                {MAHASISWA_TYPES.map((t) => (
                                                                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="text-muted text-xs">pilih semester</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-icon-sm" title="Detail"
                                                            style={{ color: 'var(--color-info)' }}
                                                            onClick={() => setDetailUser(usr)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10"/>
                                                                <line x1="12" y1="8" x2="12" y2="12"/>
                                                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                                                            </svg>
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
            )}

            {/* ── PER KELAS VIEW ── */}
            {viewMode === 'kelas' && (
                <div>
                    {loading ? (
                        <div className="empty-state" style={{ minHeight: 200 }}><div className="spinner spinner-lg" /></div>
                    ) : kelasBuckets.length === 0 ? (
                        <div className="empty-state">
                            <p>Tidak ada peserta ditemukan</p>
                            <small>Coba ubah filter pencarian</small>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {kelasBuckets.map(([key, bucket]) => {
                                const isOpen      = expandedKelas.has(key);
                                const menteeCount = bucket.users.filter((u) => u.role === 'MENTEE').length;
                                const mentorCount = bucket.users.filter((u) => u.role === 'MENTOR').length;
                                const pesertaCount = bucket.users.filter((u) => u.role === 'PESERTA').length;
                                return (
                                    <div key={key} className="card">
                                        {/* Kelas header — clickable to expand */}
                                        <button
                                            style={{
                                                width: '100%', textAlign: 'left', background: 'none',
                                                border: 'none', cursor: 'pointer', padding: '14px 20px',
                                                display: 'flex', alignItems: 'center', gap: 14,
                                            }}
                                            onClick={() => toggleKelas(key)}
                                        >
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
                                                background: key === '__none__' ? 'rgba(100,100,100,0.08)' : 'rgba(18,29,89,0.08)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: key === '__none__' ? '#888' : 'var(--color-navy)',
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                                </svg>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: key === '__none__' ? '#888' : 'var(--color-navy)' }}>
                                                    {bucket.label}
                                                </div>
                                                {bucket.prodi && (
                                                    <div className="text-xs text-muted">{bucket.prodi}</div>
                                                )}
                                            </div>
                                            {/* Role counts */}
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                {menteeCount > 0 && (
                                                    <span className="badge" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>{menteeCount} Mentee</span>
                                                )}
                                                {mentorCount > 0 && (
                                                    <span className="badge" style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>{mentorCount} Mentor</span>
                                                )}
                                                {pesertaCount > 0 && (
                                                    <span className="badge" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7' }}>{pesertaCount} Peserta</span>
                                                )}
                                                <span className="badge">{bucket.users.length} total</span>
                                            </div>
                                            <svg
                                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round" style={{
                                                    flexShrink: 0, transition: 'transform 200ms',
                                                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                <polyline points="6 9 12 15 18 9"/>
                                            </svg>
                                        </button>

                                        {/* Expanded member list */}
                                        {isOpen && (
                                            <div style={{ borderTop: '1px solid var(--color-border-light)', padding: '0 0 8px' }}>
                                                <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ paddingLeft: 20 }}>#</th>
                                                            <th>Nama</th>
                                                            <th>NIM</th>
                                                            <th>Peran</th>
                                                            <th>Gender</th>
                                                            <th>Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {bucket.users.map((usr, i) => {
                                                            const rs = ROLE_BADGE[usr.role] ?? { bg: '#eee', color: '#666' };
                                                            return (
                                                                <tr key={usr.id}>
                                                                    <td className="text-xs text-muted" style={{ paddingLeft: 20, width: 40 }}>{i + 1}</td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <div style={{
                                                                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                                                background: rs.bg, display: 'flex', alignItems: 'center',
                                                                                justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: rs.color,
                                                                            }}>
                                                                                {usr.name.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{usr.name}</div>
                                                                                <div className="text-xs text-muted">{usr.email}</div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ fontSize: '0.875rem' }}>{usr.nim || <span className="text-muted text-xs">—</span>}</td>
                                                                    <td>
                                                                        <span className="badge" style={{ background: rs.bg, color: rs.color }}>{usr.role}</span>
                                                                    </td>
                                                                    <td>
                                                                        {usr.gender ? (
                                                                            <span style={{
                                                                                fontSize: '0.8125rem', fontWeight: 500,
                                                                                color: usr.gender === 'LAKI_LAKI' ? 'var(--color-info)' : 'var(--color-purple)',
                                                                            }}>
                                                                                {usr.gender === 'LAKI_LAKI' ? '♂ L' : '♀ P'}
                                                                            </span>
                                                                        ) : <span className="text-muted text-xs">—</span>}
                                                                    </td>
                                                                    <td>
                                                                        <button className="btn btn-ghost btn-icon-sm" title="Detail"
                                                                            style={{ color: 'var(--color-info)' }}
                                                                            onClick={() => setDetailUser(usr)}>
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <circle cx="12" cy="12" r="10"/>
                                                                                <line x1="12" y1="8" x2="12" y2="12"/>
                                                                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                                                                            </svg>
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
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal: Detail Peserta ── */}
            <Modal isOpen={!!detailUser} onClose={() => setDetailUser(null)}
                title="Detail Peserta" size="sm">
                {detailUser && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                            background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: 'var(--color-amber-gradient)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.375rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                            }}>
                                {detailUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{detailUser.name}</div>
                                <div className="text-sm text-muted">{detailUser.email}</div>
                                <span className="badge" style={{
                                    marginTop: 4,
                                    background: ROLE_BADGE[detailUser.role]?.bg ?? '#eee',
                                    color: ROLE_BADGE[detailUser.role]?.color ?? '#666',
                                }}>
                                    {detailUser.role}
                                </span>
                            </div>
                        </div>

                        {[
                            { label: 'NIM',           value: detailUser.nim },
                            { label: 'Kelas',         value: detailUser.kelas?.name },
                            { label: 'Program Studi', value: detailUser.prodi?.name },
                            { label: 'Jurusan',       value: detailUser.jurusan?.name },
                            { label: 'Gender',        value: detailUser.gender === 'LAKI_LAKI' ? 'Laki-laki' : detailUser.gender === 'PEREMPUAN' ? 'Perempuan' : undefined },
                            { label: 'Kategori',      value: detailUser.kategori?.name },
                            { label: 'Terdaftar',     value: new Date(detailUser.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' }) },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>
                                    {value || <span className="text-muted" style={{ fontWeight: 400 }}>—</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}
