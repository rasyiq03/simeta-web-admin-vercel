/**
 * SIMETA CMS — Setel Password Baru (target tautan email)
 * Token diambil dari query (?token=...).
 */

'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import PasswordInput from '@/components/PasswordInput';
import styles from '../login/login.module.css';

function ResetPasswordInner(): React.JSX.Element {
    const params = useSearchParams();
    const router = useRouter();
    const { showToast } = useToast();
    const token = params.get('token') ?? '';

    const [pw, setPw] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const mismatch = confirm.length > 0 && pw !== confirm;
    const canSubmit = !!token && pw.length >= 8 && pw === confirm && !loading;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            await authApi.resetPassword({ token, newPassword: pw });
            showToast('Password berhasil disetel. Silakan login.', 'success', 4000);
            router.replace('/login');
        } catch (err) {
            showToast((err as Error).message, 'error', 5000);
            setLoading(false);
        }
    };

    return (
        <div className={styles.card}>
            <div className={styles.logoContainer}>
                <div className={styles.logo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="SIMETA" />
                </div>
                <h1 className={styles.title}>Setel Password Baru</h1>
                <p className={styles.subtitle}>Masukkan password baru untuk akun Anda</p>
            </div>
            {!token ? (
                <div style={{ textAlign: 'center' }}>
                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                        Token reset tidak ditemukan atau tidak valid. Minta tautan baru.
                    </p>
                    <Link href="/forgot-password" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>
                        Minta Tautan Reset
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label">Password Baru</label>
                        <PasswordInput placeholder="Min. 8 karakter" value={pw}
                            onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Konfirmasi Password</label>
                        <PasswordInput placeholder="Ulangi password" value={confirm}
                            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                        {mismatch && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>Konfirmasi tidak cocok.</p>}
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={!canSubmit} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? <span className="spinner" /> : 'Simpan Password'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default function ResetPasswordPage(): React.JSX.Element {
    return (
        <div className={styles.container}>
            <div className={`${styles.circle} ${styles.circle1}`} />
            <div className={`${styles.circle} ${styles.circle2}`} />
            <div className={`${styles.circle} ${styles.circle3}`} />
            <Suspense fallback={<div className="spinner spinner-lg" />}>
                <ResetPasswordInner />
            </Suspense>
        </div>
    );
}
