#!/usr/bin/env node
// T29 — la tabella del report: per ogni impostazione, giro vero (col selettore) e riproduzione a selettore spento dagli stessi tracciati.
// node scripts/impostazioni/tabella-finale.mjs <grezzo giro vero> <grezzo replay selettore spento>
import { readFileSync } from 'node:fs';
import { confronto, misure } from './metriche.js';
const [, , VERO, SPENTO] = process.argv;
const carica = (f) => Object.fromEntries(JSON.parse(readFileSync(f, 'utf8')).casi.filter(c => c.id || c.variante).map(c => [c.variante?.id || c.id, c]));
const vero = carica(VERO), spento = SPENTO ? carica(SPENTO) : {};
const neutro = (id) => `${id.split('-').slice(0, 2).join('-')}-neutro`;
const fmt = (x, n = 2) => (x == null ? '–' : Number(x).toFixed(n).replace('.', ','));
const segno = (x, n = 0) => (x == null ? '–' : `${x > 0 ? '+' : ''}${Number(x).toFixed(n).replace('.', ',')}`);

function rumore(set, citta) {
    const a = set[`${citta}-neutro`], b = set[`${citta}-controllo`];
    return a && b ? confronto(a, b) : null;
}
console.log('## Rumore (stessa impostazione due volte)\n');
console.log('| coppia | selettore | tappe diverse | Δ km | Δ min |');
console.log('|---|---|---|---|---|');
for (const c of ['sm-roma', 'sm-catania', 'av-roma', 'av-catania']) {
    for (const [nome, set] of [['acceso', vero], ['spento', spento]]) {
        const r = rumore(set, c);
        if (r) console.log(`| ${c} | ${nome} | ${r.identico ? 'identico' : `${r.diverse}%`} | ${segno(r.delta.km, 2)} | ${segno(r.delta.minuti)} |`);
    }
}
console.log('\n## Ogni impostazione contro il neutro\n');
console.log('| variante | tappe | km | min | pasti | min pasti | € pasti | diverse vero | diverse spento | − | + |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const id of Object.keys(vero)) {
    if (/neutro|controllo/.test(id)) continue;
    const n = vero[neutro(id)], c = vero[id];
    if (!c?.tours) { console.log(`| ${id} | ${c?.saltato || c?.errore || 'nessun giro'} |`); continue; }
    const m = misure(c), x = n ? confronto(n, c) : null;
    const ns = spento[neutro(id)], cs = spento[id];
    const xs = ns && cs && !(cs.replay?.uscite?.length) ? confronto(ns, cs) : null;
    console.log(`| ${id} | ${m.tappe} (${segno(x?.delta.tappe)}) | ${fmt(m.km)} (${segno(x?.delta.km, 2)}) | ${m.minuti} (${segno(x?.delta.minuti)}) | ${m.pasti} | ${m.minutiPasti} (${segno(x?.delta.minutiPasti)}) | ${fmt(m.prezzoPasti)} | ${x ? (x.identico ? 'identico' : `${x.diverse}%`) : '–'} | ${xs ? (xs.identico ? 'identico' : `${xs.diverse}%`) : (cs ? 'uscita' : '–')} | ${(x?.tolte || []).slice(0, 3).join(', ').slice(0, 70)} | ${(x?.aggiunte || []).slice(0, 3).join(', ').slice(0, 70)} |`);
}
