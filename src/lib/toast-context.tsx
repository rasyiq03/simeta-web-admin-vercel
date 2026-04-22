/**
 * =============================================================
 * SIMETA CMS — Toast Notification Context (TypeScript)
 * Menyediakan sistem notifikasi toast (success/error/info)
 * yang dapat dipanggil dari mana saja di aplikasi.
 * =============================================================
 */

'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** Tipe toast yang tersedia */
type ToastType = 'success' | 'error' | 'info';

/** Data individual toast */
interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

/** Tipe context untuk toast */
interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
    children: ReactNode;
}

/**
 * ToastProvider — Menampilkan toast notifications
 */
export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    /**
     * Tampilkan toast notification
     * @param message - Pesan yang ditampilkan
     * @param type - Tipe toast (default: 'info')
     * @param duration - Durasi tampil dalam ms (default: 3000)
     */
    const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000): void => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Render toast container */}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span>
                            {toast.type === 'success' && '✓'}
                            {toast.type === 'error' && '✕'}
                            {toast.type === 'info' && 'ℹ'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/**
 * Custom hook untuk menampilkan toast.
 * @throws Error jika digunakan di luar ToastProvider
 */
export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast harus digunakan di dalam ToastProvider');
    }
    return context;
}
