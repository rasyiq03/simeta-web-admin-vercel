'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { quizApi, parseCSV, exportToCSV } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import ImageUpload from '@/components/ImageUpload';
import type { Quiz, QuizType, QuizResult, QuestionType, EssaySubmission } from '@/types';

interface QuestionForm {
    type: QuestionType;
    text: string;
    imageUrl: string;
    options: string[];
    optionImages: string[];
    correctIdx: number;
}

interface QuizForm {
    title: string;
    type: QuizType;
    questions: QuestionForm[];
}

interface ResultsModalState {
    open: boolean;
    quizId: string;
    quizTitle: string;
    results: QuizResult[];
}

interface EssayModalState {
    open: boolean;
    quizId: string;
    quizTitle: string;
    submissions: EssaySubmission[];
    grading: Record<string, string>;
}

const DEFAULT_QUESTION: QuestionForm = {
    type: 'MULTIPLE_CHOICE',
    text: '',
    imageUrl: '',
    options: ['', '', '', ''],
    optionImages: ['', '', '', ''],
    correctIdx: 0,
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: 'Pilihan Ganda',
    TRUE_FALSE: 'Benar / Salah',
    ESSAY: 'Esai',
    SHORT_ANSWER: 'Isian Pendek',
};

const QUESTION_TYPE_COLORS: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: 'badge-info',
    TRUE_FALSE: 'badge-warning',
    ESSAY: 'badge-purple',
    SHORT_ANSWER: 'badge-navy',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const CSV_TEMPLATE_HEADER = ['Tipe (PG/BS/ESAI/ISIAN)', 'Pertanyaan', 'URL Gambar Soal', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Jawaban Benar (A/B/C/D)'];
const CSV_TEMPLATE_ROWS = [
    ['PG', 'Apa ibu kota Indonesia?', '', 'Jakarta', 'Bandung', 'Surabaya', 'Bali', 'A'],
    ['BS', 'Matahari terbit dari timur', '', 'Benar', 'Salah', '', '', 'A'],
    ['ESAI', 'Jelaskan pengertian zakat!', '', '', '', '', '', ''],
    ['ISIAN', 'Ibu kota Jawa Barat adalah ___', '', '', '', '', '', ''],
];

function typeCodeToEnum(code: string): QuestionType {
    const map: Record<string, QuestionType> = {
        'PG': 'MULTIPLE_CHOICE', 'MC': 'MULTIPLE_CHOICE',
        'BS': 'TRUE_FALSE', 'B/S': 'TRUE_FALSE', 'TF': 'TRUE_FALSE', 'BENAR/SALAH': 'TRUE_FALSE',
        'ESAI': 'ESSAY', 'ESSAY': 'ESSAY',
        'ISIAN': 'SHORT_ANSWER', 'SHORT': 'SHORT_ANSWER', 'ISIAN PENDEK': 'SHORT_ANSWER',
    };
    return map[code.toUpperCase().trim()] ?? 'MULTIPLE_CHOICE';
}

function makeDefaultOptions(type: QuestionType): string[] {
    if (type === 'TRUE_FALSE') return ['Benar', 'Salah', '', ''];
    return ['', '', '', ''];
}

export default function QuizPage(): React.JSX.Element {
    const [quizzes, setQuizzes]             = useState<Quiz[]>([]);
    const [loading, setLoading]             = useState(true);
    const [activeTab, setActiveTab]         = useState<'list' | 'create' | 'essay'>('list');
    const [form, setForm]                   = useState<QuizForm>({ title: '', type: 'PRETEST', questions: [{ ...DEFAULT_QUESTION }] });
    const [resultsModal, setResultsModal]   = useState<ResultsModalState>({ open: false, quizId: '', quizTitle: '', results: [] });
    const [essayModal, setEssayModal]       = useState<EssayModalState>({ open: false, quizId: '', quizTitle: '', submissions: [], grading: {} });
    const [importModal, setImportModal]     = useState(false);
    const [dragOver, setDragOver]           = useState(false);
    const [importedQuestions, setImportedQuestions] = useState<QuestionForm[]>([]);
    const [saving, setSaving]               = useState(false);
    const fileInputRef                      = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const fetchQuizzes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await quizApi.getAll();
            setQuizzes(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

    /* ── Question helpers ── */
    const addQuestion = () =>
        setForm((p) => ({ ...p, questions: [...p.questions, { ...DEFAULT_QUESTION }] }));

    const removeQuestion = (idx: number) =>
        setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));

    const updateQ = (idx: number, patch: Partial<QuestionForm>) =>
        setForm((p) => {
            const qs = [...p.questions];
            qs[idx] = { ...qs[idx], ...patch };
            return { ...p, questions: qs };
        });

    const changeType = (idx: number, type: QuestionType) =>
        setForm((p) => {
            const qs = [...p.questions];
            const isAutoGrade = type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE';
            qs[idx] = {
                ...qs[idx],
                type,
                options: makeDefaultOptions(type),
                optionImages: ['', '', '', ''],
                correctIdx: 0,
                ...(isAutoGrade ? {} : { correctIdx: -1 }),
            };
            return { ...p, questions: qs };
        });

    const updateOption = (qIdx: number, oIdx: number, value: string) =>
        setForm((p) => {
            const qs = [...p.questions];
            const opts = [...qs[qIdx].options];
            opts[oIdx] = value;
            qs[qIdx] = { ...qs[qIdx], options: opts };
            return { ...p, questions: qs };
        });

    const updateOptionImage = (qIdx: number, oIdx: number, value: string) =>
        setForm((p) => {
            const qs = [...p.questions];
            const imgs = [...qs[qIdx].optionImages];
            imgs[oIdx] = value;
            qs[qIdx] = { ...qs[qIdx], optionImages: imgs };
            return { ...p, questions: qs };
        });

    /* ── Submit Quiz ── */
    const handleCreateQuiz = async () => {
        if (!form.title) { showToast('Judul kuis wajib diisi', 'error'); return; }
        for (const q of form.questions) {
            if (!q.text) { showToast('Semua pertanyaan harus memiliki teks', 'error'); return; }
            if ((q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options.filter(Boolean).length < 2) {
                showToast('Pilihan ganda harus memiliki minimal 2 opsi', 'error');
                return;
            }
        }
        try {
            setSaving(true);
            await quizApi.create({
                title: form.title,
                type: form.type,
                questions: form.questions.map((q) => ({
                    type: q.type,
                    text: q.text,
                    imageUrl: q.imageUrl || undefined,
                    options: q.options.filter(Boolean),
                    optionImages: q.optionImages.map((img) => img || null),
                    correctIdx: q.correctIdx >= 0 ? q.correctIdx : 0,
                })),
            });
            showToast('Kuis berhasil dibuat', 'success');
            setForm({ title: '', type: 'PRETEST', questions: [{ ...DEFAULT_QUESTION }] });
            setActiveTab('list');
            fetchQuizzes();
        } catch (err) { showToast((err as Error).message, 'error'); }
        finally { setSaving(false); }
    };

    /* ── View Results ── */
    const viewResults = async (quiz: Quiz) => {
        try {
            const data = await quizApi.getResults(quiz.id);
            setResultsModal({ open: true, quizId: quiz.id, quizTitle: quiz.title, results: Array.isArray(data) ? data : [] });
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── View Essay Submissions ── */
    const viewEssaySubmissions = async (quiz: Quiz) => {
        try {
            const data = await quizApi.getEssaySubmissions(quiz.id);
            setEssayModal({ open: true, quizId: quiz.id, quizTitle: quiz.title, submissions: Array.isArray(data) ? data : [], grading: {} });
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── Grade Essay ── */
    const handleGradeEssay = async (submissionId: string) => {
        const scoreStr = essayModal.grading[submissionId];
        const score = parseFloat(scoreStr);
        if (isNaN(score) || score < 0 || score > 100) {
            showToast('Nilai harus antara 0–100', 'error');
            return;
        }
        try {
            await quizApi.gradeEssay(essayModal.quizId, submissionId, score);
            showToast('Nilai berhasil disimpan', 'success');
            setEssayModal((p) => ({
                ...p,
                submissions: p.submissions.map((s) =>
                    s.id === submissionId ? { ...s, score, gradedAt: new Date().toISOString() } : s
                ),
            }));
        } catch (err) { showToast((err as Error).message, 'error'); }
    };

    /* ── CSV Import ── */
    const downloadTemplate = () => {
        exportToCSV('template_soal_kuis.csv', CSV_TEMPLATE_HEADER, CSV_TEMPLATE_ROWS);
        showToast('Template unduhan berhasil', 'success');
    };

    const handleCSVFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { showToast('File kosong atau format tidak valid', 'error'); return; }
            const parsed: QuestionForm[] = rows.slice(1)
                .filter((r) => r[1]?.trim())
                .map((r) => {
                    const type = typeCodeToEnum(r[0] || 'PG');
                    const isAutoGrade = type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE';
                    const options = [r[3] || '', r[4] || '', r[5] || '', r[6] || ''];
                    const answerChar = (r[7] || '').toUpperCase().trim();
                    const correctIdx = isAutoGrade ? Math.max(0, OPTION_LABELS.indexOf(answerChar)) : 0;
                    return {
                        type,
                        text: r[1] || '',
                        imageUrl: r[2] || '',
                        options: type === 'TRUE_FALSE' ? ['Benar', 'Salah', '', ''] : options,
                        optionImages: ['', '', '', ''],
                        correctIdx: isAutoGrade ? correctIdx : -1,
                    };
                });
            if (parsed.length === 0) { showToast('Tidak ada soal yang valid ditemukan', 'error'); return; }
            setImportedQuestions(parsed);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const applyImportedQuestions = () => {
        setForm((p) => ({ ...p, questions: [...p.questions.filter((q) => q.text), ...importedQuestions] }));
        setImportModal(false);
        setImportedQuestions([]);
        setActiveTab('create');
        showToast(`${importedQuestions.length} soal berhasil diimpor`, 'success');
    };

    const hasEssayQuestions = form.questions.some((q) => q.type === 'ESSAY' || q.type === 'SHORT_ANSWER');

    return (
        <div>
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">Manajemen Kuis</h2>
                    <p className="page-subtitle">{quizzes.length} kuis tersedia</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-excel btn-sm" onClick={() => setImportModal(true)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Import Soal CSV
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab(activeTab === 'create' ? 'list' : 'create')}>
                        {activeTab === 'create' ? (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                                Tutup Editor
                            </>
                        ) : (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Buat Kuis
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="tab-nav" style={{ marginBottom: 20 }}>
                <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
                    Daftar Kuis ({quizzes.length})
                </button>
                <button className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
                    Buat / Edit
                </button>
                <button className={`tab-btn ${activeTab === 'essay' ? 'active' : ''}`} onClick={() => setActiveTab('essay')}>
                    Review Esai
                </button>
            </div>

            {/* ══════════════════════════ TAB: LIST ══════════════════════════ */}
            {activeTab === 'list' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="empty-state"><div className="spinner spinner-lg" /></div>
                        ) : quizzes.length === 0 ? (
                            <div className="empty-state">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                <p>Belum ada kuis</p>
                                <small>Klik &ldquo;Buat Kuis&rdquo; untuk membuat kuis pertama</small>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Judul</th>
                                            <th>Tipe</th>
                                            <th>Soal</th>
                                            <th>Peserta</th>
                                            <th>Jenis Soal</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quizzes.map((q, i) => (
                                            <tr key={q.id}>
                                                <td className="text-xs text-muted">{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{q.title}</td>
                                                <td><StatusBadge status={q.type} /></td>
                                                <td>
                                                    <span className="badge badge-info">{q._count?.questions || 0} soal</span>
                                                </td>
                                                <td>
                                                    <span className="badge badge-amber">{q._count?.results || 0} peserta</span>
                                                </td>
                                                <td>
                                                    {q.hasEssay ? (
                                                        <span className="badge badge-purple">Ada Esai</span>
                                                    ) : (
                                                        <span className="badge badge-navy">PG</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-icon-sm" title="Lihat Hasil"
                                                            onClick={() => viewResults(q)}
                                                            style={{ color: 'var(--color-info)' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                                                            </svg>
                                                        </button>
                                                        {q.hasEssay && (
                                                            <button className="btn btn-ghost btn-icon-sm" title="Review Esai"
                                                                onClick={() => viewEssaySubmissions(q)}
                                                                style={{ color: 'var(--color-purple)' }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════ TAB: CREATE ══════════════════════════ */}
            {activeTab === 'create' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Quiz Meta */}
                    <div className="card">
                        <div className="card-header">
                            <span className="heading-3">Informasi Kuis</span>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Judul Kuis <span className="required">*</span></label>
                                    <input className="form-input" placeholder="Contoh: Pretest Minggu 1"
                                        value={form.title}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipe</label>
                                    <select className="form-select" value={form.type}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm({ ...form, type: e.target.value as QuizType })}>
                                        <option value="PRETEST">Pretest</option>
                                        <option value="POSTTEST">Posttest</option>
                                    </select>
                                </div>
                            </div>
                            {hasEssayQuestions && (
                                <div className="warning-banner" style={{ marginTop: 16 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    Kuis ini mengandung soal esai/isian. Nilai untuk soal tersebut harus diinput manual oleh Admin/Dosen setelah mahasiswa mengerjakan.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Questions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="heading-3">Soal <span className="badge badge-navy">{form.questions.length}</span></span>
                            <button className="btn btn-outline btn-sm" onClick={addQuestion}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Tambah Soal
                            </button>
                        </div>

                        {form.questions.map((q, qIdx) => (
                            <div key={qIdx} className="question-card">
                                {/* Question Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                            Soal {qIdx + 1}
                                        </span>
                                        <span className={`badge ${QUESTION_TYPE_COLORS[q.type]}`}>
                                            {QUESTION_TYPE_LABELS[q.type]}
                                        </span>
                                    </div>
                                    {form.questions.length > 1 && (
                                        <button className="btn btn-ghost btn-icon-sm" onClick={() => removeQuestion(qIdx)}
                                            style={{ color: 'var(--color-danger)' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {/* Question Type Selector */}
                                <div className="tab-nav" style={{ marginBottom: 14 }}>
                                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                                        <button
                                            key={t}
                                            className={`tab-btn ${q.type === t ? 'active' : ''}`}
                                            onClick={() => changeType(qIdx, t)}
                                            style={{ fontSize: '0.78125rem' }}
                                        >
                                            {QUESTION_TYPE_LABELS[t]}
                                        </button>
                                    ))}
                                </div>

                                {/* Question Text */}
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Pertanyaan <span className="required">*</span></label>
                                    <textarea className="form-input" placeholder="Tulis pertanyaan di sini..."
                                        rows={2}
                                        value={q.text}
                                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateQ(qIdx, { text: e.target.value })} />
                                </div>

                                {/* Question Image */}
                                <div style={{ marginBottom: 14 }}>
                                    <ImageUpload
                                        label="Gambar Soal (opsional)"
                                        value={q.imageUrl}
                                        onChange={(url) => updateQ(qIdx, { imageUrl: url })}
                                    />
                                </div>

                                {/* Options — only for PG and TF */}
                                {(q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label className="form-label">Pilihan Jawaban</label>
                                        {(q.type === 'TRUE_FALSE' ? q.options.slice(0, 2) : q.options).map((opt, oIdx) => (
                                            <div key={oIdx} className={`option-row ${q.correctIdx === oIdx ? 'correct' : ''}`}>
                                                <input
                                                    type="radio"
                                                    name={`correct-${qIdx}`}
                                                    checked={q.correctIdx === oIdx}
                                                    onChange={() => updateQ(qIdx, { correctIdx: oIdx })}
                                                    style={{ accentColor: 'var(--color-success)', flexShrink: 0 }}
                                                />
                                                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8125rem', minWidth: 16 }}>
                                                    {OPTION_LABELS[oIdx]}
                                                </span>
                                                {q.type === 'TRUE_FALSE' ? (
                                                    <span style={{ flex: 1, fontWeight: 500 }}>{opt}</span>
                                                ) : (
                                                    <input className="form-input" placeholder={`Opsi ${OPTION_LABELS[oIdx]}`}
                                                        value={opt} style={{ flex: 1 }}
                                                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateOption(qIdx, oIdx, e.target.value)} />
                                                )}
                                                {q.type === 'MULTIPLE_CHOICE' && (
                                                    <div style={{ minWidth: 120 }}>
                                                        <ImageUpload
                                                            compact
                                                            value={q.optionImages[oIdx] || ''}
                                                            onChange={(url) => updateOptionImage(qIdx, oIdx, url)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <p className="form-helper">
                                            Klik tombol radio (⭕) untuk menandai jawaban yang benar
                                        </p>
                                    </div>
                                )}

                                {/* Essay / Short Answer notice */}
                                {(q.type === 'ESSAY' || q.type === 'SHORT_ANSWER') && (
                                    <div className="info-banner">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <span>
                                            Soal {q.type === 'ESSAY' ? 'esai' : 'isian pendek'} tidak dinilai otomatis.
                                            Admin/Dosen harus menginput nilai setelah memeriksa jawaban mahasiswa di tab <strong>Review Esai</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-outline" onClick={() => setActiveTab('list')}>Batal</button>
                        <button className="btn btn-primary" onClick={handleCreateQuiz} disabled={saving}>
                            {saving ? <span className="spinner spinner-sm" /> : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17 21 17 13 7 13 7 21"/>
                                    <polyline points="7 3 7 8 15 8"/>
                                </svg>
                            )}
                            Simpan Kuis
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════ TAB: ESSAY REVIEW ══════════════════════════ */}
            {activeTab === 'essay' && (
                <div className="card">
                    <div className="card-header">
                        <span className="heading-3">Review Jawaban Esai / Isian</span>
                    </div>
                    <div className="card-body">
                        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                            Pilih kuis yang mengandung soal esai di tab <strong>Daftar Kuis</strong> lalu klik ikon pensil untuk membuka review.
                        </p>
                        <div className="info-banner">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            Kuis dengan soal esai/isian akan ditandai dengan badge <span className="badge badge-purple" style={{ marginLeft: 4 }}>Ada Esai</span>. Klik ikon pensil untuk membuka panel penilaian.
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Modal: Quiz Results ══ */}
            <Modal
                isOpen={resultsModal.open}
                onClose={() => setResultsModal({ open: false, quizId: '', quizTitle: '', results: [] })}
                title={`Hasil Kuis: ${resultsModal.quizTitle}`}
                size="lg"
            >
                {resultsModal.results.length === 0 ? (
                    <div className="empty-state"><p>Belum ada peserta yang mengerjakan</p></div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Mahasiswa</th>
                                    <th>Skor</th>
                                    <th>Status</th>
                                    <th>Waktu Submit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultsModal.results.map((r, i) => (
                                    <tr key={r.id}>
                                        <td className="text-xs text-muted">{i + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{r.user?.name || '—'}</td>
                                        <td>
                                            <span style={{
                                                fontWeight: 800,
                                                fontSize: '1rem',
                                                color: r.score >= 75 ? 'var(--color-success)' :
                                                    r.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                                            }}>
                                                {r.score}
                                            </span>
                                        </td>
                                        <td>
                                            {r.status === 'PENDING_REVIEW' ? (
                                                <span className="badge badge-warning">Menunggu Review</span>
                                            ) : (
                                                <span className="badge badge-success">Selesai</span>
                                            )}
                                        </td>
                                        <td className="text-xs text-muted">
                                            {new Date(r.submittedAt).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Modal>

            {/* ══ Modal: Essay Review ══ */}
            <Modal
                isOpen={essayModal.open}
                onClose={() => setEssayModal((p) => ({ ...p, open: false }))}
                title={`Review Esai: ${essayModal.quizTitle}`}
                size="lg"
            >
                {essayModal.submissions.length === 0 ? (
                    <div className="empty-state"><p>Belum ada jawaban esai</p></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {essayModal.submissions.map((sub) => (
                            <div key={sub.id} style={{
                                border: '1.5px solid var(--color-border-light)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    background: 'var(--color-surface-2)',
                                    padding: '10px 16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid var(--color-border-light)',
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{sub.user?.name || '—'}</span>
                                        <span className="text-sm text-muted" style={{ marginLeft: 8 }}>{sub.user?.email}</span>
                                    </div>
                                    {sub.score != null ? (
                                        <span className="badge badge-success">Nilai: {sub.score}</span>
                                    ) : (
                                        <span className="badge badge-warning">Belum dinilai</span>
                                    )}
                                </div>
                                <div style={{ padding: '12px 16px' }}>
                                    <p className="text-xs text-muted" style={{ marginBottom: 6 }}>
                                        Pertanyaan: <strong>{sub.question?.text || '—'}</strong>
                                    </p>
                                    <div style={{
                                        background: 'var(--color-amber-50)',
                                        border: '1px solid var(--color-amber-100)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '10px 14px',
                                        fontSize: '0.875rem',
                                        marginBottom: 12,
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {sub.answer || <em style={{ color: 'var(--color-text-muted)' }}>Tidak ada jawaban</em>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min={0} max={100}
                                            placeholder="Nilai (0-100)"
                                            style={{ maxWidth: 140 }}
                                            value={essayModal.grading[sub.id] ?? (sub.score != null ? String(sub.score) : '')}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                setEssayModal((p) => ({ ...p, grading: { ...p.grading, [sub.id]: e.target.value } }))
                                            }
                                        />
                                        <button className="btn btn-success btn-sm" onClick={() => handleGradeEssay(sub.id)}>
                                            Simpan Nilai
                                        </button>
                                        {sub.gradedAt && (
                                            <span className="text-xs text-muted">
                                                Dinilai: {new Date(sub.gradedAt).toLocaleString('id-ID')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            {/* ══ Modal: Import CSV Soal ══ */}
            <Modal
                isOpen={importModal}
                onClose={() => setImportModal(false)}
                title="Import Soal dari CSV"
                size="lg"
                footer={
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                            Unduh Template
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-outline btn-sm" onClick={() => setImportModal(false)}>Batal</button>
                        <button className="btn btn-primary btn-sm" onClick={applyImportedQuestions} disabled={importedQuestions.length === 0}>
                            Tambahkan {importedQuestions.length > 0 ? `(${importedQuestions.length} soal)` : ''}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="info-banner">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>
                            Kolom CSV: <strong>Tipe, Pertanyaan, URL Gambar, Opsi A, B, C, D, Jawaban Benar</strong>.
                            Tipe: PG, BS, ESAI, ISIAN. Unduh template untuk contoh lengkap.
                        </span>
                    </div>

                    <div
                        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault(); setDragOver(false);
                            const file = e.dataTransfer.files[0];
                            if (file) handleCSVFile(file);
                        }}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span className="dropzone-text">
                            {importedQuestions.length > 0
                                ? `${importedQuestions.length} soal siap diimpor`
                                : 'Klik atau drag file CSV ke sini'}
                        </span>
                        <span className="dropzone-hint">Format CSV yang bisa dibuka/diedit di Excel</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.txt"
                            style={{ display: 'none' }}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const file = e.target.files?.[0];
                                if (file) handleCSVFile(file);
                                e.target.value = '';
                            }}
                        />
                    </div>

                    {importedQuestions.length > 0 && (
                        <div className="table-container" style={{ maxHeight: 220 }}>
                            <table className="data-table">
                                <thead>
                                    <tr><th>#</th><th>Tipe</th><th>Pertanyaan</th></tr>
                                </thead>
                                <tbody>
                                    {importedQuestions.slice(0, 8).map((q, i) => (
                                        <tr key={i}>
                                            <td className="text-xs text-muted">{i + 1}</td>
                                            <td><span className={`badge ${QUESTION_TYPE_COLORS[q.type]}`}>{QUESTION_TYPE_LABELS[q.type]}</span></td>
                                            <td style={{ fontWeight: 500 }}>{q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text}</td>
                                        </tr>
                                    ))}
                                    {importedQuestions.length > 8 && (
                                        <tr>
                                            <td colSpan={3} className="text-sm text-muted" style={{ textAlign: 'center' }}>
                                                ... dan {importedQuestions.length - 8} soal lainnya
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
