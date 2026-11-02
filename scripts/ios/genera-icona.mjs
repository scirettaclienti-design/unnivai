#!/usr/bin/env node
/**
 * APP-NATIVA — icona dell'app (1024×1024) e schermata di avvio (2732×2732), PROPOSTA da far approvare a Ivano.
 *
 * Il segno è il segnaposto del logo di unnivai.com (pin con il cerchio vuoto e i quadratini che si staccano in alto
 * a destra), ridisegnato in vettoriale: il logo pubblicato è 441×125 e ingrandito si sgrana. Colori: fondo Ossidiana
 * #06161E, pin in sfumatura dall'arancione del marchio #FF6B3D (in basso a sinistra) all'ambra #FFA63D (in alto a
 * destra), come il logo.
 *
 * Niente dipendenze: forme calcolate punto per punto (4×4 campioni per pixel) e PNG scritto con zlib di Node.
 * PNG RGB a 8 bit, senza canale alfa: Apple vuole l'icona senza trasparenza.
 *
 *   node scripts/ios/genera-icona.mjs            → scrive i file in ios/App/App/Assets.xcassets
 *   node scripts/ios/genera-icona.mjs --controlla → rigenera in memoria e confronta con i file (esce 1 se diversi)
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(RADICE, 'ios', 'App', 'App', 'Assets.xcassets');
export const FILE_ICONA = join(ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png');
export const FILE_AVVIO = ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'].map((f) => join(ASSETS, 'Splash.imageset', f));

export const COLORI = Object.freeze({ fondo: [0x06, 0x16, 0x1e], arancione: [0xff, 0x6b, 0x3d], ambra: [0xff, 0xa6, 0x3d] });

// ─── il segno, nello spazio dell'icona (0..1024) ─────────────────────────────────────────────
const CX = 512, CY = 430, R = 250, PUNTA_Y = 870, BUCO = 100;
const D = PUNTA_Y - CY;
const Y_TANGENTE = CY + (R * R) / D;
const TAN = R / Math.sqrt(D * D - R * R);
const QUADRATINI = [
    [742, 212, 58], [812, 150, 40], [800, 270, 30], [872, 222, 24], [690, 128, 26], [905, 140, 16],
];

function nelPin(x, y) {
    const dx = x - CX, dy = y - CY;
    const r2 = dx * dx + dy * dy;
    if (r2 <= BUCO * BUCO) return false;
    if (r2 <= R * R) return true;
    if (y >= Y_TANGENTE && y <= PUNTA_Y) return Math.abs(dx) <= (PUNTA_Y - y) * TAN;
    return false;
}
function neiQuadratini(x, y) {
    for (const [qx, qy, lato] of QUADRATINI) {
        const m = lato / 2;
        if (x >= qx - m && x <= qx + m && y >= qy - m && y <= qy + m) return true;
    }
    return false;
}
const dentro = (x, y) => nelPin(x, y) || neiQuadratini(x, y);

// sfumatura lungo la diagonale: basso-sinistra → alto-destra
function coloreSegno(x, y) {
    const t = Math.min(1, Math.max(0, ((x - 240) + (900 - y)) / 1300));
    const a = COLORI.arancione, b = COLORI.ambra;
    return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

/**
 * @param {number} lato lato dell'immagine in pixel
 * @param {number} scala pixel dell'immagine per unità dell'icona (1 = icona, 0.5 = segno più piccolo al centro)
 */
export function disegna(lato, scala, campioni = 4) {
    const riga = lato * 3 + 1;
    const dati = Buffer.alloc(riga * lato);
    const [fr, fg, fb] = COLORI.fondo;
    const meta = lato / 2;
    const passo = 1 / campioni;
    for (let py = 0; py < lato; py++) {
        dati[py * riga] = 0; // filtro PNG «nessuno»
        const iy0 = (py - meta) / scala + 512;
        for (let px = 0; px < lato; px++) {
            const ix0 = (px - meta) / scala + 512;
            let coperti = 0;
            // salto veloce: lontano dal segno è tutto fondo
            if (ix0 < 230 || ix0 > 940 || iy0 < 100 || iy0 > 880) {
                coperti = 0;
            } else {
                for (let sy = 0; sy < campioni; sy++) {
                    for (let sx = 0; sx < campioni; sx++) {
                        if (dentro(ix0 + ((sx + 0.5) * passo) / scala, iy0 + ((sy + 0.5) * passo) / scala)) coperti++;
                    }
                }
            }
            const a = coperti / (campioni * campioni);
            const o = py * riga + 1 + px * 3;
            if (a === 0) { dati[o] = fr; dati[o + 1] = fg; dati[o + 2] = fb; continue; }
            const [cr, cg, cb] = coloreSegno(ix0, iy0);
            dati[o] = Math.round(fr + (cr - fr) * a);
            dati[o + 1] = Math.round(fg + (cg - fg) * a);
            dati[o + 2] = Math.round(fb + (cb - fb) * a);
        }
    }
    return png(lato, lato, dati);
}

// ─── PNG ────────────────────────────────────────────────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function pezzo(tipo, contenuto) {
    const lun = Buffer.alloc(4); lun.writeUInt32BE(contenuto.length);
    const tc = Buffer.concat([Buffer.from(tipo, 'ascii'), contenuto]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tc));
    return Buffer.concat([lun, tc, crc]);
}
function png(w, h, righe) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8 bit, RGB, niente alfa
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pezzo('IHDR', ihdr),
        pezzo('IDAT', deflateSync(righe, { level: 9 })),
        pezzo('IEND', Buffer.alloc(0)),
    ]);
}

// ─── main ───────────────────────────────────────────────────────────────────────────────────
const principale = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (principale) {
    const icona = disegna(1024, 1, 4);
    const avvio = disegna(2732, 0.5, 2);
    if (process.argv.includes('--controlla')) {
        const uguali = readFileSync(FILE_ICONA).equals(icona) && FILE_AVVIO.every((f) => readFileSync(f).equals(avvio));
        console.log(uguali ? 'icona e avvio: uguali ai file' : 'icona o avvio diversi dai file: rilancia senza --controlla');
        process.exit(uguali ? 0 : 1);
    }
    writeFileSync(FILE_ICONA, icona);
    for (const f of FILE_AVVIO) writeFileSync(f, avvio);
    console.log(`icona: ${FILE_ICONA} (${icona.length} byte)`);
    console.log(`avvio: ${FILE_AVVIO.length} file da 2732×2732 (${avvio.length} byte)`);
}
