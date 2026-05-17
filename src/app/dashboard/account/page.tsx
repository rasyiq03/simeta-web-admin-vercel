'use client';

/**
 * SIMETA CMS — Akun Saya / Ganti Password (FIX #1)
 *
 * Sebelumnya tidak ada cara user mengganti passwordnya sendiri lewat web.
 * Halaman ini menyediakan:
 *   • Ringkasan identitas akun (recognition over recall).
 *   • Form ganti password dengan validasi jelas + indikator kekuatan
 *     (error prevention, help users recognize errors).
 *   • Banner wajib-ganti-password bila backend menandai mustChangePassword.
 *
 * Setelah sukses, user di-logout & diarahkan ke /login karena password
 * lama tidak lagi valid — langkah berikutnya dibuat eksplisit, tidak
 * membingungkan (consistency & clear exits).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import PasswordInput from '@/components/PasswordInput';

function passwordStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score: 1, label: 'Lemah', color: 'var(--color-danger)' };
    if (score <= 3) return { score, label: 'Sedang', color: 'var(--color-warning)' };
    return { score, label: 'Kuat', color: 'var(--color-success)' };
}

export default function AccountPage(): React.JSX.Element {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const mustChange = user?.mustChangePassword === true;
    const strength = passwordStrength(newPassword);

    const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
    const tooShort = newPassword.length > 0 && newPassword.length < 8;
    const sameAsOld = newPassword.length > 0 && newPassword === oldPassword;
    const canSubmit =
        oldPassword.length > 0 &&
        newPassword.length >= 8 &&
        newPassword === confirmPassword &&
        !sameAsOld &&
        !submitting;

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await authApi.changePassword({ oldPassword, newPassword });
            showToast('Password berhasil diganti. Silakan login ulang.', 'success', 4000);
            // Password lama tak valid lagi → akhiri sesi & arahkan ke login.
            setTimeout(async () => {
                await logout();
                router.replace('/login');
            }, 1500);
        } catch (err) {
            const msg = (err as Error).message;
            const friendly = /404|not found|cannot post/i.test(msg)
                ? 'Fitur ganti password belum tersedia di server. Hubungi administrator.'
                : msg;
            showToast(friendly, 'error', 5000);
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">Akun Saya</h2>
                    <p className="page-subtitle">Kelola informasi akun dan keamanan Anda</p>
                </div>
            </div>

            {mustChange && (
                <div className="warning-banner" style={{ marginBottom: 20 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>Demi keamanan, Anda <strong>wajib mengganti password</strong> sebelum melanjutkan memakai aplikasi.</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
                {/* ── Identitas ── */}
                <div className="card">
                    <div className="card-header"><span style={{ fontWeight: 700 }}>Informasi Akun</span></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, var(--color-navy) 0%, #2A3A7A 100%)',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem', fontWeight: 700,
                            }}>
                                {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name || '—'}</div>
                                <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <span className="text-sm" style={{ fontWeight: 600 }}>Role</span>
                            <span className="badge badge-navy">{user?.role}</span>
                        </div>
                    </div>
                </div>

                {/* ── Ganti Password ── */}
                <div className="card">
                    <div className="card-header"><span style={{ fontWeight: 700 }}>Ganti Password</span></div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Password Lama <span className="required">*</span></label>
                                <PasswordInput
                                    placeholder="Password Anda saat ini"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password Baru <span className="required">*</span></label>
                                <PasswordInput
                                    placeholder="Min. 8 karakter"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                                {newPassword.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                        <div style={{ flex: 1, height: 5, background: 'var(--color-border-light)', borderRadius: 999, overflow: 'hidden' }}>
                                            <div style={{ width: `${(strength.score / 5) * 100}%`, height: '100%', background: strength.color, transition: 'width .2s' }} />
                                        </div>
                                        <span className="text-xs" style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                                    </div>
                                )}
                                {tooShort && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>Password minimal 8 karakter.</p>}
                                {sameAsOld && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>Password baru tidak boleh sama dengan password lama.</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Konfirmasi Password Baru <span className="required">*</span></label>
                                <PasswordInput
                                    placeholder="Ulangi password baru"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                                {mismatch && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>Konfirmasi password tidak cocok.</p>}
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={!canSubmit} style={{ width: '100%' }}>
                                {submitting ? <span className="spinner spinner-sm" /> : null}
                                {submitting ? 'Menyimpan…' : 'Simpan Password Baru'}
                            </button>
                            <p className="text-xs text-muted" style={{ textAlign: 'center' }}>
                                Setelah berhasil, Anda akan diminta login ulang dengan password baru.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
