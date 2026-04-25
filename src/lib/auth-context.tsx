/**
 * =============================================================
 * SIMETA CMS — Auth Context (TypeScript)
 * Menyediakan autentikasi state (user, token, login, logout)
 * untuk seluruh aplikasi via React Context.
 * =============================================================
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { JWTPayload, UserRole } from '@/types';

/** Tipe data yang disediakan oleh AuthContext */
interface AuthContextType {
    user: JWTPayload | null;
    token: string | null;
    loading: boolean;
    login: (accessToken: string) => void;
    logout: () => void;
    hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Decode JWT payload tanpa library tambahan.
 * @param token - JWT token string
 * @returns Decoded payload atau null jika gagal
 */
function decodeJWT(token: string): JWTPayload | null {
    try {
        const payload = token.split('.')[1];
        // JWT uses base64url (- and _); atob() needs standard base64 (+ and /)
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(padded)) as JWTPayload;
    } catch {
        return null;
    }
}

/** Props untuk AuthProvider */
interface AuthProviderProps {
    children: ReactNode;
}

/**
 * AuthProvider — Wrapper component yang menyediakan auth state
 * untuk semua child components.
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<JWTPayload | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Restore auth state dari localStorage saat pertama kali load
    useEffect(() => {
        const storedToken = localStorage.getItem('simeta_token');
        if (storedToken) {
            const decoded = decodeJWT(storedToken);
            if (decoded) {
                setUser(decoded);
                setToken(storedToken);
            } else {
                // Token invalid, bersihkan
                localStorage.removeItem('simeta_token');
            }
        }
        setLoading(false);
    }, []);

    /**
     * Login: simpan token ke localStorage dan update state.
     * @param accessToken - JWT access token dari API login
     */
    const login = useCallback((accessToken: string): void => {
        localStorage.setItem('simeta_token', accessToken);
        const decoded = decodeJWT(accessToken);
        setUser(decoded);
        setToken(accessToken);
        if (decoded && decoded.role !== 'MENTOR' && decoded.role !== 'MENTEE') {
            localStorage.removeItem('simeta_device_id');
        }
    }, []);

    /**
     * Logout: hapus token dari localStorage dan redirect ke login.
     */
    const logout = useCallback((): void => {
        localStorage.removeItem('simeta_token');
        setUser(null);
        setToken(null);
    }, []);

    /**
     * Cek apakah user memiliki salah satu dari role yang diberikan.
     * @param roles - Role yang diizinkan
     */
    const hasRole = useCallback((...roles: UserRole[]): boolean => {
        return user ? roles.includes(user.role) : false;
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Custom hook untuk mengakses auth context.
 * @throws Error jika digunakan di luar AuthProvider
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth harus digunakan di dalam AuthProvider');
    }
    return context;
}
