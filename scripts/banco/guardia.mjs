#!/usr/bin/env node
// TROINA-FIX — la GUARDIA DELLA HOME: «ogni flusso della home da' almeno un tour con posti veri», a Troina (borgo) e a
// Catania (citta'): Per Te, Quiz Natura (parchi) e Storia (luoghi storici), Su misura per te Natura e Arte (Sorprendimi),
// Crea il tuo Percorso. I casi: scripts/banco/casi-home.js. Il controllo: scripts/banco/guardia-home.js.
//
//   npm run banco:guardia                      replay dei tracciati salvati (0 $, nessuna rete): da lanciare prima di ogni merge
//   npm run banco:guardia -- --tracciati <f>   replay di altri tracciati
//   npm run banco:guardia -- --registra        il giro PAGATO con l'account di prova: rifa' i tracciati (dopo una modifica che
//                                              cambia le richieste ai proxy, quando il replay segna uscite in rete)
//
// Esce con 1 se un flusso non ha posti veri, se il replay prova a uscire in rete o se un caso manca.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASI_HOME, GIORNO_GUARDIA } from './casi-home.js';
import { CASI_BORGO } from './casi-borgo.js';
import { controllaGuardia, tabellaGuardia } from './guardia-home.js';
import { controllaPertinenzaDi, tabellaPertinenza, rosseNuove } from './pertinenza.js';

const root = process.cwd();
const args = process.argv.slice(2);
const opt = (nome) => { const i = args.indexOf(nome); return i > -1 ? args[i + 1] : null; };
const DATI = path.join(root, 'docs/prove/dati');
const GREZZO_GIRO = path.join(DATI, 'guardia-home.json');
const TRACCIATI = opt('--tracciati') ? path.resolve(opt('--tracciati')) : path.join(DATI, 'guardia-home-tracciati.json.gz');
// GUARDIA-PERTINENZA — i tracciati dei 6 casi del borgo (il giro di BORGO-DIAGNOSI del 21/10)
export const TRACCIATI_BORGO_DEFAULT = 'docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz';
const TRACCIATI_BORGO = opt('--tracciati-borgo') ? path.resolve(opt('--tracciati-borgo')) : path.join(root, TRACCIATI_BORGO_DEFAULT);
const NOTI = path.join(root, 'scripts/banco/pertinenza-noti.json');
const ids = CASI_HOME.map(c => c.id).join(',');

/** Il replay di un tracciato per i casi dati: il grezzo del replay (0 $, nessuna rete). */
function rigioca(tracciati, casi, etichetta) {
    if (!existsSync(tracciati)) { console.error(`[guardia] mancano i tracciati ${etichetta} (${path.relative(root, tracciati)})`); return null; }
    const out = path.join(mkdtempSync(path.join(os.tmpdir(), 'guardia-')), `${etichetta}-replay.json`);
    spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], {
        cwd: root, stdio: process.env.GUARDIA_LOG ? 'inherit' : 'ignore',
        env: { ...process.env, REPLAY_IN: tracciati, REPLAY_OUT: out, REPLAY_CASI: casi },
    });
    if (!existsSync(out)) { console.error(`[guardia] il replay ${etichetta} non ha scritto il risultato (GUARDIA_LOG=1 per il log)`); return null; }
    console.log(`[guardia] replay di ${path.relative(root, tracciati)} (0 $, nessuna rete) — risultato: ${out}`);
    return JSON.parse(readFileSync(out, 'utf8'));
}

let grezzo;
if (args.includes('--registra')) {
    // il giro vero: banco esteso coi soli casi della guardia, sul giorno della guardia (le liste di quel giorno sono gia' sul server)
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.esteso.config.js'], {
        cwd: root, stdio: 'inherit',
        env: { ...process.env, BANCO_OUT: GREZZO_GIRO, BANCO_TRACCIATI: TRACCIATI, BANCO_CASI: ids, BANCO_GIORNO: GIORNO_GUARDIA,
            BANCO_PLACES: process.env.BANCO_PLACES || 'new', BANCO_LISTE_PRONTE: '1', BANCO_TETTO: process.env.BANCO_TETTO || '2.7' },
    });
    if (!existsSync(GREZZO_GIRO)) { console.error('[guardia] il giro non ha scritto il grezzo'); process.exit(r.status || 1); }
    grezzo = JSON.parse(readFileSync(GREZZO_GIRO, 'utf8'));
    console.log(`[guardia] giro registrato: ${path.relative(root, GREZZO_GIRO)} e ${path.relative(root, TRACCIATI)} — spesa $${(grezzo.costo?.totale ?? 0).toFixed(3)} (listino del banco)`);
} else {
    if (!existsSync(TRACCIATI)) {
        console.error(`[guardia] mancano i tracciati (${path.relative(root, TRACCIATI)}): registrali una volta con \`npm run banco:guardia -- --registra\` (pagato)`);
        process.exit(2);
    }
    grezzo = rigioca(TRACCIATI, ids, 'guardia');
    if (!grezzo) process.exit(1);
}

const esito = controllaGuardia(grezzo, { attesi: CASI_HOME });
console.log(tabellaGuardia(esito));

// GUARDIA-PERTINENZA — i 5 controlli sui casi del borgo (dai loro tracciati, sempre in replay) e sui casi della guardia
const borgo = rigioca(TRACCIATI_BORGO, CASI_BORGO.map(c => c.id).join(','), 'borgo');
const casiPertinenza = [...(borgo?.casi || []), ...(grezzo.casi || [])];
const attesi = [...CASI_BORGO.map(c => c.id), ...CASI_HOME.map(c => c.id)];
const perId = new Map(casiPertinenza.map(c => [c.id, c]));
const righe = controllaPertinenzaDi(attesi.map(id => perId.get(id) || { id, errore: borgo ? 'caso assente nel replay' : 'tracciati del borgo mancanti' }));
const noti = existsSync(NOTI) ? JSON.parse(readFileSync(NOTI, 'utf8')) : [];
console.log(tabellaPertinenza(righe, { noti }));
const nuove = rosseNuove(righe, noti);
if (process.env.GUARDIA_PERTINENZA_OUT) writeFileSync(process.env.GUARDIA_PERTINENZA_OUT, JSON.stringify({ righe, noti, nuove, grezzi: { guardia: grezzo, borgo } }, null, 1));
if (nuove.length) console.error(`[guardia] ❌ NUOVI di pertinenza (non in ${path.relative(root, NOTI)}): ${nuove.join(', ')}`);
process.exit(esito.ok && nuove.length === 0 ? 0 : 1);
