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
