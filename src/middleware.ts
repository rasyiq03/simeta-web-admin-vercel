/**
 * SIMETA CMS — Next.js Middleware
 *
 * FIX F3-3 — CSP strict-dynamic + nonce per request.
 *
 * Sebelumnya `next.config.mjs` mengirim CSP statik dengan `'unsafe-inline'`
 * di `script-src`, yang berarti payload XSS apa pun yang lolos sanitasi akan
 * tetap bisa berjalan. Sekarang:
 *
 *   1. Middleware ini men-generate nonce base64 random per request.
 *   2. Nonce di-set ke request header `x-nonce`. Next.js otomatis menyuntik
 *      atribut `nonce="..."` ke setiap <script> internal-nya (RSC payload,
 *      _next/static, Inter font loader) saat header ini ada.
 *   3. CSP di response memakai `'nonce-<X>' 'strict-dynamic'` di script-src.
 *      Hanya skrip dengan nonce yang cocok yang boleh eksekusi; `strict-dynamic`
 *      mengizinkan skrip itu memuat skrip lain via DOM, sehingga toolchain
 *      Next.js tetap berfungsi tanpa harus whitelist tiap origin.
 *
 * Catatan:
 *   • Inline event handlers (`onclick="..."`) tetap diblokir — itu memang
 *     yang kita inginkan untuk mitigasi XSS.
 *   • styled-jsx Next masih butuh `'unsafe-inline'` di style-src; tidak ada
 *     equivalent nonce-style yang reliable di App Router saat ini.
 *   • Header statik (X-Frame-Options, Referrer-Policy, HSTS, dsb.) tetap
 *     di `next.config.mjs` — middleware ini hanya menambahkan CSP dinamis.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL
    ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
    : 'http://localhost:3001';

const isDev = process.env.NODE_ENV !== 'production';

export function middleware(request: NextRequest): NextResponse {
    // Web Crypto API — Edge Runtime tidak punya `crypto.randomUUID` Node;
    // Edge punya `crypto` global yang sama interface-nya. Kita pakai 18 byte
    // (24 char base64) — entropi sama dengan AES-128 nonce yang umum.
    const nonceBytes = new Uint8Array(18);
    crypto.getRandomValues(nonceBytes);
    const nonce = btoa(String.fromCharCode(...nonceBytes));

    // ─── CSP — script-src memakai nonce + strict-dynamic ─────────────────
    // 'strict-dynamic' membuat skrip ber-nonce dipercaya untuk memuat skrip
    // turunan tanpa harus whitelist origin tambahan. Karena strict-dynamic
    // mematikan whitelist host-based di script-src, kita JANGAN ikutkan
    // 'self' atau https: di sini — itu hanya dipakai sebagai fallback di
    // browser yang belum support strict-dynamic (CSP 3).
    const scriptSrc = [
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // Fallback untuk browser CSP 2 (tidak kenal strict-dynamic).
        // Browser CSP 3 akan mengabaikan token di bawah karena ada strict-dynamic.
        "'self'",
        'https:',
        ...(isDev ? ["'unsafe-eval'"] : []),
    ].join(' ');

    const csp = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        // styled-jsx Next masih butuh unsafe-inline di style-src
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        `connect-src 'self' ${API_ORIGIN}${isDev ? ' ws: wss:' : ''}`,
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        ...(isDev ? [] : ['upgrade-insecure-requests']),
    ]
        .filter(Boolean)
        .join('; ');

    // ─── Forward request headers ke server (RSC + route handlers) ─────────
    // Header `x-nonce` dibaca otomatis oleh Next.js untuk menyuntikkan ke
    // <script> internal-nya. Server Component juga bisa baca via:
    //   const nonce = (await headers()).get('x-nonce')
    // lalu meneruskannya ke <Script /> kustom.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    response.headers.set('Content-Security-Policy', csp);
    return response;
}

export const config = {
    /**
     * Lewatkan static assets supaya middleware tidak ikut jalan untuk file
     * yang tidak butuh CSP per-request (gambar, font, manifest). Penting
     * untuk performa — middleware dieksekusi pada setiap request yang
     * cocok, jadi makin sempit matcher makin baik.
     */
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
