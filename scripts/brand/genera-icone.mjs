#!/usr/bin/env node
/**
 * ONBOARDING-ACCESSO — le icone dell'app e il logo delle email, dai file del marchio (cartella del sito unnivai.com sulla
 * Scrivania, `UNNIVAI-Site-FINAL`, copiati in src/assets/brand/sorgenti/). Niente dipendenze: PNG letto e scritto con zlib
 * di Node, ricampionamento Lanczos-3 su colori premoltiplicati.
 *
 * Sorgenti → uscite:
 *   icon-512.png (512, RGB, fondo #06161E)  → public/icon-maskable-512.png e -192 (segno all'80%, dentro la zona sicura)
 *                                           → ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png (1024, RGB, senza alfa)
 *   favicon-64.png (64, RGBA)               → public/favicon-32.png, public/favicon.ico (16, 32, 48)
 *   logo-441x125.png (RGBA)                 → public/brand/logo-email.png (282×80: il logo delle email a 141×40, @2x)
 * public/apple-touch-icon.png (180), public/icon-192.png e public/icon-512.png sono i file del marchio copiati così come sono.
 *
 *   node scripts/brand/genera-icone.mjs              scrive i file
 *   node scripts/brand/genera-icone.mjs --controlla  rigenera in memoria e confronta (esce 1 se diversi)
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SORG = join(RADICE, 'src', 'assets', 'brand', 'sorgenti');
const PUB = join(RADICE, 'public');
export const ICONA_IOS = join(RADICE, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
export const FONDO = [0x06, 0x16, 0x1e]; // il fondo delle icone del marchio
export const LOGO_EMAIL = { w: 282, h: 80 };

// ─── PNG: lettura (8 bit, RGB o RGBA, non interlacciato) ──────────────────────────────────────────────────
export function leggiPng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('non è un PNG');
    let o = 8, w = 0, h = 0, tipo = 0;
    const idat = [];
    while (o < buf.length) {
        const len = buf.readUInt32BE(o); const t = buf.toString('ascii', o + 4, o + 8); const d = buf.subarray(o + 8, o + 8 + len);
        if (t === 'IHDR') {
            w = d.readUInt32BE(0); h = d.readUInt32BE(4); tipo = d[9];
            if (d[8] !== 8 || (tipo !== 2 && tipo !== 6) || d[12] !== 0) throw new Error('PNG non gestito (serve 8 bit, RGB/RGBA, non interlacciato)');
        } else if (t === 'IDAT') idat.push(d);
        else if (t === 'IEND') break;
        o += 12 + len;
    }
    const bpp = tipo === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const riga = w * bpp;
    const px = new Uint8Array(w * h * bpp);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (riga + 1)];
        const src = raw.subarray(y * (riga + 1) + 1, (y + 1) * (riga + 1));
        for (let x = 0; x < riga; x++) {
            const a = x >= bpp ? px[y * riga + x - bpp] : 0;
            const b = y > 0 ? px[(y - 1) * riga + x] : 0;
            const c = x >= bpp && y > 0 ? px[(y - 1) * riga + x - bpp] : 0;
            let v = src[x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            px[y * riga + x] = v & 0xff;
        }
    }
    // sempre RGBA, premoltiplicato in float
    const out = new Float64Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        const al = bpp === 4 ? px[i * 4 + 3] / 255 : 1;
        for (let k = 0; k < 3; k++) out[i * 4 + k] = px[i * bpp + k] * al;
        out[i * 4 + 3] = al * 255;
    }
    return { w, h, px: out };
}

// ─── Lanczos-3 separabile ────────────────────────────────────────────────────────────────────────────────
const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x) => (Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0);
function pesi(da, a) {
    const s = da / a, sup = 3 * Math.max(1, s), out = [];
    for (let i = 0; i < a; i++) {
        const c = (i + 0.5) * s - 0.5;
        const lo = Math.floor(c - sup), hi = Math.ceil(c + sup);
        const w = [];
        let t = 0;
        for (let j = lo; j <= hi; j++) { const v = lanczos((j - c) / Math.max(1, s)); w.push([Math.min(da - 1, Math.max(0, j)), v]); t += v; }
        out.push(w.map(([j, v]) => [j, v / t]));
    }
    return out;
}
export function ridimensiona(img, W, H) {
    const pw = pesi(img.w, W), ph = pesi(img.h, H);
    const tmp = new Float64Array(W * img.h * 4);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) {
        let v = 0; for (const [j, p] of pw[x]) v += img.px[(y * img.w + j) * 4 + k] * p; tmp[(y * W + x) * 4 + k] = v;
    }
    const out = new Float64Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) {
        let v = 0; for (const [j, p] of ph[y]) v += tmp[(j * W + x) * 4 + k] * p; out[(y * W + x) * 4 + k] = v;
    }
    return { w: W, h: H, px: out };
}
/** Un'immagine su un fondo pieno W×H, centrata, larga `lato` px. */
export function suFondo(img, W, H, lato, fondo = FONDO) {
    const r = ridimensiona(img, lato, Math.round(lato * img.h / img.w));
    const out = new Float64Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { out.set(fondo, i * 4); out[i * 4 + 3] = 255; }
    const ox = Math.round((W - r.w) / 2), oy = Math.round((H - r.h) / 2);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const s = (y * r.w + x) * 4, d = ((y + oy) * W + x + ox) * 4;
        const a = Math.min(1, Math.max(0, r.px[s + 3] / 255));
        for (let k = 0; k < 3; k++) out[d + k] = r.px[s + k] + out[d + k] * (1 - a);
    }
    return { w: W, h: H, px: out };
}

