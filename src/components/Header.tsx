'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { notificationApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import styles from './Header.module.css';

const pageTitles: Record<string, string> = {
    '/dashboard':               'Dashboard',
    '/dashboard/users':         'Manajemen Pengguna',
    '/dashboard/participants':  'Data Peserta',
    '/dashboard/attendance':    'Absensi',
    '/dashboard/mentoring':     'Mentoring & Hafalan',
    '/dashboard/quiz':          'Kuis',
    '/dashboard/permission':    'Pengajuan Izin',
    '/dashboard/resume':        'Resume',
    '/dashboard/news':          'Berita',
    '/dashboard/notifications': 'Notifikasi',
    '/dashboard/grades':        'Nilai & Ranking',
    '/dashboard/grading':       'Komposisi Nilai',
    '/dashboard/iam':           'Manajemen Akses',
};

export default function Header(): React.JSX.Element {
    const pathname = usePathname();
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState<number>(0);

    const title: string = pageTitles[pathname] || 'Dashboard';

    useEffect(() => {
        const fetchUnread = async (): Promise<void> => {
            try {
                const data = await notificationApi.getUnreadCount();
                setUnreadCount(data?.unreadCount || 0);
            } catch { /* ignore */ }
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className={styles.header}>
            <div className={styles.titleArea}>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>
                    {new Date().toLocaleDateString('id-ID', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                </p>
            </div>
            <div className={styles.actions}>
                {/* Greeting */}
                {user && (
                    <div className={styles.greeting}>
                        <span className={styles.greetingText}>Halo, <strong>{user.email.split('@')[0]}</strong></span>
                    </div>
                )}

                {/* Notification Bell */}
                <Link href="/dashboard/notifications" className={styles.notifBtn} aria-label="Notifikasi">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {unreadCount > 0 && (
                        <span className={styles.badge}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Link>
            </div>
        </header>
    );
}
