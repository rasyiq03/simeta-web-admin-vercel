/**
 * =============================================================
 * SIMETA CMS — Skrip Screenshot Otomatis (Playwright)
 * =============================================================
 *
 * Mengambil screenshot 19 figur skripsi (Gambar 4.x.y) dengan login
 * sebagai admin, lalu menyimpan PNG ke ROOT proyek.
 *
 * PRASYARAT (jalankan sekali):
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * MENJALANKAN:
 *   1. Pastikan aplikasi berjalan:  npm run build && npm run start
 *      (atau set BASE_URL ke deployment).
 *   2. node scripts/screenshots.mjs
 *
 * KONFIGURASI via env:
 *   BASE_URL   (default http://localhost:3000)
 *   ADMIN_EMAIL / ADMIN_PASS  (default akun yang diberikan)
 *
 * Catatan: halaman yang endpoint backend-nya belum tersedia akan tetap
 * di-screenshot dalam keadaan "endpoint belum tersedia" (apa adanya —
 * tidak dipalsukan).
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@simeta.id';
const ADMIN_PASS = process.env.ADMIN_PASS || 'GantiPasswordIni!';

/** Target dashboard: [namaFile, path, opsi?] */
const PAGES = [
    ['Gambar-4.2.3-absensi-rekap',          '/dashboard/attendance'],
    ['Gambar-4.7.1-access-window',          '/dashboard/access-window'],
    ['Gambar-4.8.1-role-permission',        '/dashboard/iam'],
    ['Gambar-4.6.1-grade-composition',      '/dashboard/grading'],
    ['Gambar-4.6.2-grading-rules-dryrun',   '/dashboard/grading-rules'],
    ['Gambar-4.9.1-semester-tahun-ajaran',  '/dashboard/semester'],
    ['Gambar-4.9.2-compare-semesters',      '/dashboard/compare-semesters'],
    ['Gambar-4.10.2-antrian-izin',          '/dashboard/permission'],
    ['Gambar-4.5.2-bam-mentor-score',       '/dashboard/bam'],
    ['Gambar-4.12.2-manajemen-berita',      '/dashboard/news'],
    ['Gambar-4.15.1-dasbor-nilai',          '/dashboard/grades'],
    ['Gambar-4.16.1-audit-log',             '/dashboard/audit-log'],
    ['Gambar-4.17.1-data-referensi',        '/dashboard/reference'],
    ['Gambar-4.14.2-riwayat-upload-quota',  '/dashboard/upload-history'],
    ['Gambar-4.4.2-kelompok-mentoring',     '/dashboard/mentoring'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[screenshots] ${m}`);

async function settle(page) {
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
    await sleep(900); // beri waktu animasi/spinner selesai
}

async function shoot(page, name) {
    const file = join(ROOT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    log(`✓ ${name}.png`);
}

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const results = { ok: [], fail: [] };
    const guard = async (name, fn) => {
        try { await fn(); results.ok.push(name); }
        catch (e) { results.fail.push(`${name}: ${e.message}`); log(`✗ ${name}: ${e.message}`); }
    };

    // ── 1. Login (sebelum autentikasi) ──
    await guard('Gambar-4.1.1-login', async () => {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await shoot(page, 'Gambar-4.1.1-login');
    });

    // ── 2. Reset Password via Email ──
    await guard('Gambar-4.1.2-reset-password', async () => {
        await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await shoot(page, 'Gambar-4.1.2-reset-password');
    });

    // ── Login sebagai admin ──
    log(`Login sebagai ${ADMIN_EMAIL} @ ${BASE_URL}`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await Promise.all([
        page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {}),
        page.click('button[type="submit"]'),
    ]);
    await settle(page);
    if (!page.url().includes('/dashboard')) {
        log('⚠ Login tampaknya gagal — periksa kredensial / BASE_URL / backend. Lanjut mencoba tetap.');
    }

    // ── Halaman dashboard standar ──
    for (const [name, path] of PAGES) {
        await guard(name, async () => {
            await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
            await settle(page);
            await shoot(page, name);
        });
    }

    // ── 19. Form Auto-Generate Kelompok (modal di halaman Mentoring) ──
    await guard('Gambar-4.4.1-auto-generate-kelompok', async () => {
        await page.goto(`${BASE_URL}/dashboard/mentoring`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await page.getByRole('button', { name: /Auto-Generate/i }).first().click();
        await page.waitForSelector('.modal-content', { timeout: 5000 });
        await sleep(500);
        await shoot(page, 'Gambar-4.4.1-auto-generate-kelompok');
    });

    // ── 14. Hasil ekspor Excel (.xlsx) — UNDUH file asli, bukan screenshot ──
    await guard('Gambar-4.15.3-export-excel', async () => {
        await page.goto(`${BASE_URL}/dashboard/grades`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.getByRole('button', { name: /Export Excel/i }).click(),
        ]);
        await download.saveAs(join(ROOT, 'Gambar-4.15.3-rekap-nilai.xlsx'));
        log('✓ Gambar-4.15.3-rekap-nilai.xlsx (file Excel asli)');
        // Sekaligus screenshot halaman saat aksi ekspor sebagai pelengkap.
        await shoot(page, 'Gambar-4.15.3-export-excel-halaman');
    });

    await browser.close();

    log('──────── RINGKASAN ────────');
    log(`Berhasil: ${results.ok.length}`);
    if (results.fail.length) {
        log(`Gagal: ${results.fail.length}`);
        for (const f of results.fail) log(`  - ${f}`);
        process.exitCode = 1;
    }
})().catch((e) => { console.error(e); process.exit(1); });
