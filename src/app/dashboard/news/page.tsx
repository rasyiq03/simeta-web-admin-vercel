/**
 * =============================================================
 * SIMETA CMS — News Management Page (TypeScript)
 * CRUD berita: buat, edit, hapus, dan lihat daftar berita.
 * Diakses oleh ADMIN dan DOSEN.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { newsApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import ImageUpload from '@/components/ImageUpload';
import type { News, CreateNewsRequest } from '@/types';

/** State modal form berita */
interface FormModalState {
    open: boolean;
    editing: News | null;
}

export default function NewsPage(): React.JSX.Element {
    const [news, setNews] = useState<News[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { showToast } = useToast();

    const [formModal, setFormModal] = useState<FormModalState>({ open: false, editing: null });
    const [form, setForm] = useState<CreateNewsRequest>({ title: '', content: '', imageUrl: '' });

    /** Fetch semua berita */
    const fetchNews = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const data = await newsApi.getAll();
            setNews(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchNews(); }, [fetchNews]);

    /** Buka modal untuk buat/edit berita */
    const openForm = (item: News | null = null): void => {
        if (item) {
            setForm({ title: item.title || '', content: item.content || '', imageUrl: item.imageUrl || '' });
            setFormModal({ open: true, editing: item });
        } else {
            setForm({ title: '', content: '', imageUrl: '' });
            setFormModal({ open: true, editing: null });
        }
    };

    /** Submit form (buat baru atau update) */
    const handleSubmit = async (): Promise<void> => {
        if (!form.title || !form.content) {
            showToast('Judul dan konten wajib diisi', 'error');
            return;
        }
        try {
            if (formModal.editing) {
                await newsApi.update(formModal.editing.id, form);
                showToast('Berita berhasil diperbarui', 'success');
            } else {
                await newsApi.create(form);
                showToast('Berita berhasil dipublikasikan', 'success');
            }
            setFormModal({ open: false, editing: null });
            fetchNews();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Hapus berita */
    const handleDelete = async (item: News): Promise<void> => {
        if (!confirm(`Hapus berita "${item.title}"?`)) return;
        try {
            await newsApi.delete(item.id);
            showToast('Berita berhasil dihapus', 'success');
            fetchNews();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Berita</h2>
                    <p className="page-subtitle">Kelola berita dan pengumuman SIMETA</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => openForm()}>+ Buat Berita</button>
                </div>
            </div>

            {/* News Grid */}
            {loading ? (
                <div className="empty-state"><div className="spinner spinner-lg" /></div>
            ) : news.length === 0 ? (
                <div className="card"><div className="card-body"><div className="empty-state"><p>Belum ada berita</p></div></div></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                    {news.map((item) => (
                        <div key={item.id} className="card" style={{ overflow: 'hidden' }}>
                            {item.imageUrl ? (
                                <div style={{
                                    height: 160, background: `url(${item.imageUrl}) center/cover no-repeat`,
                                    borderBottom: '1px solid var(--color-border-light)',
                                }} />
                            ) : (
                                <div style={{
                                    height: 80, background: 'linear-gradient(135deg, var(--color-navy), var(--color-navy-light))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.3)', fontSize: '2rem',
                                }}>📰</div>
                            )}
                            <div style={{ padding: '16px 20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                                    {item.title}
                                </h3>
                                <p className="text-sm text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
                                    {item.content?.substring(0, 120)}{item.content?.length > 120 ? '...' : ''}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-xs text-muted">
                                        {item.author?.name || '-'} · {new Date(item.publishedAt || '').toLocaleDateString('id-ID')}
                                    </span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openForm(item)} title="Edit">✏️</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)} title="Hapus"
                                            style={{ color: 'var(--color-danger)' }}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Buat / Edit Berita */}
            <Modal
                isOpen={formModal.open}
                onClose={() => setFormModal({ open: false, editing: null })}
                title={formModal.editing ? 'Edit Berita' : 'Buat Berita Baru'}
                size="lg"
                footer={
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setFormModal({ open: false, editing: null })}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
                            {formModal.editing ? 'Simpan Perubahan' : 'Publikasikan'}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Judul Berita</label>
                        <input className="form-input" placeholder="Jadwal Kegiatan Minggu Depan"
                            value={form.title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Konten</label>
                        <textarea className="form-input" placeholder="Tulis konten berita..."
                            value={form.content}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, content: e.target.value })}
                            style={{ minHeight: 150 }} />
                    </div>
                    <ImageUpload
                        label="Gambar Sampul (Opsional)"
                        value={form.imageUrl ?? ''}
                        onChange={(url) => setForm({ ...form, imageUrl: url })}
                    />
                </div>
            </Modal>
        </div>
    );
}
