# Screenshot Otomatis Figur Skripsi (Gambar 4.x.y)

Skrip `scripts/screenshots.mjs` login sebagai admin lalu menyimpan PNG ke **root proyek ini**.

## Cara Pakai

```bash
# 1. Sekali saja — pasang Playwright + browser
npm i -D playwright
npx playwright install chromium

# 2. Jalankan aplikasi (terminal lain)
npm run build && npm run start        # http://localhost:3000

# 3. Ambil semua screenshot
npm run screenshots
```

Konfigurasi opsional (env): `BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASS`.
Contoh menarget deployment:

```bash
BASE_URL=https://simeta-web-admin-vercel.vercel.app npm run screenshots
```

## Pemetaan Figur → Berkas

| Gambar | Halaman | Berkas | Catatan |
|--------|---------|--------|---------|
| 4.1.1 | Login | `Gambar-4.1.1-login.png` | — |
| 4.1.2 | Reset Password via Email | `Gambar-4.1.2-reset-password.png` | **Halaman baru** |
| 4.2.3 | Sesi absensi & rekap | `Gambar-4.2.3-absensi-rekap.png` | — |
| 4.7.1 | Access Window | `Gambar-4.7.1-access-window.png` | **Halaman baru**¹ |
| 4.8.1 | Role & Permission | `Gambar-4.8.1-role-permission.png` | — |
| 4.6.1 | Komposisi bobot nilai | `Gambar-4.6.1-grade-composition.png` | — |
| 4.6.2 | Grading Rules & dry-run | `Gambar-4.6.2-grading-rules-dryrun.png` | **Halaman baru** (simulasi client-side) |
| 4.9.1 | Semester & Tahun Ajaran | `Gambar-4.9.1-semester-tahun-ajaran.png` | — |
| 4.9.2 | Banding antar-semester | `Gambar-4.9.2-compare-semesters.png` | **Halaman baru** |
| 4.10.2 | Antrian izin + approve massal | `Gambar-4.10.2-antrian-izin.png` | — |
| 4.5.2 | Rekap BAM & skor mentor | `Gambar-4.5.2-bam-mentor-score.png` | **Halaman baru**¹ |
| 4.12.2 | Manajemen Berita | `Gambar-4.12.2-manajemen-berita.png` | — |
| 4.15.1 | Dasbor Nilai (breakdown) | `Gambar-4.15.1-dasbor-nilai.png` | — |
| 4.15.3 | Ekspor Excel (.xlsx) | `Gambar-4.15.3-rekap-nilai.xlsx` + `...-halaman.png` | File Excel asli diunduh |
| 4.16.1 | Audit Log | `Gambar-4.16.1-audit-log.png` | **Halaman baru**¹ |
| 4.17.1 | Data Referensi Master | `Gambar-4.17.1-data-referensi.png` | — |
| 4.14.2 | Riwayat upload & kuota | `Gambar-4.14.2-riwayat-upload-quota.png` | **Halaman baru**¹ |
| 4.4.2 | Daftar kelompok mentoring | `Gambar-4.4.2-kelompok-mentoring.png` | — |
| 4.4.1 | Form Auto-Generate Kelompok | `Gambar-4.4.1-auto-generate-kelompok.png` | Modal di halaman Mentoring |

¹ Halaman frontend sudah dibuat & ter-route, namun **bergantung pada endpoint backend**
(`/access-windows`, `/bam/sessions`, `/audit-logs`, `/upload/history`, `/upload/quota`).
Bila endpoint belum ada, halaman menampilkan keadaan "Endpoint belum tersedia" secara
anggun — screenshot tetap diambil apa adanya (tidak dipalsukan). Untuk figur final
yang berisi data, endpoint backend tersebut perlu diaktifkan lebih dulu.
