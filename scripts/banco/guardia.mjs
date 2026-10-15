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
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASI_HOME, GIORNO_GUARDIA } from './casi-home.js';
import { controllaGuardia, tabellaGuardia } from './guardia-home.js';

const root = process.cwd();
const args = process.argv.slice(2);
const opt = (nome) => { const i = args.indexOf(nome); return i > -1 ? args[i + 1] : null; };
const DATI = path.join(root, 'docs/prove/dati');
const GREZZO_GIRO = path.join(DATI, 'guardia-home.json');
const TRACCIATI = opt('--tracciati') ? path.resolve(opt('--tracciati')) : path.join(DATI, 'guardia-home-tracciati.json.gz');
const ids = CASI_HOME.map(c => c.id).join(',');

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
    const out = path.join(mkdtempSync(path.join(os.tmpdir(), 'guardia-')), 'guardia-replay.json');
    spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], {
        cwd: root, stdio: process.env.GUARDIA_LOG ? 'inherit' : 'ignore',
        env: { ...process.env, REPLAY_IN: TRACCIATI, REPLAY_OUT: out, REPLAY_CASI: ids },
    });
    if (!existsSync(out)) { console.error('[guardia] il replay non ha scritto il risultato (GUARDIA_LOG=1 per il log)'); process.exit(1); }
    grezzo = JSON.parse(readFileSync(out, 'utf8'));
    console.log(`[guardia] replay di ${path.relative(root, TRACCIATI)} (0 $, nessuna rete) — risultato: ${out}`);
}

const esito = controllaGuardia(grezzo, { attesi: CASI_HOME });
console.log(tabellaGuardia(esito));
process.exit(esito.ok ? 0 : 1);
