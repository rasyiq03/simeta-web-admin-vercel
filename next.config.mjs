/** @type {import('next').NextConfig} */

/**
 * FIX F3-3 (follow-up M4) — CSP DIPINDAH ke src/middleware.ts agar bisa
 * memakai nonce per-request + 'strict-dynamic'. File ini hanya mengatur
 * header statik (anti-clickjacking, HSTS, MIME, dll) yang tidak butuh
 * per-request state.
 *
 * Pembagian tanggung jawab:
 *   • middleware.ts   → Content-Security-Policy (nonce + strict-dynamic)
 *   • next.config.mjs → semua header statik defense-in-depth
 */

const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
    // Anti-clickjacking — dipertahankan walau frame-ancestors 'none' di CSP
    // sudah lebih kuat, karena X-Frame-Options dipahami oleh browser legacy
    // yang belum support CSP frame-ancestors.
    { key: 'X-Frame-Options', value: 'DENY' },
    // Browser tidak mengirim path/query saat user pindah ke origin lain.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Cegah MIME-sniffing payload eksekusi.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // HSTS — hanya di production karena dev sering http://localhost.
    ...(isDev
        ? []
        : [
              {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
              },
          ]),
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
];

const nextConfig = {
    reactCompiler: true,

    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
