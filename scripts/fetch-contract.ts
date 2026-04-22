/**
 * SIMETA Fetch Contract Script
 * Downloads the latest OpenAPI JSON from the backend server.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

const CONTRACT_URL = process.env.BACKEND_OPENAPI_URL || 'http://localhost:3000/api-json';
const OUTPUT_PATH = path.resolve(__dirname, '../src/contracts/openapi.v1.json');

async function fetchContract() {
    console.log(`🌐 Mengunduh kontrak dari: ${CONTRACT_URL}...`);

    const protocol = CONTRACT_URL.startsWith('https') ? https : http;

    protocol.get(CONTRACT_URL, (res) => {
        if (res.statusCode !== 200) {
            console.error(`❌ Gagal mengunduh: Status Code ${res.statusCode}`);
            process.exit(1);
        }

        const fileStream = fs.createWriteStream(OUTPUT_PATH);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`✅ Kontrak berhasil disimpan ke: ${OUTPUT_PATH}`);
        });
    }).on('error', (err) => {
        console.error(`❌ Error koneksi: ${err.message}`);
        console.info('👉 Pastikan backend sudah menyala atau URL sudah benar.');
        process.exit(1);
    });
}

fetchContract();
