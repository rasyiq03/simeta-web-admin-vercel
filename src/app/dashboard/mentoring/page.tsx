'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { mentoringApi, usersApi, referenceApi, exportToCSV } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useSemester } from '@/lib/semester-context';
import Modal from '@/components/Modal';
import type {
    MentoringGroup,
    MemorizationRecord,
    User,
    Kategori,
    CreateMentoringGroupRequest,
    AutoGenerateGroupRequest,
} from '@/types';

/**
 * FIX #5 — Kategori kelompok mentoring TIDAK lagi hardcoded MUALLAM_1/2/3.
 * Sekarang bersumber tunggal dari "Data Referensi → Kategori", sehingga apa
 * yang admin definisikan di sana = pilihan yang muncul di sini (heuristic:
 * consistency & match between system and real world). `category` enum lama
 * tetap dibaca untuk menampilkan data kelompok yang sudah terlanjur ada.
 */
function groupKategoriLabel(g: MentoringGroup, list: Kategori[]): string {
    if (g.kategori?.name) return g.kategori.name;
    if (g.kategoriId) {
        const k = list.find((x) => x.id === g.kategoriId);
        if (k) return k.name;
    }
    if (g.category) return String(g.category).replace(/_/g, ' ');
    return 'Tanpa kategori';
}

interface GroupForm {
    name: string;
    mentorId: string;
    kategoriId: string;
}

interface AutoGenForm {
    kategoriId: string;
    groupSize: number;
    namePrefix: string;
}

interface ReportForm {
    groupId: string;
    date: string;
    notes: string;
    memorizationRecords: MemorizationRecord[];
}

const DEFAULT_GROUP_FORM: GroupForm = { name: '', mentorId: '', kategoriId: '' };
const DEFAULT_AUTOGEN_FORM: AutoGenForm = { kategoriId: '', groupSize: 5, namePrefix: '' };

