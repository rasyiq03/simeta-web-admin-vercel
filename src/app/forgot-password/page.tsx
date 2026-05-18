/**
 * SIMETA CMS — Reset Password via Email (Gambar 4.1.2)
 * User memasukkan email → backend mengirim tautan/kode reset.
 */

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage(): React.JSX.Element {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (!email) { showToast('Email wajib diisi', 'error'); return; }
        setLoading(true);
        try {
            await authApi.forgotPassword({ email });
            setSent(true);
            showToast('Jika email terdaftar, tautan reset telah dikirim.', 'success', 5000);
        } catch (err) {
            const msg = (err as Error).message;
            // Demi keamanan, jangan bocorkan apakah email terdaftar.
            if (/404|not found|cannot post/i.test(msg)) {
                showToast('Fitur reset password belum tersedia di server.', 'error', 5000);
            } else {
                setSent(true);
                showToast('Jika email terdaftar, tautan reset telah dikirim.', 'success', 5000);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={`${styles.circle} ${styles.circle1}`} />
            <div className={`${styles.circle} ${styles.circle2}`} />
            <div className={`${styles.circle} ${styles.circle3}`} />

            <div className={styles.card}>
                <div className={styles.logoContainer}>
                    <div className={styles.logo}>S</div>
                    <h1 className={styles.title}>Reset Password</h1>
                    <p className={styles.subtitle}>Masukkan email akun Anda untuk menerima tautan reset</p>
                </div>

                {sent ? (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', margin: '0 auto',
                            background: 'var(--color-success-bg)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>
                            </svg>
                        </div>
                        <p className="text-sm">
                            Jika <strong>{email}</strong> terdaftar, kami telah mengirim tautan untuk
                            menyetel ulang password. Periksa kotak masuk &amp; folder spam.
                        </p>
                        <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
                            Kembali ke Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                className="form-input"
                                type="email"
                                placeholder="nama@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                            {loading ? <span className="spinner" /> : 'Kirim Tautan Reset'}
                        </button>
                        <Link href="/login" className="text-sm" style={{ textAlign: 'center', display: 'block', marginTop: 14, color: 'var(--color-text-muted)' }}>
                            ← Kembali ke Login
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}
