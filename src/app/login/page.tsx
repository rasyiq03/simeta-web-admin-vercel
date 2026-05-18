/**
 * SIMETA CMS — Login Page (TypeScript)
 * Form login dengan gradient background dan glassmorphism card.
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, getDeviceId } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import PasswordInput from '@/components/PasswordInput';
import styles from './login.module.css';

export default function LoginPage(): React.JSX.Element {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // FIX F3-4 — `login()` lama (yang menerima access token) sudah tidak ada
    // karena token kini di cookie httpOnly. Gunakan `refreshSession()` untuk
    // memuat user state dari /auth/me setelah cookie ter-set oleh response.
    const { refreshSession, user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    // FIX #6 — Jika tiba di sini karena sesi berakhir (bukan logout manual),
    // beri tahu user dengan jelas alasannya (heuristic: visibility of system
    // status & help users recognize/recover from errors).
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem('simeta_session_expired') === '1') {
            sessionStorage.removeItem('simeta_session_expired');
            showToast('Sesi Anda telah berakhir. Silakan login kembali.', 'info', 5000);
        }
    }, [showToast]);

    useEffect(() => {
        if (user) {
            // FIX #6 — kembali ke halaman terakhir sebelum sesi putus.
            const back = typeof window !== 'undefined'
                ? sessionStorage.getItem('simeta_redirect')
                : null;
            if (back) sessionStorage.removeItem('simeta_redirect');
            router.replace(back || '/dashboard');
        }
    }, [user, router]);

    /** Handle form submit */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!email || !password) {
            showToast('Email dan password wajib diisi', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // Backend men-set cookie httpOnly di response; kita tidak perlu
            // (dan tidak bisa) membaca access_token dari body.
            await authApi.login({ email, password, deviceId: getDeviceId() });
            await refreshSession();
            showToast('Login berhasil!', 'success');
        } catch (err) {
            showToast((err as Error).message || 'Login gagal', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Decorative floating circles */}
            <div className={`${styles.circle} ${styles.circle1}`} />
            <div className={`${styles.circle} ${styles.circle2}`} />
            <div className={`${styles.circle} ${styles.circle3}`} />

            {/* Login Card */}
            <div className={styles.card}>
                <div className={styles.logoContainer}>
                    <div className={styles.logo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="SIMETA" />
                    </div>
                    <h1 className={styles.title}>SIMETA CMS</h1>
                    <p className={styles.subtitle}>Masuk ke panel administrasi</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="admin@simeta.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <PasswordInput
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={isLoading} style={{ width: '100%', marginTop: 8 }}>
                        {isLoading ? <span className="spinner" /> : 'Masuk'}
                    </button>
                </form>
            </div>
        </div>
    );
}
