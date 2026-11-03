#!/usr/bin/env node
// BANCO-40 — il banco dei 40 casi fissi (`npm run banco`): i 18 di sempre + 22 che coprono la griglia (casi-banco40.js).
// Cinque controlli per caso (controlli40.js): tappe aperte all'ora del giro, distanze plausibili per il mezzo, nessun luogo di un'altra
// città, titolo coerente con le tappe, nessuna frase ripetuta.
//
//   npm run banco                         il giro VERO (account di prova, a pagamento): 40 casi, tracciati, esiti, tabella
//   npm run banco -- --replay             la RIPRODUZIONE a 0 $ dai tracciati salvati; confronta con gli esiti del giro vero (esce 1 se differiscono)
//   npm run banco -- --report             la tabella dagli esiti salvati
//   npm run banco -- --da <grezzo.json> [<altro.json> …]   gli esiti da uno o più grezzi di un giro già fatto (unisce i giri, scrive i file del repo)
//   npm run banco -- --mancanti           il giro vero dei soli casi saltati dal tetto in un giro precedente (si uniscono agli esiti salvati)
//   BANCO_CASI=a-roma,… per un sottoinsieme · BANCO_TETTO=7.8 il tetto di spesa del giro vero (token + Google a listino, cache del proxy esclusa)
//
// File nel repo: docs/prove/dati/banco-40-tracciati.json.gz (risposte dei proxy, per la riproduzione), docs/prove/dati/banco-40-esiti.json (esiti
// compatti e orari di Google), docs/prove/dati/banco-40-tabella.md (la tabella). Il grezzo completo di un giro vero va in una cartella temporanea.
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { CASI_BANCO40, GIORNO_BANCO40, FUSO_BANCO40 } from './casi-banco40.js';
import { esitoDi, confrontaEsiti, tabellaMd, riepilogo, difettiMd } from './esiti40.js';

const root = process.cwd();
const args = process.argv.slice(2);
const DATI = path.join(root, 'docs/prove/dati');
export const FILE_TRACCIATI = path.join(DATI, 'banco-40-tracciati.json.gz');
export const FILE_ESITI = path.join(DATI, 'banco-40-esiti.json');
const FILE_TABELLA = path.join(DATI, 'banco-40-tabella.md');
const config = JSON.parse(readFileSync(path.join(root, 'scripts/banco/banco.config.json'), 'utf8'));
const meta = new Map(CASI_BANCO40.map(c => [c.id, c]));
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: root }).toString().trim(); } catch { return null; } };

/** Gli esiti (nell'ordine dei 40 casi) da uno o più grezzi: il primo che ha il caso vince, gli orari vengono dal giro vero. */
function esitiDaGrezzi(grezzi, orariDi = null) {
    const perId = new Map();
    for (const g of grezzi) for (const c of g.casi || []) if (!perId.has(c.id) || (perId.get(c.id).saltato && !c.saltato)) perId.set(c.id, c);
    return CASI_BANCO40.map(m => {
        const c = perId.get(m.id);
        if (!c) return esitoDi({ id: m.id, modo: m.modo, luogo: m.luogo, ora: m.ora, saltato: 'non girato in questo giro' }, m, config);
        const e = esitoDi(c, m, config, orariDi?.[m.id] ?? null);
        // un caso del giro vero senza orari nel grezzo (giro interrotto prima del passo finale): gli orari vengono dal replay dei suoi tracciati
        if (!c.orari && orariDi?.[m.id]) e.orariDa = 'replay dei tracciati';
        return e;
    });
}

function scrivi(esiti, info) {
    mkdirSync(DATI, { recursive: true });
    writeFileSync(FILE_ESITI, JSON.stringify({ formato: 1, ...info, riepilogo: riepilogo(esiti), casi: esiti }));
    writeFileSync(FILE_TABELLA, `${tabellaMd(esiti)}\n\n## Difetti trovati\n\n${difettiMd(esiti) || '(nessuno)'}\n`);
}

function stampa(esiti, titolo) {
    const r = riepilogo(esiti);
    console.log(`[banco] ${titolo}: ${r.ok}/${r.totale} casi passano tutti i controlli · ${r.ko} con difetti · ${r.errore} senza giro · ${r.saltato} saltati`);
    for (const [k, v] of Object.entries(r.falliti)) console.log(`  ${v.casi.length ? '❌' : '✅'} ${v.nome}: ${v.casi.length ? v.casi.join(', ') : 'tutti i casi'}`);
}

