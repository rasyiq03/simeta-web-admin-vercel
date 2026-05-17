/**
 * =============================================================
 * SIMETA CMS — Semester Context (FIX #4)
 * =============================================================
 *
 * Masalah lama: hampir semua halaman hanya menampilkan data semester
 * AKTIF. Tidak ada cara melihat data semester sebelumnya (mis. "semester A").
 *
 * Solusi: satu selektor semester GLOBAL (dirender di Header). Pilihan
 * disimpan di sini dan dibaca oleh halaman data (Absensi, Mentoring,
 * Peserta, Nilai) lewat hook `useSemester()`. Pilihan dipertahankan di
 * localStorage agar konsisten antar-navigasi (heuristic: consistency &
 * user control). Default = semester aktif.
 *
 * Endpoint backend yang belum mendukung query `?semesterId=` akan
 * mengabaikannya — UI tetap berfungsi (degradasi anggun).
 */

'use client';

import {
    createContext, useCallback, useContext, useEffect, useMemo, useState,
    type ReactNode,
} from 'react';
import { semesterApi } from '@/lib/api';
import type { Semester } from '@/types';

const STORAGE_KEY = 'simeta_selected_semester';

interface SemesterContextType {
    /** Semua semester (urut terbaru → terlama). Kosong = fitur tak tersedia. */
    semesters: Semester[];
    /** Semester yang sedang dipilih untuk dilihat. */
    selectedSemesterId: string;
    selectedSemester: Semester | null;
    /** Semester yang ditandai aktif oleh backend. */
    activeSemester: Semester | null;
    /** True bila user sedang melihat semester selain yang aktif (mode arsip). */
    isViewingPast: boolean;
    setSelectedSemesterId: (id: string) => void;
    loading: boolean;
}

const SemesterContext = createContext<SemesterContextType | null>(null);

export function SemesterProvider({ children }: { children: ReactNode }) {
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [selectedSemesterId, setSelected] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await semesterApi.list();
                if (cancelled) return;
                const sorted = [...list].sort(
                    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
                );
                setSemesters(sorted);

                const stored = typeof window !== 'undefined'
                    ? localStorage.getItem(STORAGE_KEY)
                    : null;
                const storedValid = stored && sorted.some((s) => s.id === stored);
                const active = sorted.find((s) => s.isActive);
                setSelected(storedValid ? (stored as string) : (active?.id ?? sorted[0]?.id ?? ''));
            } catch {
                // Endpoint semester tak tersedia / tanpa akses → fitur disembunyikan.
                if (!cancelled) setSemesters([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const setSelectedSemesterId = useCallback((id: string) => {
        setSelected(id);
        if (typeof window !== 'undefined') {
            if (id) localStorage.setItem(STORAGE_KEY, id);
            else localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const value = useMemo<SemesterContextType>(() => {
        const selectedSemester = semesters.find((s) => s.id === selectedSemesterId) ?? null;
        const activeSemester = semesters.find((s) => s.isActive) ?? null;
        return {
            semesters,
            selectedSemesterId,
            selectedSemester,
            activeSemester,
            isViewingPast: !!selectedSemester && !selectedSemester.isActive,
            setSelectedSemesterId,
            loading,
        };
    }, [semesters, selectedSemesterId, setSelectedSemesterId, loading]);

    return (
        <SemesterContext.Provider value={value}>{children}</SemesterContext.Provider>
    );
}

export function useSemester(): SemesterContextType {
    const ctx = useContext(SemesterContext);
    if (!ctx) throw new Error('useSemester harus dipakai di dalam SemesterProvider');
    return ctx;
}
