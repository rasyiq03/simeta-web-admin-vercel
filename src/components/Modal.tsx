'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    disableBackdropClose?: boolean;
}

const sizeMap: Record<string, string> = {
    sm: '420px',
    md: '560px',
    lg: '720px',
};

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', disableBackdropClose = false }: ModalProps): React.JSX.Element | null {
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    return createPortal(
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
        </div>,
        document.body,
    );
}
