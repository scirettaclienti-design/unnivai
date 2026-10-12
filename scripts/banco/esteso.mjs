#!/usr/bin/env node
// BANCO-ESTESO — il comando unico: genera la matrice, rilancia ONB-1 (classe 9),
// applica i controlli e scrive il report.
//
//   npm run banco:esteso                       tutti i casi, poi ONB-1, poi il report
//   BANCO_CASI=veloce-catania-relax-2125 npm run banco:esteso
//   npm run banco:esteso -- --report <file.json>   solo il report da un giro gia' fatto
//
// Scrive docs/prove/dati/AAAA-MM-GG-banco-esteso.json (grezzo, con il pool di ogni
// momento) e docs/prove/AAAA-MM-GG-banco-esteso.md. Se esiste
// docs/prove/dati/<nome>-note.md lo accoda al report (appendici scritte a mano).
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReportEsteso } from './report-esteso.js';
import { confrontoPlaces } from './confronto-places.js';

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, 'scripts/banco/banco.config.json'), 'utf8'));
const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: root }).toString().trim(); } catch { return null; } };
const commit = `${git('rev-parse --short HEAD') || '?'}${git('status --porcelain -- src') ? ' (con modifiche locali in src/)' : ''}`;

const NUOVA = process.env.BANCO_PLACES === 'new';
const argReport = process.argv.indexOf('--report');
let jsonPath, nome;
if (argReport > -1) {
    jsonPath = path.resolve(process.argv[argReport + 1]);
    nome = path.basename(jsonPath, '.json');
} else {
    // MIG-PLACES — BANCO_PLACES=new: stessi casi con la ricerca nuova (solo l'account di prova), file `-new`.
    const suffisso = NUOVA ? '-new' : '';
    nome = `${oggi}-banco-esteso${suffisso}`;
    for (let i = 2; existsSync(path.join(root, 'docs/prove/dati', `${nome}.json`)); i++) nome = `${oggi}-banco-esteso${suffisso}-${i}`;
    jsonPath = path.join(root, 'docs/prove/dati', `${nome}.json`);
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.esteso.config.js'], {
        cwd: root, stdio: 'inherit', env: { ...process.env, BANCO_OUT: jsonPath },
    });
    if (!existsSync(jsonPath)) { console.error('[banco-esteso] nessun risultato scritto: niente report.'); process.exit(r.status || 1); }
    // Classe 9 — ONB-1 (login → logout → login su browser vuoto → modifica interessi). Costo 0. Non si rifa' nel giro `new`.
    if (!NUOVA) {
    const onbOut = path.join(os.tmpdir(), `onb1-${Date.now()}.json`);
    spawnSync('npx', ['vitest', 'run', '-c', 'scripts/prova-reale/vitest.prova.config.js', 'scripts/prova-reale/onb1.live.js'], {
        cwd: root, stdio: 'inherit', env: { ...process.env, PROVA_OUT: onbOut },
    });
    const raw0 = JSON.parse(readFileSync(jsonPath, 'utf8'));
    raw0.onb1 = existsSync(onbOut) ? JSON.parse(readFileSync(onbOut, 'utf8')) : null;
    writeFileSync(jsonPath, JSON.stringify(raw0, null, 1));
    }
}

const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (raw.motore === 'new') {
    // MIG-PLACES — niente report del banco: il confronto con il giro legacy.
    const legacyPath = path.join(root, config.esteso.baselineLegacy);
    const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));
    const nomeDoc = `${nome.slice(0, 10)}-mig-places`;
    const nPath = path.join(root, 'docs/prove/dati', `${nomeDoc}-note.md`);
    const { markdown: md, peggiorate } = confrontoPlaces(legacy, raw, config, { legacyNome: path.basename(legacyPath), nuovoNome: path.basename(jsonPath), commit });
    const out = md + (existsSync(nPath) ? '\n' + readFileSync(nPath, 'utf8') : '');
    writeFileSync(path.join(root, 'docs/prove', `${nomeDoc}.md`), out + '\n');
    console.log(`[banco-esteso] confronto: docs/prove/${nomeDoc}.md | grezzo: ${path.relative(root, jsonPath)} | voci peggiorate oltre la varianza: ${peggiorate}`);
    process.exit(0);
}
const notePath = path.join(root, 'docs/prove/dati', `${nome}-note.md`);
const { markdown, analisi } = buildReportEsteso(raw, config, { data: nome.slice(0, 10), commit, note: existsSync(notePath) ? readFileSync(notePath, 'utf8') : null });
const mdPath = path.join(root, 'docs/prove', `${nome}.md`);
mkdirSync(path.dirname(mdPath), { recursive: true });
writeFileSync(mdPath, markdown + '\n');
const tot = analisi.perClasse.reduce((a, c) => a + c.violazioni, 0);
console.log(`[banco-esteso] report: ${path.relative(root, mdPath)} | grezzo: ${path.relative(root, jsonPath)} | violazioni: ${tot}`);
