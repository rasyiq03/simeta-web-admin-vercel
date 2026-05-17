/**
 * =============================================================
 * SIMETA CMS — Auth Context (TypeScript)
 *
 * FIX F3-4 — JWT tidak lagi disimpan di `localStorage`. Backend men-set
 * cookie httpOnly `simeta_token` (access) + `simeta_refresh` (refresh) saat
 * login. JS frontend TIDAK BISA membaca cookie httpOnly → XSS yang lolos
 * tidak bisa lagi exfiltrasi token.
 *
 * Konsekuensi:
 *   • Tidak ada decode JWT di frontend (kita tidak punya token-nya).
 *   • Identitas user disinkronkan via `GET /auth/me` setiap kali context
 *     pertama kali di-mount. Endpoint itu otomatis menerima cookie karena
 *     `credentials: 'include'` di apiFetch().
 *   • `token` di context API tetap diekspos (nilai null) supaya komponen
 *     legacy yang mengecek `if (token) …` tidak crash. Mereka harus
 *     diarahkan ke `user` untuk pengecekan auth state ke depan.
 * =============================================================
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { JWTPayload, UserRole } from '@/types';
import { authApi } from '@/lib/api';

interface AuthContextType {
    user: JWTPayload | null;
    /** @deprecated Token tidak lagi accessible dari JS — selalu null. Gunakan `user`. */
    token: null;
    loading: boolean;
    /** Dipanggil setelah login API sukses untuk merefresh user state dari cookie. */
    refreshSession: () => Promise<void>;
    /** Logout: hit backend (clear cookie + revoke refresh), reset state. */
    logout: () => Promise<void>;
    hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Map User dari /auth/me ke shape JWTPayload yang dipakai komponen UI lama
 * (mereka membaca .sub, .role, .name, .email). Sisa field opsional.
 */
function userToPayload(u: { id: string; email: string; role: UserRole; name: string; mahasiswaType?: string | null; mustChangePassword?: boolean }): JWTPayload {
    return {
        sub: u.id,
        email: u.email,
        role: u.role,
        name: u.name,
        // Field-field lain di JWTPayload diisi default — tidak kritis untuk UI.
        mahasiswaType: (u.mahasiswaType ?? null) as JWTPayload['mahasiswaType'],
        mustChangePassword: u.mustChangePassword ?? false,
        iat: 0,
        exp: 0,
    };
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<JWTPayload | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const refreshSession = useCallback(async (): Promise<void> => {
        try {
            // /auth/me memerlukan cookie (atau Bearer). apiFetch sudah
            // `credentials: 'include'` setelah patch F3-4 di api.ts.
            const me = await authApi.getMe();
            setUser(userToPayload(me));
        } catch {
            // Bukan auth → biarkan user null. Komponen yang butuh auth akan
            // redirect ke /login lewat AuthGuard mereka sendiri.
            setUser(null);
        }
    }, []);

    useEffect(() => {
        void refreshSession().finally(() => setLoading(false));
    }, [refreshSession]);

    // FIX #6 — Saat apiFetch mendeteksi sesi mati (401 + refresh gagal), ia
    // broadcast `simeta:session-expired`. Di sini kita: simpan halaman tujuan
    // supaya bisa balik setelah login, tandai alasan agar /login bisa memberi
    // pesan jelas, lalu kosongkan user → AuthGuard otomatis redirect ke /login.
    useEffect(() => {
        const onExpired = (): void => {
            if (typeof window !== 'undefined') {
                const path = window.location.pathname + window.location.search;
                if (path.startsWith('/dashboard')) {
                    sessionStorage.setItem('simeta_redirect', path);
                }
                sessionStorage.setItem('simeta_session_expired', '1');
            }
            setUser(null);
        };
        window.addEventListener('simeta:session-expired', onExpired);
        return () => window.removeEventListener('simeta:session-expired', onExpired);
    }, []);

    // FIX #6 — Refresh token diam-diam secara berkala + saat tab kembali
    // aktif, sehingga sesi tidak putus mendadak di tengah pemakaian
    // ("token cepat expired"). Gagal refresh tidak meng-logout langsung;
    // biar request berikutnya yang memutuskan via alur 401 di apiFetch.
    useEffect(() => {
        if (!user) return;
        const SILENT_REFRESH_MS = 9 * 60 * 1000; // < umur access token tipikal
        const tick = (): void => { void authApi.refresh().catch(() => {}); };
        const interval = setInterval(tick, SILENT_REFRESH_MS);
        const onVisible = (): void => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [user]);

    const logout = useCallback(async (): Promise<void> => {
        try {
            await authApi.logout();
        } catch {
            // Walau request gagal, tetap reset state lokal supaya UI tidak
            // terjebak di state "punya user di memori tapi tidak bisa request".
        }
        setUser(null);
    }, []);

    const hasRole = useCallback(
        (...roles: UserRole[]): boolean => (user ? roles.includes(user.role) : false),
        [user],
    );

    return (
        <AuthContext.Provider
            value={{ user, token: null, loading, refreshSession, logout, hasRole }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth harus digunakan di dalam AuthProvider');
    }
    return context;
}