// ─── PNG: scrittura ──────────────────────────────────────────────────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pezzo = (tipo, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const tc = Buffer.concat([Buffer.from(tipo, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(tc)); return Buffer.concat([l, tc, c]); };
/** alfa: true = RGBA (favicon, logo delle email), false = RGB senza canale alfa (icone, iOS). */
export function scriviPng(img, alfa) {
    const bpp = alfa ? 4 : 3, riga = img.w * bpp;
    const raw = Buffer.alloc((riga + 1) * img.h);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const s = (y * img.w + x) * 4, a = Math.min(255, Math.max(0, img.px[s + 3]));
        for (let k = 0; k < 3; k++) {
            const v = alfa ? (a > 0 ? img.px[s + k] * 255 / a : 0) : img.px[s + k];
            raw[y * (riga + 1) + 1 + x * bpp + k] = Math.min(255, Math.max(0, Math.round(v)));
        }
        if (alfa) raw[y * (riga + 1) + 1 + x * 4 + 3] = Math.round(a);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = alfa ? 6 : 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pezzo('IHDR', ihdr), pezzo('IDAT', deflateSync(raw, { level: 9 })), pezzo('IEND', Buffer.alloc(0))]);
}
/** ICO con dentro i PNG (Vista e dopo, tutti i browser). */
export function scriviIco(pngs) {
    const testa = Buffer.alloc(6); testa.writeUInt16LE(1, 2); testa.writeUInt16LE(pngs.length, 4);
    let o = 6 + 16 * pngs.length;
    const voci = pngs.map(({ lato, dati }) => {
        const v = Buffer.alloc(16);
        v[0] = lato % 256; v[1] = lato % 256; v.writeUInt16LE(1, 4); v.writeUInt16LE(32, 6);
        v.writeUInt32LE(dati.length, 8); v.writeUInt32LE(o, 12); o += dati.length;
        return v;
    });
    return Buffer.concat([testa, ...voci, ...pngs.map((p) => p.dati)]);
}

export function genera() {
    const icona = leggiPng(readFileSync(join(SORG, 'icon-512.png')));
    const fav = leggiPng(readFileSync(join(SORG, 'favicon-64.png')));
    const logo = leggiPng(readFileSync(join(SORG, 'logo-441x125.png')));
    const favPng = (l) => scriviPng(ridimensiona(fav, l, l), true);
    return {
        [join(PUB, 'icon-maskable-512.png')]: scriviPng(suFondo(icona, 512, 512, 410), false),
        [join(PUB, 'icon-maskable-192.png')]: scriviPng(suFondo(icona, 192, 192, 154), false),
        [ICONA_IOS]: scriviPng(ridimensiona(icona, 1024, 1024), false),
        [join(PUB, 'favicon-32.png')]: favPng(32),
        [join(PUB, 'favicon.ico')]: scriviIco([16, 32, 48].map((l) => ({ lato: l, dati: favPng(l) }))),
        [join(PUB, 'brand', 'logo-email.png')]: scriviPng(ridimensiona(logo, LOGO_EMAIL.w, LOGO_EMAIL.h), true),
    };
}

const principale = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (principale) {
    const file = genera();
    if (process.argv.includes('--controlla')) {
        const diversi = Object.entries(file).filter(([f, d]) => { try { return !readFileSync(f).equals(d); } catch { return true; } }).map(([f]) => f);
        console.log(diversi.length ? `diversi dai file: ${diversi.join(', ')} (rilancia senza --controlla)` : 'icone: uguali ai file');
        process.exit(diversi.length ? 1 : 0);
    }
    for (const [f, d] of Object.entries(file)) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, d); console.log(`${f.replace(RADICE + '/', '')} (${d.length} byte)`); }
}
