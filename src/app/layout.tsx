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

export const metadata: Metadata = {
    title: 'SIMETA CMS',
    description: 'Content Management System for SIMETA — Sistem Informasi Mentoring dan Tahfidz',
    icons: { icon: '/favicon.ico' },
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
