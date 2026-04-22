/**
 * =============================================================
 * SIMETA CMS — StatusBadge Component (TypeScript)
 * Pill-shaped badge yang otomatis menentukan warna berdasarkan value.
 * =============================================================
 */

/** Props untuk StatusBadge */
interface StatusBadgeProps {
    status: string;
}

/** Mapping status ke CSS class */
const statusMap: Record<string, string> = {
    APPROVED: 'badge-success', PENDING: 'badge-warning', REJECTED: 'badge-danger',
    PRESENT: 'badge-success', LATE: 'badge-warning', ABSENT: 'badge-danger',
    ADMIN: 'badge-navy', PANITIA: 'badge-amber', DOSEN: 'badge-info', MENTOR: 'badge-success', MENTEE: 'badge-purple',
    PRETEST: 'badge-info', POSTTEST: 'badge-amber',
    A: 'badge-success', B: 'badge-info', C: 'badge-warning', D: 'badge-amber', E: 'badge-danger',
};

export default function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
    const className = statusMap[status] || 'badge-info';
    return <span className={`badge ${className}`}>{status}</span>;
}