const leggiEsiti = () => {
    if (!existsSync(FILE_ESITI)) { console.error(`[banco] mancano gli esiti (${path.relative(root, FILE_ESITI)}): fai un giro vero con \`npm run banco\``); process.exit(2); }
    return JSON.parse(readFileSync(FILE_ESITI, 'utf8'));
};

if (args.includes('--report')) {
    const e = leggiEsiti();
    console.log(tabellaMd(e.casi));
    stampa(e.casi, 'esiti salvati');
    process.exit(0);
}

if (args.includes('--da')) {
    const files = args.slice(args.indexOf('--da') + 1).filter((a, i, v) => a.endsWith('.json') && !v.slice(0, i).some(x => x === '--tracciati' || x === '--orari-da'));
    const grezzi = files.map(f => JSON.parse(readFileSync(path.resolve(f), 'utf8')));
    const iO = args.indexOf('--orari-da');
    const orariDi = iO > -1 ? Object.fromEntries(args.slice(iO + 1).filter(a => a.endsWith('.json')).flatMap(f => (JSON.parse(readFileSync(path.resolve(f), 'utf8')).casi || []).map(c => [c.id, c.orari]))) : null;
    const esiti = esitiDaGrezzi(grezzi, orariDi);
    const costo = grezzi.map(g => g.costo).filter(Boolean);
    // i tracciati dei giri uniti: `--tracciati a.gz b.gz` (un caso rigirato prende l'ultimo)
    const iT = args.indexOf('--tracciati');
    if (iT > -1) {
        const fT = args.slice(iT + 1).filter(a => !a.startsWith('--') && a.endsWith('.gz'));
        const tr = fT.map(f => JSON.parse(gunzipSync(readFileSync(path.resolve(f))).toString('utf8')));
        const perId = new Map();
        for (const t of tr) for (const c of t.casi) perId.set(c.id, c);
        const unito = { ...tr[0], casi: CASI_BANCO40.map(c => perId.get(c.id)).filter(Boolean) };
        writeFileSync(FILE_TRACCIATI, gzipSync(JSON.stringify(unito)));
        console.log(`[banco] tracciati uniti: ${unito.casi.length} casi → ${path.relative(root, FILE_TRACCIATI)}`);
    }
    scrivi(esiti, { registrato: grezzi[0]?.avvio ?? null, commit: git('rev-parse --short HEAD'), giorno: GIORNO_BANCO40, fuso: FUSO_BANCO40, costi: costo });
    stampa(esiti, 'esiti dai grezzi');
    process.exit(0);
}

if (args.includes('--replay')) {
    if (!existsSync(FILE_TRACCIATI)) { console.error(`[banco] mancano i tracciati (${path.relative(root, FILE_TRACCIATI)})`); process.exit(2); }
    const salvati = leggiEsiti();
    const scelti = (process.env.BANCO_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
    const out = path.join(mkdtempSync(path.join(os.tmpdir(), 'banco40-')), 'replay.json');
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], {
        cwd: root, stdio: process.env.BANCO_LOG ? 'inherit' : 'ignore',
        env: { ...process.env, REPLAY_IN: FILE_TRACCIATI, REPLAY_OUT: out, ...(scelti.length ? { REPLAY_CASI: scelti.join(',') } : {}) },
    });
    if (!existsSync(out)) { console.error('[banco] il replay non ha scritto il risultato (BANCO_LOG=1 per il log)'); process.exit(r.status || 1); }
    const replay = JSON.parse(readFileSync(out, 'utf8'));
    const esiti = esitiDaGrezzi([replay]).filter(e => !scelti.length || scelti.includes(e.id));
    const uscite = replay.casi.reduce((n, c) => n + (c.replay?.uscite?.length || 0), 0);
    const veri = salvati.casi.filter(e => e.stato !== 'saltato' && (!scelti.length || scelti.includes(e.id)));
    const conf = confrontaEsiti(veri, esiti);
    const diversi = conf.filter(c => !c.uguale);
    console.log(`[banco] riproduzione a 0 $ (nessuna rete, ${replay.casi.length} casi): ${conf.length - diversi.length}/${conf.length} uguali al giro vero, ${uscite} uscite in rete`);
    for (const d of diversi) console.log(`  ❌ ${d.id}: ${d.perche}`);
    stampa(esiti, 'esiti della riproduzione');
    process.exit(diversi.length || uscite ? 1 : 0);
}

