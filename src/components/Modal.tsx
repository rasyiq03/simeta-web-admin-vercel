/**
 * =============================================================
 * SIMETA CMS — Modal Component (TypeScript)
 * Reusable modal dialog dengan backdrop blur dan slide-up animation.
 * =============================================================
 */

'use client';

import { useEffect, type ReactNode } from 'react';

/** Props untuk Modal component */
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    disableBackdropClose?: boolean;
}

/** Mapping ukuran modal */
const sizeMap: Record<string, string> = {
    sm: '420px',
    md: '560px',
    lg: '720px',
};

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', disableBackdropClose = false }: ModalProps): React.JSX.Element | null {
    /* Prevent body scroll saat modal terbuka */
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    /* Tutup modal dengan tombol Escape */
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={disableBackdropClose ? undefined : onClose}>
            <div
                className="modal-content"
                style={{ maxWidth: sizeMap[size] }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 className="heading-3">{title}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
