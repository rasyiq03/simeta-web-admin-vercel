'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/types';
import styles from './Sidebar.module.css';

interface MenuItem {
    label: string;
    href: string;
    icon: React.JSX.Element;
    roles: UserRole[];
}

const Icon = {
    Dashboard: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    Users: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    Participants: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
    ),
    Attendance: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    ),
    Mentoring: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
    Quiz: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    Permission: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
        </svg>
    ),
    Resume: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    ),
    News: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
        </svg>
    ),
    Notification: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    ),
    Grades: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
            <polyline points="17,6 23,6 23,12" />
        </svg>
    ),
    Grading: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    ),
    IAM: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    ),
    Reference: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        </svg>
    ),
    Semester: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h2" />
            <path d="M14 14h2" />
            <path d="M8 18h2" />
            <path d="M14 18h2" />
        </svg>
    ),
    Account: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Logout: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    Menu: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    ),
    Close: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
};

const menuItems: MenuItem[] = [
    { label: 'Dashboard',        href: '/dashboard',               icon: <Icon.Dashboard />,     roles: [] },
    { label: 'Pengguna',         href: '/dashboard/users',         icon: <Icon.Users />,          roles: ['ADMIN'] },
    { label: 'Peserta',          href: '/dashboard/participants',  icon: <Icon.Participants />,   roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Absensi',          href: '/dashboard/attendance',    icon: <Icon.Attendance />,     roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Mentoring',        href: '/dashboard/mentoring',     icon: <Icon.Mentoring />,      roles: ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR'] },
    { label: 'Kuis',             href: '/dashboard/quiz',          icon: <Icon.Quiz />,           roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Perizinan',        href: '/dashboard/permission',    icon: <Icon.Permission />,     roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Resume',           href: '/dashboard/resume',        icon: <Icon.Resume />,         roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Berita',           href: '/dashboard/news',          icon: <Icon.News />,           roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Notifikasi',       href: '/dashboard/notifications', icon: <Icon.Notification />,   roles: [] },
    { label: 'Akun Saya',        href: '/dashboard/account',       icon: <Icon.Account />,        roles: [] },
    { label: 'Nilai',            href: '/dashboard/grading',       icon: <Icon.Grading />,        roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Manajemen Akses', href: '/dashboard/iam',           icon: <Icon.IAM />,            roles: ['ADMIN'] },
    { label: 'Data Referensi',  href: '/dashboard/reference',     icon: <Icon.Reference />,      roles: ['ADMIN'] },
    { label: 'Semester',         href: '/dashboard/semester',      icon: <Icon.Semester />,       roles: ['ADMIN', 'PANITIA'] },
];

const roleBadgeColor: Record<string, string> = {
    ADMIN:   '#DE902A',
    PANITIA: '#EA580C',
    DOSEN:   '#2563EB',
    MENTOR:  '#16A34A',
    MENTEE:  '#7C3AED',
    PESERTA: '#0EA5E9',
};

export default function Sidebar(): React.JSX.Element {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close sidebar when route changes on mobile
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    const filteredMenu = menuItems.filter(
        (item) => item.roles.length === 0 || (user && item.roles.includes(user.role))
    );

    return (
        <>
            {/* Hamburger button — visible only on mobile */}
            <button
                className={styles.hamburger}
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            >
                {mobileOpen ? <Icon.Close /> : <Icon.Menu />}
            </button>

            {/* Mobile overlay backdrop */}
            {mobileOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
                {/* Logo / Brand */}
                <div className={styles.brand}>
                    <div className={styles.logoIcon}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                    </div>
                    <div className={styles.brandText}>
                        <span className={styles.brandName}>SIMETA</span>
                        <span className={styles.brandSub}>Management System</span>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className={styles.nav}>
                    <div className={styles.navLabel}>Menu Utama</div>
                    {filteredMenu.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navText}>{item.label}</span>
                                {isActive && <span className={styles.activeIndicator} />}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info + Logout */}
                <div className={styles.footer}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user?.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className={styles.userDetails}>
                            <span className={styles.userName}>{user?.email || 'User'}</span>
                            <span
                                className={styles.userRole}
                                style={{ color: roleBadgeColor[user?.role || ''] || 'rgba(255,255,255,0.4)' }}
                            >
                                {user?.role || '—'}
                            </span>
                        </div>
                    </div>
                    <button onClick={logout} className={styles.logoutBtn} title="Logout">
                        <Icon.Logout />
                    </button>
                </div>
            </aside>
        </>
    );
}
