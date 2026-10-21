#!/usr/bin/env node
// DIAGNOSI-NOTTE — difetto 1 col motore VERO (replay, 0 $, nessuna rete): il Quiz Natura e Sorprendimi Natura di Troina alle
// 23:30, 00:30, 02:00, 04:30, 05:30, rigiocati dai tracciati del giro R2 di BORGO-COMPLETO (docs/prove/dati/2026-10-16-borgo-fix-2-tracciati).
// Le ore dopo mezzanotte si simulano sul giorno 15/10 (la notte fra il 14 e il 15), cosi' la lista della citta' e' quella registrata.
//   node scripts/diagnosi-notte/replay-notte.mjs [--out <cartella>]
// Esce con 1 se il comportamento giusto non c'e' (su main: 1).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/prove/dati');
mkdirSync(outDir, { recursive: true });
const SRC = 'docs/prove/dati/2026-10-16-borgo-fix-2-tracciati.json.gz';
const t = JSON.parse(gunzipSync(readFileSync(SRC)).toString('utf8'));
const base = Object.fromEntries(t.casi.map(c => [c.id, c]));
const FLUSSI = { quiz: 'borgo-b-quiz-natura', sorprendimi: 'borgo-b-sorpresa-natura' };
const ORE = ['23:30', '00:30', '02:00', '04:30', '05:30'];

t.casi = [];
for (const [flusso, id] of Object.entries(FLUSSI)) {
    for (const ora of ORE) {
        const c = JSON.parse(JSON.stringify(base[id]));
        c.id = `${flusso}-${ora.replace(':', '')}`; c.caso.id = c.id; c.caso.ora = ora; c.caso.giorno = '2026-10-15';
        t.casi.push(c);
    }
}
const tmp = path.join(outDir, 'diagnosi-notte-tracciati.tmp.json');
const rep = path.join(outDir, '2026-10-21-diagnosi-notte-replay.json');
writeFileSync(tmp, JSON.stringify(t));
spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], {
    cwd: root, stdio: 'ignore', env: { ...process.env, REPLAY_IN: tmp, REPLAY_OUT: rep },
});
const r = JSON.parse(readFileSync(rep, 'utf8'));
// il replay scrive l'id del caso originale: l'ordine e' quello di `t.casi`
const righe = r.casi.map((c, i) => {
    const id = t.casi[i].id;
    const stops = (c.tours || []).flatMap(x => x.stops || []).filter(s => !/tempo libero/i.test(s.title));
    const s = c.schermo || {};
    return {
        id, flusso: id.split('-')[0], ora: c.ora,
        sezioni: (s.sezioni || []).map(x => x.etichetta),
        tappe: stops.map(x => `${x.title} (${x.types?.[0] || '?'})`),
        monte: stops.some(x => /Monte Muganà/.test(x.title)),
        nota: (s.note || []).some(n => /La natura di notte non si vede/.test(n)),
        usciteInRete: (c.replay?.uscite || []).length,
        errore: c.errore || null,
    };
});
const pad = (x, n) => String(x).padEnd(n);
console.log(pad('caso', 18), pad('sezioni', 12), pad('Monte', 6), pad('nota', 6), 'tappe');
for (const x of righe) console.log(pad(x.id, 18), pad(x.sezioni.join('+'), 12), pad(x.monte ? 'SI' : 'no', 6), pad(x.nota ? 'SI' : 'no', 6), x.tappe.join(' · '), x.usciteInRete ? `[${x.usciteInRete} uscite in rete: ricerca non registrata]` : '');
writeFileSync(rep.replace('.json', '-sintesi.json'), JSON.stringify(righe, null, 1));
unlinkSync(rep);

let ko = 0;
for (const x of righe.filter(y => ['00:30', '02:00', '04:30'].includes(y.ora))) {
    if (x.flusso === 'quiz' && (x.monte || !x.nota)) { ko++; console.log(`✗ ${x.id}: Monte Muganà ${x.monte ? 'c\'e\'' : 'non c\'e\''}, nota ${x.nota ? 'c\'e\'' : 'manca'} (alle ${x.ora} atteso: niente natura da fuori + la nota di Ivano)`); }
    if (x.flusso === 'sorprendimi' && x.sezioni.includes('Mattina')) { ko++; console.log(`✗ ${x.id}: il momento e' «Mattina» alle ${x.ora}`); }
}
console.log(ko ? `\nFALLITO: ${ko} celle sbagliate` : '\nOK: dopo mezzanotte i flussi leggono la sera di ieri');
unlinkSync(tmp);
process.exit(ko ? 1 : 0);
