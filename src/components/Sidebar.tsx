'use client';

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
    Logout: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
};

const menuItems: MenuItem[] = [
    { label: 'Dashboard',   href: '/dashboard',              icon: <Icon.Dashboard />,    roles: [] },
    { label: 'Pengguna',    href: '/dashboard/users',        icon: <Icon.Users />,        roles: ['ADMIN'] },
    { label: 'Absensi',     href: '/dashboard/attendance',   icon: <Icon.Attendance />,   roles: ['ADMIN'] },
    { label: 'Mentoring',   href: '/dashboard/mentoring',    icon: <Icon.Mentoring />,    roles: ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR'] },
    { label: 'Kuis',        href: '/dashboard/quiz',         icon: <Icon.Quiz />,         roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Perizinan',   href: '/dashboard/permission',   icon: <Icon.Permission />,   roles: ['ADMIN', 'PANITIA'] },
    { label: 'Resume',      href: '/dashboard/resume',       icon: <Icon.Resume />,       roles: ['ADMIN', 'PANITIA'] },
    { label: 'Berita',      href: '/dashboard/news',         icon: <Icon.News />,         roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
    { label: 'Notifikasi',  href: '/dashboard/notifications',icon: <Icon.Notification />, roles: [] },
    { label: 'Nilai',       href: '/dashboard/grades',       icon: <Icon.Grades />,       roles: ['ADMIN', 'PANITIA', 'DOSEN'] },
];

export default function Sidebar(): React.JSX.Element {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const filteredMenu = menuItems.filter(
        (item) => item.roles.length === 0 || (user && item.roles.includes(user.role))
    );

    const roleBadgeColor: Record<string, string> = {
        ADMIN:   '#DE902A',
        PANITIA: '#EA580C',
        DOSEN:   '#2563EB',
        MENTOR:  '#16A34A',
        MENTEE:  '#7C3AED',
    };

    return (
        <aside className={styles.sidebar}>
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
    );
}
