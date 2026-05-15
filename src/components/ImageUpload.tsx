'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { uploadApi } from '@/lib/api';

export const UPLOAD_SETTINGS_KEY = 'simeta_upload_settings';

export interface UploadSettings {
    folderId: string;
    maxSizeMB: number;
}

export function getUploadSettings(): UploadSettings {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(UPLOAD_SETTINGS_KEY) : null;
        if (!raw) return { folderId: '', maxSizeMB: 5 };
        const parsed = JSON.parse(raw) as Partial<UploadSettings>;
        return { folderId: parsed.folderId ?? '', maxSizeMB: parsed.maxSizeMB ?? 5 };
    } catch { return { folderId: '', maxSizeMB: 5 }; }
}

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    label?: string;
    /** Show compact button-only variant (no label rendered by this component) */
    compact?: boolean;
    accept?: string;
}

export default function ImageUpload({ value, onChange, label, compact = false, accept = 'image/*' }: ImageUploadProps): React.JSX.Element {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        const settings = getUploadSettings();
        const maxBytes = (settings.maxSizeMB || 5) * 1024 * 1024;
        if (file.size > maxBytes) {
            setError(`Ukuran file maks. ${settings.maxSizeMB || 5} MB`);
            return;
        }
        setError('');
        setUploading(true);
        try {
            const { url } = await uploadApi.uploadFile(file, { folderId: settings.folderId || undefined });
            onChange(url);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploading(false);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const inputEl = (
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleInputChange} />
    );

    if (compact) {
        return (
            <div>
                {inputEl}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {value && (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={value} alt="preview"
                                style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)', display: 'block' }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-danger)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}
                                title="Hapus"
                            >✕</button>
                        </div>
                    )}
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        style={{ fontSize: '0.75rem', padding: '4px 8px', gap: 4 }}
                        title="Unggah gambar"
                    >
                        {uploading ? (
                            <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} />
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                            </svg>
                        )}
                        {value ? 'Ganti' : 'Upload'}
                    </button>
                </div>
                {error && <p style={{ fontSize: '0.6875rem', color: 'var(--color-danger)', margin: '3px 0 0' }}>{error}</p>}
            </div>
        );
    }

    return (
        <div className="form-group">
            {label && <label className="form-label">{label}</label>}
            {inputEl}

            {value && (
                <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={value}
                        alt="preview"
                        style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'block' }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                            borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, padding: 0,
                        }}
                        title="Hapus gambar"
                    >✕</button>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    style={{ flexShrink: 0, gap: 6 }}
                >
                    {uploading ? (
                        <><span className="spinner spinner-sm" /> Mengunggah…</>
                    ) : (
                        <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                            </svg>
                            {value ? 'Ganti Gambar' : 'Pilih & Unggah'}
                        </>
                    )}
                </button>
                {value && (
                    <span className="text-xs text-muted" style={{ wordBreak: 'break-all', flex: 1 }}>
                        {value.length > 70 ? `${value.slice(0, 70)}…` : value}
                    </span>
                )}
            </div>
            {error && <p className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>{error}</p>}
        </div>
    );
}
