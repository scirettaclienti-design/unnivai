#!/usr/bin/env node
// BANCO-DIFETTI-2 (T23) — la misura di D6 e D7 su un grezzo del banco (giro vero o replay), per la tabella prima/dopo del report.
//   D6: il sesto controllo (controlloRichiesta.js) caso per caso: cose chieste, nel giro, dichiarate, violazioni.
//   D7: le righe di «Tempo libero» di oltre 2 ore; «mute» = col testo di sempre («Niente in agenda…»), «dichiarate» = col motivo.
// Uso: node scripts/banco/report-difetti2.mjs <grezzo.json> [casi,separati,da,virgola]
// Il grezzo di un replay: REPLAY_IN=docs/prove/dati/banco-40-tracciati.json.gz REPLAY_OUT=/tmp/r.json npx vitest run -c scripts/banco/vitest.replay.config.js
import { readFileSync } from 'node:fs';
import { richiesta } from './controlloRichiesta.js';
import { CASI_BANCO40 } from './casi-banco40.js';

const [file, filtro] = process.argv.slice(2);
if (!file) { console.error('uso: node scripts/banco/report-difetti2.mjs <grezzo.json> [casi]'); process.exit(2); }
const g = JSON.parse(readFileSync(file, 'utf8'));
const scelti = (filtro || '').split(',').filter(Boolean);
const righe = [];
for (const c of g.casi || []) {
    if (scelti.length && !scelti.includes(c.id)) continue;
    const m = CASI_BANCO40.find(x => x.id === c.id) || {};
    const r = richiesta(c, m);
    const lunghe = (c.tours || []).flatMap(t => t.stops || []).filter(s => s.tempoLibero && Number(s.stay) > 120);
    const mute = lunghe.filter(s => /^Niente in agenda/.test(s.description || ''));
    righe.push({ id: c.id, voci: r.voci, nelGiro: r.nelGiro, dichiarate: r.dichiarate, d6: r.ok ? 'ok' : 'KO', violazioni: r.violazioni,
        lunghe: lunghe.map(s => s.stay), mute: mute.length, note: c.schermo?.note || [] });
}
for (const x of righe) {
    console.log(`${x.id.padEnd(28)} D6 ${x.d6.padEnd(2)} (${x.voci} chieste, ${x.nelGiro} nel giro, ${x.dichiarate} dichiarate)  D7 oltre 2 ore: ${x.lunghe.length ? x.lunghe.join(', ') : '-'}${x.mute ? ` (${x.mute} mute)` : ''}`);
    for (const v of x.violazioni) console.log(`    ✗ ${v}`);
}
const tot = (k) => righe.reduce((n, x) => n + (typeof x[k] === 'number' ? x[k] : x[k].length), 0);
console.log(`\nD6: ${righe.filter(x => x.d6 === 'KO').length}/${righe.length} casi KO · D7: ${righe.filter(x => x.lunghe.length).length} casi con righe oltre 2 ore, ${tot('mute')} mute`);