export default function MentoringPage(): React.JSX.Element {
    const { hasRole } = useAuth();
    const { showToast } = useToast();
    const { selectedSemesterId } = useSemester();

    const isManager = hasRole('ADMIN', 'PANITIA', 'DOSEN');
    const isMentor  = hasRole('MENTOR');

    const [groups, setGroups]             = useState<MentoringGroup[]>([]);
    const [loading, setLoading]           = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<string>(''); // kategoriId
    const [kategoriList, setKategoriList] = useState<Kategori[]>([]);

    const [mentors, setMentors]   = useState<User[]>([]);
    const [mentees, setMentees]   = useState<User[]>([]);

    // ── Modals ──
    const [createModal, setCreateModal]   = useState(false);
    const [editModal, setEditModal]       = useState<{ open: boolean; group: MentoringGroup | null }>({ open: false, group: null });
    const [deleteTarget, setDeleteTarget] = useState<MentoringGroup | null>(null);
    const [addMemberModal, setAddMemberModal] = useState<{ open: boolean; groupId: string; groupName: string }>({ open: false, groupId: '', groupName: '' });
    const [autoGenModal, setAutoGenModal] = useState(false);
    const [reportModal, setReportModal]   = useState(false);

    // ── Forms ──
    const [groupForm, setGroupForm]       = useState<GroupForm>(DEFAULT_GROUP_FORM);
    const [autoGenForm, setAutoGenForm]   = useState<AutoGenForm>(DEFAULT_AUTOGEN_FORM);
    const [selectedMenteeId, setSelectedMenteeId] = useState('');
    const [reportForm, setReportForm]     = useState<ReportForm>({ groupId: '', date: '', notes: '', memorizationRecords: [] });

    const fetchGroups = useCallback(async () => {
        try {
            setLoading(true);
            const data = isManager
                ? await mentoringApi.getGroups({
                    kategoriId: categoryFilter || undefined,
                    semesterId: selectedSemesterId || undefined,
                })
                : await mentoringApi.getMyMentees();
            setGroups(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [isManager, categoryFilter, selectedSemesterId, showToast]);

    const fetchUsers = useCallback(async () => {
        if (!isManager) return;
        try {
            const all = await usersApi.getAll();
            setMentors(all.filter((u) => u.role === 'MENTOR'));
            setMentees(all.filter((u) => u.role === 'MENTEE'));
        } catch {
            // non-critical
        }
    }, [isManager]);

    // FIX #5 — sumber tunggal kategori dari Data Referensi.
    const fetchKategori = useCallback(async () => {
        try {
            setKategoriList(await referenceApi.getKategori());
        } catch {
            // Kategori belum tersedia → dropdown kosong, UI tetap jalan.
        }
    }, []);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchKategori(); }, [fetchKategori]);

    // ── Create Group ──
    const handleCreateGroup = async () => {
        if (!groupForm.name || !groupForm.mentorId) {
            showToast('Nama kelompok dan mentor wajib diisi', 'error');
            return;
        }
        if (kategoriList.length > 0 && !groupForm.kategoriId) {
            showToast('Kategori wajib dipilih', 'error');
            return;
        }
        try {
            await mentoringApi.createGroup(groupForm as CreateMentoringGroupRequest);
            showToast('Kelompok berhasil dibuat', 'success');
            setCreateModal(false);
            setGroupForm(DEFAULT_GROUP_FORM);
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Edit Group ──
    const openEditModal = (group: MentoringGroup) => {
        setGroupForm({
            name: group.name,
            mentorId: group.mentorId,
            kategoriId: group.kategoriId ?? '',
        });
        setEditModal({ open: true, group });
    };

    const handleEditGroup = async () => {
        if (!editModal.group) return;
        try {
            await mentoringApi.updateGroup(editModal.group.id, groupForm);
            showToast('Kelompok berhasil diperbarui', 'success');
            setEditModal({ open: false, group: null });
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Delete Group ──
    const handleDeleteGroup = async () => {
        if (!deleteTarget) return;
        try {
            await mentoringApi.deleteGroup(deleteTarget.id);
            showToast(`Kelompok "${deleteTarget.name}" berhasil dihapus`, 'success');
            setDeleteTarget(null);
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Add Member ──
    const handleAddMember = async () => {
        if (!selectedMenteeId) { showToast('Pilih mentee terlebih dahulu', 'error'); return; }
        try {
            await mentoringApi.addMember(addMemberModal.groupId, selectedMenteeId);
            showToast('Mentee berhasil ditambahkan', 'success');
            setAddMemberModal({ open: false, groupId: '', groupName: '' });
            setSelectedMenteeId('');
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Remove Member ──
    const handleRemoveMember = async (groupId: string, memberId: string, menteeName: string) => {
        if (!confirm(`Keluarkan ${menteeName} dari kelompok?`)) return;
        try {
            await mentoringApi.removeMember(groupId, memberId);
            showToast(`${menteeName} berhasil dikeluarkan`, 'success');
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Auto Generate ──
    const handleAutoGenerate = async () => {
        if (!autoGenForm.groupSize || autoGenForm.groupSize < 1) {
            showToast('Ukuran kelompok tidak valid', 'error');
            return;
        }
        if (kategoriList.length > 0 && !autoGenForm.kategoriId) {
            showToast('Pilih kategori terlebih dahulu', 'error');
            return;
        }
        try {
            const body: AutoGenerateGroupRequest = {
                kategoriId: autoGenForm.kategoriId || undefined,
                groupSize: autoGenForm.groupSize,
                namePrefix: autoGenForm.namePrefix || undefined,
            };
            const result = await mentoringApi.autoGenerate(body);
            showToast(`${result.groupsCreated} kelompok dibuat, ${result.menteesDistributed} mentee didistribusikan`, 'success');
            setAutoGenModal(false);
            setAutoGenForm(DEFAULT_AUTOGEN_FORM);
            fetchGroups();
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    // ── Report ──
    const openReportModal = (group: MentoringGroup) => {
        const records: MemorizationRecord[] = group.members.map((m) => ({
            studentId: m.menteeId, surahName: '', ayatStart: 1, ayatEnd: 1, fluency: 70,
        }));
        setReportForm({ groupId: group.id, date: '', notes: '', memorizationRecords: records });
        setReportModal(true);
    };

    const updateRecord = (idx: number, field: keyof MemorizationRecord, value: string | number) => {
        setReportForm((prev) => {
            const records = [...prev.memorizationRecords];
            records[idx] = { ...records[idx], [field]: value };
            return { ...prev, memorizationRecords: records };
        });
    };

    const handleSubmitReport = async () => {
        if (!reportForm.date) { showToast('Tanggal wajib diisi', 'error'); return; }
        try {
            await mentoringApi.createReport(reportForm);
            showToast('Laporan berhasil disimpan', 'success');
            setReportModal(false);
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    const handleExportGroups = () => {
        const headers = ['Nama Kelompok', 'Kategori', 'Mentor', 'Email Mentor', 'Jumlah Anggota'];
        const rows = groups.map((g) => [
            g.name,
            groupKategoriLabel(g, kategoriList),
            g.mentor?.name || '-',
            g.mentor?.email || '-',
            g.members.length,
        ]);
        exportToCSV('daftar-kelompok-mentoring.csv', headers, rows);
    };

    // ── Mentees available to add (not yet in any group shown) ──
    const assignedMenteeIds = new Set(groups.flatMap((g) => g.members.map((m) => m.menteeId)));
    const availableMentees = mentees.filter((u) => !assignedMenteeIds.has(u.id));

    return (
        <div>
            {/* ── Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Mentoring & Hafalan</h2>
                    <p className="page-subtitle">
                        {isManager ? 'Kelola kelompok mentoring, anggota, dan laporan hafalan' : 'Kelompok mentoring dan setoran hafalan'}
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-outline btn-sm" onClick={handleExportGroups} disabled={groups.length === 0}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                    {isManager && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setAutoGenModal(true)}>
                                ⚡ Auto-Generate
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setGroupForm(DEFAULT_GROUP_FORM); setCreateModal(true); }}>
                                + Buat Kelompok
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Category Filter (manager only) — sumber: Data Referensi ── */}
            {isManager && kategoriList.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button
                        className={`btn btn-sm ${categoryFilter === '' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setCategoryFilter('')}
                    >Semua</button>
                    {kategoriList.map((kat) => (
                        <button
                            key={kat.id}
                            className={`btn btn-sm ${categoryFilter === kat.id ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setCategoryFilter(kat.id)}
                        >{kat.name}</button>
                    ))}
                </div>
            )}
            {isManager && kategoriList.length === 0 && (
                <div className="info-banner" style={{ marginBottom: 20 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Belum ada kategori. Tambahkan di menu <strong>Data Referensi → Kategori</strong> agar bisa mengelompokkan kelompok mentoring.</span>
                </div>
            )}

            {/* ── Groups Grid ── */}
            {loading ? (
                <div className="empty-state"><div className="spinner spinner-lg" /></div>
            ) : groups.length === 0 ? (
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <p>Belum ada kelompok mentoring</p>
                            {isManager && (
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}
                                    onClick={() => { setGroupForm(DEFAULT_GROUP_FORM); setCreateModal(true); }}>
                                    + Buat Kelompok Pertama
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                    {groups.map((group) => (
                        <div key={group.id} className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="heading-3">{group.name}</h3>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                        <span className="badge badge-info">{groupKategoriLabel(group, kategoriList)}</span>
                                        {group.mentor && (
                                            <span className="text-xs text-muted">Mentor: {group.mentor.name}</span>
                                        )}
                                        {group._count && (
                                            <span className="text-xs text-muted">{group._count.reports} laporan</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button className="btn btn-success btn-sm" onClick={() => openReportModal(group)}>
                                        Laporan
                                    </button>
                                    {isManager && (
                                        <>
                                            <button className="btn btn-outline btn-sm" onClick={() => openEditModal(group)}>Edit</button>
                                            {hasRole('ADMIN', 'PANITIA') && (
                                                <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(group)}>Hapus</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span className="text-sm text-muted">{group.members.length} mentee</span>
                                    {isManager && (
                                        <button className="btn btn-outline btn-sm"
                                            onClick={() => { setAddMemberModal({ open: true, groupId: group.id, groupName: group.name }); setSelectedMenteeId(''); }}>
                                            + Tambah Mentee
                                        </button>
                                    )}
                                </div>
                                {group.members.length === 0 ? (
                                    <p className="text-sm text-muted">Belum ada anggota</p>
                                ) : (
                                    group.members.map((m) => (
                                        <div key={m.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
                                            padding: '8px 0', borderBottom: '1px solid var(--color-border-light)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 'var(--radius-full)',
                                                    background: 'var(--color-amber-100)', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600,
                                                    color: 'var(--color-amber-dark)', flexShrink: 0,
                                                }}>
                                                    {m.mentee.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.mentee.name}</div>
                                                    <div className="text-xs text-muted">{m.mentee.email}</div>
                                                </div>
                                            </div>
                                            {isManager && (
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                                    onClick={() => handleRemoveMember(group.id, m.id, m.mentee.name)}
                                                >
                                                    Keluarkan
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ══ Modal: Buat Kelompok ══ */}
            <Modal
                isOpen={createModal}
                onClose={() => setCreateModal(false)}
                title="Buat Kelompok Mentoring"
                disableBackdropClose
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setCreateModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleCreateGroup}>Buat</button>
                    </>
                }
            >
                <GroupFormFields form={groupForm} onChange={setGroupForm} mentors={mentors} kategoriList={kategoriList} />
            </Modal>

            {/* ══ Modal: Edit Kelompok ══ */}
            <Modal
                isOpen={editModal.open}
                onClose={() => setEditModal({ open: false, group: null })}
                title={`Edit: ${editModal.group?.name ?? ''}`}
                disableBackdropClose
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditModal({ open: false, group: null })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleEditGroup}>Simpan</button>
                    </>
                }
            >
                <GroupFormFields form={groupForm} onChange={setGroupForm} mentors={mentors} kategoriList={kategoriList} />
            </Modal>

            {/* ══ Modal: Hapus Kelompok ══ */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Hapus Kelompok"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setDeleteTarget(null)}>Batal</button>
                        <button className="btn btn-danger btn-sm" onClick={handleDeleteGroup}>Hapus</button>
                    </>
                }
            >
                <p>Hapus kelompok <strong>{deleteTarget?.name}</strong>? Semua anggota dan laporan akan ikut terhapus.</p>
            </Modal>

            {/* ══ Modal: Tambah Mentee ══ */}
            <Modal
                isOpen={addMemberModal.open}
                onClose={() => setAddMemberModal({ open: false, groupId: '', groupName: '' })}
                title={`Tambah Mentee ke "${addMemberModal.groupName}"`}
                disableBackdropClose
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setAddMemberModal({ open: false, groupId: '', groupName: '' })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddMember}>Tambahkan</button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Pilih Mentee</label>
                    <select className="form-input" value={selectedMenteeId} onChange={(e) => setSelectedMenteeId(e.target.value)}>
                        <option value="">-- Pilih mentee --</option>
                        {availableMentees.map((u) => (
                            <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                        ))}
                    </select>
                    {availableMentees.length === 0 && (
                        <p className="text-xs text-muted" style={{ marginTop: 6 }}>
                            Semua mentee sudah masuk kelompok, atau belum ada user dengan role MENTEE.
                        </p>
                    )}
                </div>
            </Modal>

            {/* ══ Modal: Auto-Generate ══ */}
            <Modal
                isOpen={autoGenModal}
                onClose={() => setAutoGenModal(false)}
                title="Auto-Generate Kelompok"
                disableBackdropClose
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setAutoGenModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAutoGenerate}>Generate</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                        <label className="form-label">Kategori <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <select className="form-input" value={autoGenForm.kategoriId}
                            onChange={(e) => setAutoGenForm({ ...autoGenForm, kategoriId: e.target.value })}>
                            <option value="">-- Pilih kategori --</option>
                            {kategoriList.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                        {kategoriList.length === 0 && (
                            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                                Belum ada kategori. Tambahkan di Data Referensi → Kategori.
                            </p>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ukuran Kelompok</label>
                        <input className="form-input" type="number" min={1} value={autoGenForm.groupSize}
                            onChange={(e) => setAutoGenForm({ ...autoGenForm, groupSize: Number(e.target.value) })} />
                        <p className="text-xs text-muted" style={{ marginTop: 4 }}>Jumlah mentee per kelompok</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prefix Nama <span className="text-muted">(opsional)</span></label>
                        <input className="form-input" placeholder={`Contoh: ${kategoriList.find((k) => k.id === autoGenForm.kategoriId)?.name ?? 'Kelompok'}`}
                            value={autoGenForm.namePrefix}
                            onChange={(e) => setAutoGenForm({ ...autoGenForm, namePrefix: e.target.value })} />
                        <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                            Nama kelompok akan jadi: &quot;{autoGenForm.namePrefix || kategoriList.find((k) => k.id === autoGenForm.kategoriId)?.name || 'Kelompok'} - Kelompok 1&quot;, dst.
                        </p>
                    </div>
                    <div className="form-group">
                        <p className="text-sm text-muted">
                            Sistem akan otomatis mengambil semua MENTOR dan MENTEE yang belum punya kelompok di kategori ini.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* ══ Modal: Buat Laporan ══ */}
            <Modal
                isOpen={reportModal}
                onClose={() => setReportModal(false)}
                title="Buat Laporan Mentoring"
                disableBackdropClose
                size="lg"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setReportModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSubmitReport}>Simpan Laporan</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Tanggal <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input className="form-input" type="date" value={reportForm.date}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setReportForm({ ...reportForm, date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Catatan (Opsional)</label>
                        <textarea className="form-input" rows={2} placeholder="Catatan sesi mentoring..."
                            value={reportForm.notes}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReportForm({ ...reportForm, notes: e.target.value })} />
                    </div>
                    <h4 className="heading-3">Setoran Hafalan</h4>
                    {reportForm.memorizationRecords.map((rec, idx) => {
                        const group = groups.find((g) => g.id === reportForm.groupId);
                        const member = group?.members.find((m) => m.menteeId === rec.studentId);
                        return (
                            <div key={rec.studentId} style={{
                                padding: 16, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                            }}>
                                <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 12 }}>
                                    {member?.mentee.name || `Mentee ${idx + 1}`}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                                    <div className="form-group">
                                        <label className="form-label">Surah</label>
                                        <input className="form-input" placeholder="Al-Baqarah" value={rec.surahName}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateRecord(idx, 'surahName', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ayat Mulai</label>
                                        <input className="form-input" type="number" min={1} value={rec.ayatStart}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateRecord(idx, 'ayatStart', Number(e.target.value))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ayat Akhir</label>
                                        <input className="form-input" type="number" min={1} value={rec.ayatEnd}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateRecord(idx, 'ayatEnd', Number(e.target.value))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kelancaran (%)</label>
                                        <input className="form-input" type="number" min={0} max={100} value={rec.fluency}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateRecord(idx, 'fluency', Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
}

// ── Shared form fields untuk Create & Edit ──
function GroupFormFields({
    form,
    onChange,
    mentors,
    kategoriList,
}: {
    form: GroupForm;
    onChange: (f: GroupForm) => void;
    mentors: User[];
    kategoriList: Kategori[];
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
                <label className="form-label">Nama Kelompok <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input className="form-input" placeholder="cth: Kelompok A"
                    value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
                <label className="form-label">Kategori <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <select className="form-input" value={form.kategoriId}
                    onChange={(e) => onChange({ ...form, kategoriId: e.target.value })}>
                    <option value="">-- Pilih kategori --</option>
                    {kategoriList.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                </select>
                {kategoriList.length === 0 && (
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                        Belum ada kategori. Tambahkan di menu Data Referensi → Kategori.
                    </p>
                )}
            </div>
            <div className="form-group">
                <label className="form-label">Mentor <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <select className="form-input" value={form.mentorId}
                    onChange={(e) => onChange({ ...form, mentorId: e.target.value })}>
                    <option value="">-- Pilih mentor --</option>
                    {mentors.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.email}</option>
                    ))}
                </select>
                {mentors.length === 0 && (
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                        Belum ada user dengan role MENTOR. Daftarkan mentor terlebih dahulu.
                    </p>
                )}
            </div>
        </div>
    );
}
