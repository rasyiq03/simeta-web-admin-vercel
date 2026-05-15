'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { iamApi } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { IamPermission, UserRole } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR', 'MENTEE', 'PESERTA'];

const ROLE_META: Record<string, { color: string; short: string }> = {
    ADMIN:   { color: '#DE902A', short: 'ADM' },
    PANITIA: { color: '#EA580C', short: 'PAN' },
    DOSEN:   { color: '#2563EB', short: 'DOS' },
    MENTOR:  { color: '#16A34A', short: 'MNT' },
    MENTEE:  { color: '#7C3AED', short: 'MNE' },
    PESERTA: { color: '#0EA5E9', short: 'PST' },
};

/**
 * Default role assignments per permission name.
 * Used by "Reset ke Default" button.
 * Backend must seed these permission names.
 */
const DEFAULT_PERM_ROLES: Record<string, UserRole[]> = {
    'absensi:checkin':    ['MENTEE', 'PESERTA'],
    'absensi:manage':     ['ADMIN', 'PANITIA', 'DOSEN'],
    'absensi:read':       ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR'],
    'bam:create':         ['MENTOR'],
    'bam:manage':         ['ADMIN', 'PANITIA', 'DOSEN'],
    'bam:read':           ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR'],
    'dashboard:all':      ['ADMIN', 'PANITIA', 'DOSEN'],
    'dashboard:own':      ['MENTOR', 'MENTEE', 'PESERTA'],
    'grading:manage':     ['ADMIN', 'PANITIA', 'DOSEN'],
    'grading:simulate':   ['ADMIN', 'PANITIA', 'DOSEN'],
    'mentoring:manage':   ['ADMIN', 'PANITIA', 'DOSEN'],
    'mentoring:read':     ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR'],
    'news:manage':        ['ADMIN', 'PANITIA', 'DOSEN'],
    'news:read':          ['ADMIN', 'PANITIA', 'DOSEN', 'MENTOR', 'MENTEE', 'PESERTA'],
    'permission:manage':  ['ADMIN', 'PANITIA', 'DOSEN'],
    'quiz:manage':        ['ADMIN', 'PANITIA', 'DOSEN'],
    'quiz:submit':        ['MENTEE', 'PESERTA'],
    'reference:manage':   ['ADMIN'],
    'users:manage':       ['ADMIN', 'PANITIA'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build permId → Set<UserRole> map from fetched data. */
function buildRoleMap(perms: IamPermission[], roleMaps: IamPermission[][]): Map<string, Set<UserRole>> {
    const map = new Map<string, Set<UserRole>>();
    for (const p of perms) map.set(p.id, new Set());
    ROLES.forEach((role, i) => {
        for (const p of roleMaps[i]) {
            if (!map.has(p.id)) map.set(p.id, new Set());
            map.get(p.id)!.add(role);
        }
    });
    return map;
}

// ─── Toggle Cell ─────────────────────────────────────────────────────────────

interface ToggleCellProps {
    has: boolean;
    busy: boolean;
    color: string;
    onClick: () => void;
    title: string;
}
function ToggleCell({ has, busy, color, onClick, title }: ToggleCellProps) {
    return (
        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
            <button
                onClick={onClick}
                disabled={busy}
                title={title}
                style={{
                    width: 26, height: 26,
                    borderRadius: 6,
                    border: `2px solid ${has ? color : 'var(--color-border)'}`,
                    background: has ? color : 'transparent',
                    cursor: busy ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms ease',
                    padding: 0, flexShrink: 0,
                    opacity: busy ? 0.6 : 1,
                }}
            >
                {busy ? (
                    <span
                        className="spinner"
                        style={{ width: 11, height: 11, borderWidth: 1.5,
                            borderTopColor: has ? '#fff' : color,
                            borderColor: has ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                        }}
                    />
                ) : has ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                ) : null}
            </button>
        </td>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function IAMPage(): React.JSX.Element {
    const { showToast } = useToast();

    const [perms, setPerms]         = useState<IamPermission[]>([]);
    const [roleMap, setRoleMap]     = useState<Map<string, Set<UserRole>>>(new Map());
    const [loading, setLoading]     = useState(true);
    const [toggling, setToggling]   = useState<Set<string>>(new Set());
    const [resetting, setResetting] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [allPerms, ...roleMaps] = await Promise.all([
                iamApi.getPermissions(),
                ...ROLES.map((r) => iamApi.getRolePermissions(r).catch(() => [] as IamPermission[])),
            ]);
            setPerms(allPerms);
            setRoleMap(buildRoleMap(allPerms, roleMaps));
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Optimistic toggle
    const handleToggle = async (perm: IamPermission, role: UserRole, currentlyHas: boolean) => {
        const key = `${perm.id}:${role}`;
        if (toggling.has(key) || resetting) return;

        setToggling((prev) => new Set([...prev, key]));
        setRoleMap((prev) => {
            const next = new Map(prev);
            const set  = new Set(next.get(perm.id) ?? []);
            if (currentlyHas) set.delete(role); else set.add(role);
            next.set(perm.id, set);
            return next;
        });

        try {
            if (currentlyHas) {
                await iamApi.removePermissionFromRole(role, perm.id);
            } else {
                await iamApi.assignPermissionToRole(role, perm.id);
            }
        } catch (err) {
            // Revert on failure
            setRoleMap((prev) => {
                const next = new Map(prev);
                const set  = new Set(next.get(perm.id) ?? []);
                if (currentlyHas) set.add(role); else set.delete(role);
                next.set(perm.id, set);
                return next;
            });
            showToast((err as Error).message, 'error');
        } finally {
            setToggling((prev) => { const next = new Set(prev); next.delete(key); return next; });
        }
    };

    // Apply predefined defaults
    const handleResetDefault = async () => {
        if (!confirm('Reset semua hak akses ke konfigurasi default?\n\nIni akan mengubah assignment yang tidak sesuai default.')) return;
        setResetting(true);

        const toAssign: Array<{ id: string; role: UserRole }> = [];
        const toRemove: Array<{ id: string; role: UserRole }> = [];

        for (const perm of perms) {
            const defaultRoles = new Set<UserRole>(DEFAULT_PERM_ROLES[perm.name] ?? []);
            const currentRoles = roleMap.get(perm.id) ?? new Set<UserRole>();
            for (const role of ROLES) {
                if (defaultRoles.has(role) && !currentRoles.has(role)) toAssign.push({ id: perm.id, role });
                if (!defaultRoles.has(role) && currentRoles.has(role)) toRemove.push({ id: perm.id, role });
            }
        }

        if (toAssign.length === 0 && toRemove.length === 0) {
            showToast('Sudah sesuai default, tidak ada perubahan', 'success');
            setResetting(false);
            return;
        }

        try {
            await Promise.all([
                ...toAssign.map(({ id, role }) => iamApi.assignPermissionToRole(role, id)),
                ...toRemove.map(({ id, role }) => iamApi.removePermissionFromRole(role, id)),
            ]);
            showToast(`Default diterapkan: +${toAssign.length} ditambah, −${toRemove.length} dihapus`, 'success');
            await loadAll();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setResetting(false);
        }
    };

    // Group permissions by resource prefix (absensi, bam, dashboard, …)
    const grouped = useMemo(() => {
        const groups = new Map<string, IamPermission[]>();
        for (const perm of perms) {
            const resource = perm.name.split(':')[0] ?? 'other';
            if (!groups.has(resource)) groups.set(resource, []);
            groups.get(resource)!.push(perm);
        }
        return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [perms]);

    // Count per role: how many permissions each role has
    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const role of ROLES) counts[role] = 0;
        for (const set of roleMap.values()) {
            for (const role of set) counts[role] = (counts[role] ?? 0) + 1;
        }
        return counts;
    }, [roleMap]);

    if (loading) {
        return (
            <div className="empty-state" style={{ minHeight: 320 }}>
                <div className="spinner spinner-lg" />
                <p>Memuat data akses…</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Akses</h2>
                    <p className="page-subtitle">Atur hak akses setiap peran — klik kotak untuk mengubah</p>
                </div>
                <button
                    className="btn btn-outline btn-sm"
                    onClick={handleResetDefault}
                    disabled={resetting || perms.length === 0}
                >
                    {resetting ? <span className="spinner spinner-sm" /> : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                        </svg>
                    )}
                    Reset ke Default
                </button>
            </div>

            {perms.length === 0 && (
                <div className="warning-banner" style={{ marginBottom: 20 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Tidak ada permission ditemukan. Backend perlu seed permission terlebih dahulu.</span>
                </div>
            )}

            {/* Matrix table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ minWidth: 820 }}>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 190 }}>Permission</th>
                                    <th style={{ minWidth: 200 }}>Deskripsi</th>
                                    {ROLES.map((role) => (
                                        <th key={role} style={{ textAlign: 'center', width: 82, padding: '10px 4px' }}>
                                            <div style={{ color: ROLE_META[role].color, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.04em' }}>{role}</div>
                                            <div className="text-xs text-muted" style={{ fontWeight: 400, marginTop: 2 }}>{roleCounts[role] ?? 0}/{perms.length}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {grouped.map(([resource, group]) => (
                                    <>
                                        {/* Resource group header */}
                                        <tr key={`group-${resource}`} style={{ background: 'var(--color-surface-2)' }}>
                                            <td colSpan={2 + ROLES.length} style={{ padding: '6px 16px' }}>
                                                <span style={{
                                                    fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
                                                    letterSpacing: '0.06em', color: 'var(--color-text-secondary)',
                                                }}>
                                                    {resource}
                                                </span>
                                                <span className="text-xs text-muted" style={{ marginLeft: 8 }}>({group.length})</span>
                                            </td>
                                        </tr>
                                        {/* Permission rows */}
                                        {group.map((perm) => {
                                            const assignedRoles = roleMap.get(perm.id) ?? new Set<UserRole>();
                                            return (
                                                <tr key={perm.id}>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem', paddingLeft: 24 }}>
                                                        {perm.name}
                                                    </td>
                                                    <td className="text-sm text-muted">{perm.description || '—'}</td>
                                                    {ROLES.map((role) => {
                                                        const has = assignedRoles.has(role);
                                                        const busy = toggling.has(`${perm.id}:${role}`) || resetting;
                                                        return (
                                                            <ToggleCell
                                                                key={role}
                                                                has={has}
                                                                busy={busy}
                                                                color={ROLE_META[role].color}
                                                                onClick={() => handleToggle(perm, role, has)}
                                                                title={`${has ? 'Cabut' : 'Beri'} "${perm.name}" ${has ? 'dari' : 'ke'} ${role}`}
                                                            />
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted" style={{ marginTop: 10, paddingLeft: 2 }}>
                {perms.length} permission · Perubahan langsung tersimpan · "Reset ke Default" menerapkan template akses bawaan sistem
            </p>
        </div>
    );
}
