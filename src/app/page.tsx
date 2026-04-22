/**
 * SIMETA CMS — Root Page (TypeScript)
 * Auto-redirect ke /dashboard jika authenticated, /login jika belum.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RootPage(): React.JSX.Element {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            router.replace(user ? '/dashboard' : '/login');
        }
    }, [user, loading, router]);

    return (
        <div className="empty-state" style={{ minHeight: '100vh' }}>
            <div className="spinner spinner-lg" />
        </div>
    );
}
