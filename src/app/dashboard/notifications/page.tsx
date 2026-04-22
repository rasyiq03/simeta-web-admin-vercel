/**
 * =============================================================
 * SIMETA CMS — Notifications Page (TypeScript)
 * Lihat daftar notifikasi, tandai sebagai dibaca (satu/semua).
 * Diakses oleh semua role yang terautentikasi.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { notificationApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { Notification, NotificationType } from '@/types';

/** Mapping tipe notifikasi ke emoji icon */
const typeIcons: Record<NotificationType | string, string> = {
    NEWS: '📰',
    ATTENDANCE: '📋',
    QUIZ: '❓',
    PERMISSION: '📝',
    SYSTEM: '⚙️',
};

/** Mapping tipe notifikasi ke badge class */
const typeBadgeClass: Record<NotificationType | string, string> = {
    NEWS: 'badge-info',
    ATTENDANCE: 'badge-success',
    QUIZ: 'badge-amber',
    PERMISSION: 'badge-warning',
    SYSTEM: 'badge-navy',
};

export default function NotificationsPage(): React.JSX.Element {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { showToast } = useToast();

    /** Fetch semua notifikasi */
    const fetchNotifications = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const data = await notificationApi.getAll();
            setNotifications(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    /** Tandai satu notifikasi sebagai dibaca */
    const handleMarkRead = async (id: string): Promise<void> => {
        try {
            await notificationApi.markRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    /** Tandai semua sebagai dibaca */
    const handleMarkAllRead = async (): Promise<void> => {
        try {
            await notificationApi.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            showToast('Semua notifikasi ditandai sudah dibaca', 'success');
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const unreadCount: number = notifications.filter((n) => !n.isRead).length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Notifikasi</h2>
                    <p className="page-subtitle">
                        {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                    </p>
                </div>
                <div className="page-actions">
                    {unreadCount > 0 && (
                        <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
                            ✓ Tandai Semua Dibaca
                        </button>
                    )}
                </div>
            </div>

            {/* Notification List */}
            {loading ? (
                <div className="empty-state"><div className="spinner spinner-lg" /></div>
            ) : notifications.length === 0 ? (
                <div className="card"><div className="card-body"><div className="empty-state"><p>🔔 Tidak ada notifikasi</p></div></div></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className="card"
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px',
                                cursor: !n.isRead ? 'pointer' : 'default',
                                background: !n.isRead ? 'var(--color-amber-50)' : 'var(--color-surface)',
                                borderLeft: !n.isRead ? '3px solid var(--color-amber)' : '3px solid transparent',
                                transition: 'all var(--transition-fast)',
                            }}
                            onClick={() => !n.isRead && handleMarkRead(n.id)}
                        >
                            <span style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: 2 }}>
                                {typeIcons[n.type] || '🔔'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: !n.isRead ? 600 : 400, fontSize: '0.9375rem', marginBottom: 4 }}>
                                    {n.title}
                                </div>
                                <p className="text-sm text-muted" style={{ lineHeight: 1.5 }}>{n.message}</p>
                                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                    <span className="text-xs text-muted">
                                        {new Date(n.createdAt).toLocaleString('id-ID')}
                                    </span>
                                    <span className={`badge ${typeBadgeClass[n.type] || 'badge-info'}`} style={{ fontSize: '0.625rem' }}>
                                        {n.type}
                                    </span>
                                </div>
                            </div>
                            {!n.isRead && (
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', background: 'var(--color-amber)',
                                    flexShrink: 0, marginTop: 8,
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
