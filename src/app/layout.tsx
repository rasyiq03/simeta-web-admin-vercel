/**
 * SIMETA CMS — Root Layout (TypeScript)
 * Wrapper utama: font Inter, AuthProvider, ToastProvider.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

// WAJIB untuk CSP nonce. middleware.ts membuat nonce acak per-request lalu
// menaruhnya di header CSP. Next.js HANYA menyuntik nonce itu ke <script>
// saat halaman dirender DINAMIS per-request. Tanpa ini, App Router
// mem-prerender halaman secara STATIS saat build (tanpa nonce) → seluruh
// script ter-blokir CSP di produksi → React tak pernah mount, spinner abadi.
// Aplikasi ini CMS ber-auth (semua client-rendered), jadi dynamic = tepat.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'SIMETA CMS',
    description: 'Content Management System for SIMETA — Sistem Informasi Mentoring dan Tahfidz',
    icons: { icon: '/logo.png', shortcut: '/logo.png', apple: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <html lang="id" className={inter.className}>
            <body>
                <AuthProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
