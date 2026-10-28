#!/usr/bin/env node
// FORNITORE-AI — quale parametro del ragionamento va su claude-haiku-5-5 (documentazione: adaptive thinking acceso di difetto, spegnibile con
// `thinking: disabled` a effort medium o sotto, oppure guidato da `output_config.effort`). Ogni variante si prova UNA volta sulla prima richiesta
// vera del traduttore; quelle accettate (HTTP 200 e JSON valido) girano anche sulle altre 4 (5 casi in tutto). Haiku 4.5 e' la base.
// Tetto di spesa PROVA_TETTO_USD (difetto 0,05 $): superato, si ferma. Nessuna chiave nel repo: ANTHROPIC_KEY_FILE (file con la sola chiave)
// oppure ANTHROPIC_API_KEY; la chiave non si stampa mai.
//
//   node --experimental-strip-types scripts/prova-reale/ragionamento-haiku55.mjs --dry     (corpi delle richieste, nessuna rete)
//   ANTHROPIC_KEY_FILE=~/.anthropic-prova node --experimental-strip-types scripts/prova-reale/ragionamento-haiku55.mjs
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { corpoAnthropic, ANTHROPIC_URL, ANTHROPIC_VERSION, estraiJson } from '../../supabase/functions/openai-proxy/anthropic.ts';

const DRY = process.argv.includes('--dry');
const TETTO = Number(process.env.PROVA_TETTO_USD) || 0.05;
const PREZZI = { 'claude-haiku-5-5': { i: 0.1, o: 0.5 }, 'claude-haiku-4-5': { i: 1.0, o: 5.0 } };
const casi = readFileSync(new URL('./traduttore-5-casi.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const H5 = 'claude-haiku-5-5';
const VARIANTI = [
    { id: 'base-4.5', modello: 'claude-haiku-4-5', ragionamento: null },
    { id: '5.5 thinking disabled', modello: H5, ragionamento: { nome: 'disabled', parti: { thinking: { type: 'disabled' } }, margine: 0 } },
    { id: '5.5 effort low', modello: H5, ragionamento: { nome: 'effort-low', parti: { output_config: { effort: 'low' } }, margine: 0 } },
    { id: '5.5 disabled + effort low', modello: H5, ragionamento: { nome: 'disabled+low', parti: { thinking: { type: 'disabled' }, output_config: { effort: 'low' } }, margine: 0 } },
    { id: '5.5 between_tools', modello: H5, ragionamento: { nome: 'between_tools', parti: { thinking: { type: 'between_tools' } }, margine: 0 } },
    { id: '5.5 nessun parametro (difetto: adaptive, effort medium)', modello: H5, ragionamento: { nome: 'nessuno', parti: {}, margine: 0 } },
];

let chiave = '';
if (!DRY) {
    const f = process.env.ANTHROPIC_KEY_FILE;
    chiave = (f ? readFileSync(f.replace(/^~/, os.homedir()), 'utf8') : process.env.ANTHROPIC_API_KEY || '').trim();
    if (!chiave) { console.error('manca la chiave: ANTHROPIC_KEY_FILE o ANTHROPIC_API_KEY'); process.exit(2); }
}
let speso = 0;
const valido = (testo) => { try { const j = JSON.parse(estraiJson(testo)); return Array.isArray(j.queries) && j.queries.length > 0 && 'categoria' in j; } catch { return false; } };

async function una(v, caso) {
    const corpo = corpoAnthropic(v.modello, caso.body, v.ragionamento);
    if (DRY) return { dry: true, corpo: { ...corpo, messages: '[…]', system: '[…]' } };
    const t0 = performance.now();
    const r = await fetch(ANTHROPIC_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': chiave, 'anthropic-version': ANTHROPIC_VERSION }, body: JSON.stringify(corpo) });
    const ms = Math.round(performance.now() - t0);
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, errore: `${d?.error?.type}: ${String(d?.error?.message ?? '').replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***').slice(0, 220)}`, ms };
    const testo = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const u = d.usage || {};
    const p = PREZZI[v.modello];
    speso += ((u.input_tokens || 0) * p.i + (u.output_tokens || 0) * p.o) / 1e6;
    return { ok: true, status: r.status, ms, in: u.input_tokens, out: u.output_tokens, stop: d.stop_reason, blocchi: (d.content || []).map((b) => b.type).join('+'), valido: valido(testo) };
}

const risultati = [];
for (const v of VARIANTI) {
    const righe = [];
    const primo = await una(v, casi[0]);
    righe.push(primo);
    if (DRY) { console.log(v.id, JSON.stringify(primo.corpo)); continue; }
    console.log(`\n== ${v.id}\n  caso 1 (${casi[0].caso}): ${primo.ok ? `HTTP ${primo.status} ${primo.ms} ms, uscita ${primo.out} token, stop=${primo.stop}, blocchi=${primo.blocchi}, JSON ${primo.valido ? 'valido' : 'NON valido'}` : `HTTP ${primo.status} ${primo.errore}`}`);
    if (primo.ok && primo.valido) {
        for (const c of casi.slice(1)) {
            if (speso > TETTO) { console.log(`  tetto di spesa ${TETTO} $ superato: mi fermo`); break; }
            const x = await una(v, c);
            righe.push(x);
            console.log(`  ${c.caso}: ${x.ok ? `${x.ms} ms, uscita ${x.out}, stop=${x.stop}, blocchi=${x.blocchi}, ${x.valido ? 'valido' : 'NON valido'}` : `HTTP ${x.status} ${x.errore}`}`);
        }
    }
    const ok = righe.filter((x) => x.ok && x.valido);
    const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
    risultati.push({ variante: v.id, accettata: primo.ok, validi: `${ok.length}/${righe.length}`, msMediano: med(ok.map((x) => x.ms)), msMax: ok.length ? Math.max(...ok.map((x) => x.ms)) : null, uscitaMedia: ok.length ? Math.round(ok.reduce((a, x) => a + x.out, 0) / ok.length) : null });
    if (speso > TETTO) { console.log(`tetto di spesa ${TETTO} $ superato: mi fermo`); break; }
}
if (!DRY) {
    console.log('\nRIEPILOGO');
    console.table(risultati);
    console.log(`spesa stimata della prova: ${speso.toFixed(5)} $ (tetto ${TETTO} $)`);
}
