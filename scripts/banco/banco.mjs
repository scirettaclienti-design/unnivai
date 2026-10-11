#!/usr/bin/env node
// BANCO-NAZ — il comando unico del banco nazionale dei tour.
//
//   npm run banco                         tutti i casi, poi il report
//   BANCO_CASI=a-roma,c-roma npm run banco   solo quei casi
//   npm run banco -- --report <file.json>   solo il report da un giro gia' fatto
//
// Scrive docs/prove/dati/AAAA-MM-GG-banco.json (grezzo) e
// docs/prove/AAAA-MM-GG-banco.md (report); se il giorno ha gia' un banco, il
// nuovo prende un suffisso (-2, -3…), cosi' il prima/dopo di una modifica resta.
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildReport } from './report.js';

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, 'scripts/banco/banco.config.json'), 'utf8'));
const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: root }).toString().trim(); } catch { return null; } };
const commit = `${git('rev-parse --short HEAD') || '?'}${git('status --porcelain -- src') ? ' (con modifiche locali in src/)' : ''}`;

const argReport = process.argv.indexOf('--report');
let jsonPath, nome;
if (argReport > -1) {
    jsonPath = path.resolve(process.argv[argReport + 1]);
    nome = path.basename(jsonPath, '.json');
} else {
    nome = `${oggi}-banco`;
    for (let i = 2; existsSync(path.join(root, 'docs/prove', `${nome}.md`)); i++) nome = `${oggi}-banco-${i}`;
    jsonPath = path.join(root, 'docs/prove/dati', `${nome}.json`);
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.banco.config.js'], {
        cwd: root, stdio: 'inherit', env: { ...process.env, BANCO_OUT: jsonPath },
    });
    if (!existsSync(jsonPath)) { console.error('[banco] nessun risultato scritto: niente report.'); process.exit(r.status || 1); }
}

const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
const { markdown, righe } = buildReport(raw, config, { data: nome.slice(0, 10), commit });
const mdPath = path.join(root, 'docs/prove', `${nome}.md`);
mkdirSync(path.dirname(mdPath), { recursive: true });
writeFileSync(mdPath, markdown + '\n');
const rossi = righe.reduce((a, r) => a + Object.values(r.sem || {}).filter(s => s === 'rosso').length, 0);
console.log(`[banco] report: ${path.relative(root, mdPath)} | grezzo: ${path.relative(root, jsonPath)} | voci rosse: ${rossi}`);