// ─── Il giro vero ────────────────────────────────────────────────────────────────────────────────────────────────────
// --mancanti: solo i casi che il giro precedente ha saltato (tetto di spesa) o che non sono mai stati girati
const mancanti = args.includes('--mancanti') ? (leggiEsiti().casi.filter(e => e.stato === 'saltato').map(e => e.id)) : [];
const scelti = mancanti.length ? mancanti : (process.env.BANCO_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
const ids = (scelti.length ? scelti : CASI_BANCO40.map(c => c.id)).join(',');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'banco40-giro-'));
const grezzoPath = path.join(tmp, 'grezzo.json');
const tracciatiPath = path.join(tmp, 'tracciati.json.gz');
const tetto = process.env.BANCO_TETTO || '7.8';
console.log(`[banco] giro VERO a pagamento: ${ids.split(',').length} casi, tetto $${tetto} (token + Google a listino, cache del proxy esclusa), giorno ${GIORNO_BANCO40}`);
const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.esteso.config.js'], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, BANCO_OUT: grezzoPath, BANCO_TRACCIATI: tracciatiPath, BANCO_CASI: ids, BANCO_ORDINE: '1', BANCO_SOLO_MISS: '1', BANCO_GIORNO: GIORNO_BANCO40,
        BANCO_FUSO: FUSO_BANCO40, BANCO_PLACES: 'new', BANCO_TETTO_GEN: tetto, BANCO_TETTO_TOT: String(Number(tetto) + 0.2) },
});
if (!existsSync(grezzoPath)) { console.error('[banco] nessun risultato scritto'); process.exit(r.status || 1); }
const grezzo = JSON.parse(readFileSync(grezzoPath, 'utf8'));
const nuovi = esitiDaGrezzi([grezzo]);
// I casi di questo giro si uniscono a quelli già salvati: un caso girato (ok, ko o errore) sostituisce il vecchio, un caso saltato lo lascia com'è.
// Così un giro interrotto dal tetto si completa con un secondo giro sui soli casi mancanti (BANCO_CASI=…).
const vecchi = existsSync(FILE_ESITI) ? JSON.parse(readFileSync(FILE_ESITI, 'utf8')) : null;
const esiti = CASI_BANCO40.map((m) => {
    const n = nuovi.find(e => e.id === m.id);
    const o = vecchi?.casi?.find(e => e.id === m.id);
    return n && n.stato !== 'saltato' ? n : (o && o.stato !== 'saltato' ? o : n);
});
mkdirSync(DATI, { recursive: true });
if (existsSync(tracciatiPath)) {
    const nuoviT = JSON.parse(gunzipSync(readFileSync(tracciatiPath)).toString('utf8'));
    const vecchiT = existsSync(FILE_TRACCIATI) ? JSON.parse(gunzipSync(readFileSync(FILE_TRACCIATI)).toString('utf8')) : null;
    const perId = new Map([...(vecchiT?.casi || []), ...nuoviT.casi].map(c => [c.id, c]));
    writeFileSync(FILE_TRACCIATI, gzipSync(JSON.stringify({ ...(vecchiT || nuoviT), casi: CASI_BANCO40.map(c => perId.get(c.id)).filter(Boolean) })));
}
scrivi(esiti, { registrato: vecchi?.registrato ?? grezzo.avvio, commit: git('rev-parse --short HEAD'), giorno: GIORNO_BANCO40, fuso: FUSO_BANCO40, costi: [...(vecchi?.costi || []), grezzo.costo].filter(Boolean) });
console.log(`[banco] grezzo completo: ${grezzoPath} (non va nel repo) · tracciati: ${path.relative(root, FILE_TRACCIATI)} · esiti: ${path.relative(root, FILE_ESITI)}`);
stampa(esiti, 'giro vero');
process.exit(0);
