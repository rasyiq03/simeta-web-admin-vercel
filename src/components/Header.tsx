'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { notificationApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSemester } from '@/lib/semester-context';
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
    '/dashboard/reference':     'Data Referensi',
    '/dashboard/semester':      'Manajemen Semester',
    '/dashboard/account':       'Akun Saya',
    '/dashboard/grading-rules': 'Grading Rules & Simulasi',
    '/dashboard/access-window': 'Manajemen Access Window',
    '/dashboard/bam':           'Rekap BAM & Skor Mentor',
    '/dashboard/compare-semesters': 'Perbandingan Antar-Semester',
    '/dashboard/audit-log':     'Audit Log',
    '/dashboard/upload-history': 'Riwayat Upload & Kuota',
};

export default function Header(): React.JSX.Element {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const {
        semesters, selectedSemesterId, setSelectedSemesterId, isViewingPast,
    } = useSemester();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    // Tutup menu user saat klik di luar / pindah halaman.
    useEffect(() => {
        const handler = (e: MouseEvent): void => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    const handleLogout = async (): Promise<void> => {
        setMenuOpen(false);
        await logout();
        router.replace('/login');
    };

    const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

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
                {/* FIX #4 — Selektor semester global. Hanya tampil bila data
                    semester tersedia. Badge "Arsip" memberi tahu user secara
                    eksplisit bahwa ia sedang melihat data NON-aktif. */}
                {semesters.length > 0 && (
                    <div className={styles.semesterBox}>
                        {isViewingPast && (
                            <span className={styles.archiveBadge} title="Anda sedang melihat data semester lampau, bukan semester aktif">
                                Arsip
                            </span>
                        )}
                        <label className={styles.semesterLabel} htmlFor="semester-select">Semester</label>
                        <select
                            id="semester-select"
                            className={styles.semesterSelect}
                            value={selectedSemesterId}
                            onChange={(e) => setSelectedSemesterId(e.target.value)}
                            title="Pilih semester untuk melihat datanya"
                        >
                            {semesters.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.code}{s.isActive ? ' • Aktif' : ''}
                                </option>
                            ))}
                        </select>
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

                {/* FIX #1 — Menu akun: akses ke "Akun Saya" (ganti password)
                    dan Logout, terlihat jelas di setiap halaman. */}
                {user && (
                    <div className={styles.userMenu} ref={menuRef}>
                        <button
                            className={styles.userBtn}
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                        >
                            <span className={styles.userAvatar}>{initial}</span>
                            <span className={styles.userName}>{user.name || user.email.split('@')[0]}</span>
                            <svg width="12" height="12" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 1.5L6 6.5L11 1.5"/>
                            </svg>
                        </button>
                        {menuOpen && (
                            <div className={styles.userDropdown} role="menu">
                                <div className={styles.userDropdownHead}>
                                    <div className={styles.userDropdownName}>{user.name || user.email.split('@')[0]}</div>
                                    <div className={styles.userDropdownEmail}>{user.email}</div>
                                    <span className={styles.userDropdownRole}>{user.role}</span>
                                </div>
                                <Link href="/dashboard/account" className={styles.userDropdownItem} role="menuitem">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                    </svg>
                                    Akun Saya & Ganti Password
                                </Link>
                                <button className={`${styles.userDropdownItem} ${styles.userDropdownDanger}`} onClick={handleLogout} role="menuitem">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
