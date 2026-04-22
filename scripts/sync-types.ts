/**
 * SIMETA Sync Types Script
 * Auto-generate TypeScript types from local Frontend OpenAPI Contract.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const INTERNAL_CONTRACT = path.resolve(__dirname, '../src/contracts/openapi.v1.json');
const FRONTEND_TYPES_DIR = path.resolve(__dirname, '../src/types');
const OUTPUT_FILE = path.join(FRONTEND_TYPES_DIR, 'api-generated.ts');

async function syncTypes() {
    console.log('🔄 Memulai sinkronisasi tipe data dari internal contract...');

    // 1. Cek existence contract internal
    if (!fs.existsSync(INTERNAL_CONTRACT)) {
        console.error(`❌ Error: Contract internal tidak ditemukan di: ${INTERNAL_CONTRACT}`);
        console.info('👉 Jalankan "npm run contract:fetch" atau copy manual ke src/contracts/.');
        process.exit(1);
    }

    // 2. Buat folder types jika belum ada
    if (!fs.existsSync(FRONTEND_TYPES_DIR)) {
        fs.mkdirSync(FRONTEND_TYPES_DIR, { recursive: true });
    }

    try {
        // 3. Jalankan npx openapi-typescript
        console.log('📦 Menjalankan openapi-typescript...');
        execSync(`npx openapi-typescript "${INTERNAL_CONTRACT}" -o "${OUTPUT_FILE}"`, { stdio: 'inherit' });

        console.log(`✅ Sukses! Tipe data digenerate ke: ${OUTPUT_FILE}`);
        console.log(`⏱️ Selesai pada: ${new Date().toLocaleString()}`);
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat generate types:', error);
        process.exit(1);
    }
}

syncTypes();
