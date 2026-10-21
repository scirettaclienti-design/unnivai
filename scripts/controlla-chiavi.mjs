#!/usr/bin/env node
/**
 * SICUREZZA-CHIAVI — nessuna chiave segreta nel repository né nel sito costruito.
 *
 * Uso:
 *   node scripts/controlla-chiavi.mjs            # i file tracciati da git
 *   node scripts/controlla-chiavi.mjs --dist     # la cartella dist/ (dopo `npm run build`)
 *   node scripts/controlla-chiavi.mjs --dir <d>  # una cartella qualunque (per le prove)
 *
 * Esce con 1 se trova qualcosa. Stampa SOLO file, riga e nome del tipo di chiave: mai il valore,
 * nemmeno in parte. Non fa rete e non legge variabili d'ambiente.
 *
 * Cosa cerca (la coda lunga evita i falsi allarmi sui nomi dei prefissi scritti nei documenti):
 *   sk-ant-…, sk-proj-…, sk-… lunghi (OpenAI/altri), sk_live_…, whsec_…, ghp_…, github_pat_…,
 *   e un JWT Supabase il cui ruolo è service_role (il nome da solo, in una policy SQL o in
 *   un'Edge Function, è legittimo). Nel sito costruito anche la parola service_role: il browser
 *   non deve mai nominarla.
 * Le chiavi pubbliche per natura (Supabase anon, Google Maps, Mapbox pk.) non vengono cercate.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const MODELLI = [
    ['anthropic (sk-ant-)', /sk-ant-[A-Za-z0-9_-]{20,}/g],
    ['openai progetto (sk-proj-)', /sk-proj-[A-Za-z0-9_-]{20,}/g],
    ['sk- lungo', /(?<![A-Za-z0-9_-])sk-(?:svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g],
    ['stripe (sk_live_)', /sk_live_[A-Za-z0-9]{16,}/g],
    ['stripe webhook (whsec_)', /whsec_[A-Za-z0-9]{16,}/g],
    ['github (ghp_)', /ghp_[A-Za-z0-9]{30,}/g],
    ['github (github_pat_)', /github_pat_[A-Za-z0-9_]{30,}/g],
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const SOLO_NEL_SITO = [['parola service_role', /service_role/g]];

const ESTENSIONI_BINARIE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.mov', '.gz', '.zip', '.wasm', '.glb', '.bin']);
const MAX_BYTE = 5 * 1024 * 1024;

function rigaDi(testo, indice) {
    let n = 1;
    for (let i = 0; i < indice; i++) if (testo.charCodeAt(i) === 10) n++;
    return n;
}

/** I ritrovamenti di un testo: [{ tipo, riga }]. Mai il valore. */
export function cercaNelTesto(testo, { sito = false } = {}) {
    const trovati = [];
    const modelli = sito ? [...MODELLI, ...SOLO_NEL_SITO] : MODELLI;
    for (const [tipo, re] of modelli) {
        for (const m of testo.matchAll(re)) trovati.push({ tipo, riga: rigaDi(testo, m.index) });
    }
    for (const m of testo.matchAll(JWT)) {
        try {
            const corpo = JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
            if (corpo?.role === 'service_role') trovati.push({ tipo: 'JWT Supabase service_role', riga: rigaDi(testo, m.index) });
        } catch { /* non è un JWT leggibile: non è una chiave Supabase */ }
    }
    return trovati;
}

function leggiTesto(file) {
    if (ESTENSIONI_BINARIE.has(path.extname(file).toLowerCase())) return null;
    let st;
    try { st = fs.statSync(file); } catch { return null; }
    if (!st.isFile() || st.size > MAX_BYTE) return null;
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) return null;
    return buf.toString('utf8');
}

function elencoTracciati() {
    const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
}

function elencoCartella(dir) {
    const out = [];
    const visita = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) visita(p); else out.push(p);
        }
    };
    visita(dir);
    return out;
}

/** Scansiona un elenco di file; restituisce [{ file, tipo, riga }]. */
export function scansiona(files, { sito = false } = {}) {
    const risultati = [];
    for (const file of files) {
        const testo = leggiTesto(file);
        if (testo === null) continue;
        for (const t of cercaNelTesto(testo, { sito })) risultati.push({ file, ...t });
    }
    return risultati;
}

function principale() {
    const args = process.argv.slice(2);
    const iDir = args.indexOf('--dir');
    let files; let sito; let etichetta;
    if (args.includes('--dist') || iDir >= 0) {
        const dir = iDir >= 0 ? args[iDir + 1] : 'dist';
        if (!dir || !fs.existsSync(dir)) { console.error(`controlla-chiavi: la cartella «${dir}» non esiste (serve prima la build).`); process.exit(2); }
        files = elencoCartella(dir); sito = args.includes('--dist'); etichetta = `cartella ${dir}`;
    } else {
        files = elencoTracciati(); sito = false; etichetta = 'file tracciati da git';
    }
    const trovati = scansiona(files, { sito });
    if (trovati.length === 0) {
        console.log(`controlla-chiavi: nessuna chiave segreta nei ${etichetta} (${files.length} file letti).`);
        return;
    }
    console.error(`controlla-chiavi: ROSSO — ${trovati.length} chiave/i segreta/e nei ${etichetta}. Valori non stampati.`);
    for (const t of trovati) console.error(`  ${t.file}:${t.riga}  ${t.tipo}`);
    console.error('Togli la chiave dal file, ruotala dove è stata emessa, e tienila solo nei segreti del server (Supabase, Vercel).');
    process.exit(1);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principale();
