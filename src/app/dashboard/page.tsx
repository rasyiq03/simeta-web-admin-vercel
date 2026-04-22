/**
 * =============================================================
 * SIMETA CMS — Dashboard Overview Page (TypeScript)
 * Halaman utama setelah login: welcome banner, stats cards, berita terbaru.
 * =============================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { usersApi, permissionApi, attendanceApi, quizApi, newsApi } from '@/lib/api';
import type { News, User, Permission, AttendanceSession, Quiz } from '@/types';

/** Statistik dashboard */
interface DashboardStats {
    totalUsers: number;
    pendingPermissions: number;
    totalSessions: number;
    totalQuizzes: number;
}

export default function DashboardPage(): React.JSX.Element {
    const { user, hasRole } = useAuth();
    const { showToast } = useToast();

    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0, pendingPermissions: 0, totalSessions: 0, totalQuizzes: 0,
    });
    const [recentNews, setRecentNews] = useState<News[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    /** Fetch data dashboard (statistik + berita terbaru) */
    const fetchDashboard = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);

            // Fetch data secara paralel
            const [newsData, usersData, permData, sessionsData, quizzesData] = await Promise.allSettled([
                newsApi.getAll(),
                hasRole('ADMIN') ? usersApi.getAll() : Promise.resolve([] as User[]),
                hasRole('ADMIN') ? permissionApi.getAll() : Promise.resolve([] as Permission[]),
                hasRole('ADMIN') ? attendanceApi.getAll() : Promise.resolve([] as AttendanceSession[]),
                hasRole('ADMIN', 'DOSEN') ? quizApi.getAll() : Promise.resolve([] as Quiz[]),
            ]);

            // Extract resolved values safely
            const newsResult = newsData.status === 'fulfilled' ? newsData.value : [];
            const usersResult = usersData.status === 'fulfilled' ? usersData.value : [];
            const permResult = permData.status === 'fulfilled' ? permData.value : [];
            const sessionsResult = sessionsData.status === 'fulfilled' ? sessionsData.value : [];
            const quizzesResult = quizzesData.status === 'fulfilled' ? quizzesData.value : [];

            setRecentNews(Array.isArray(newsResult) ? newsResult.slice(0, 5) : []);
            setStats({
                totalUsers: Array.isArray(usersResult) ? usersResult.length : 0,
                pendingPermissions: Array.isArray(permResult)
                    ? permResult.filter((p: Permission) => p.status === 'PENDING').length : 0,
                totalSessions: Array.isArray(sessionsResult) ? sessionsResult.length : 0,
                totalQuizzes: Array.isArray(quizzesResult) ? quizzesResult.length : 0,
            });
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [hasRole, showToast]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    if (loading) {
        return (
            <div className="empty-state" style={{ minHeight: 400 }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    return (
        <div>
            {/* Welcome Banner */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)',
                color: '#FFF', padding: '32px 36px', marginBottom: 24, border: 'none',
            }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>
                    Selamat datang, {user?.email?.split('@')[0] || 'Admin'} 👋
                </h2>
                <p style={{ opacity: 0.7, fontSize: '0.9375rem' }}>
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stats Grid (Admin only) */}
            {hasRole('ADMIN') && (
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-icon navy">👥</div>
                        <div className="stat-info">
                            <div className="stat-label">Total User</div>
                            <div className="stat-value">{stats.totalUsers}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon amber">📝</div>
                        <div className="stat-info">
                            <div className="stat-label">Izin Pending</div>
                            <div className="stat-value">{stats.pendingPermissions}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon success">📋</div>
                        <div className="stat-info">
                            <div className="stat-label">Sesi Absensi</div>
                            <div className="stat-value">{stats.totalSessions}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon info">❓</div>
                        <div className="stat-info">
                            <div className="stat-label">Total Kuis</div>
                            <div className="stat-value">{stats.totalQuizzes}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent News */}
            <div className="card">
                <div className="card-header">
                    <h3 className="heading-3">📰 Berita Terbaru</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {recentNews.length === 0 ? (
                        <div className="empty-state"><p>Belum ada berita</p></div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Judul</th>
                                        <th>Penulis</th>
                                        <th>Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentNews.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 500 }}>{item.title}</td>
                                            <td className="text-sm text-muted">{item.author?.name || '-'}</td>
                                            <td className="text-sm text-muted">
                                                {new Date(item.publishedAt || '').toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
