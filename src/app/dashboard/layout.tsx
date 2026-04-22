/**
 * SIMETA CMS — Dashboard Layout (TypeScript)
 * Layout utama: sidebar + header + content area.
 * Termasuk authentication guard.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    const { user, loading } = useAuth();
    const router = useRouter();

    /* Auth guard — redirect ke login jika belum autentikasi */
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="empty-state" style={{ minHeight: '100vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.mainArea}>
                <Header />
                <main className={styles.content}>{children}</main>
            </div>
        </div>
    );
}
