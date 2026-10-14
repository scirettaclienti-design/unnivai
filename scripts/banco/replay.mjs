#!/usr/bin/env node
// C10c-replay — il comando del replay: rigioca i casi di un giro dai tracciati salvati (0 $, nessuna rete) e, se gli si da'
// il grezzo del giro registrato, dice per ogni caso se il tour e' identico (stesse tappe, stessi orari).
//
//   npm run banco:replay -- docs/prove/dati/<giro>-tracciati.json.gz
//   npm run banco:replay -- <tracciati> --confronta docs/prove/dati/<giro>.json [--out <grezzo-replay.json>] [--casi a,b]
//   REPLAY_RACCONTO=vuoto npm run banco:replay -- …   (narratore non registrato: frasi del codice, tappe e orari uguali)
//
// Scrive il grezzo del replay (formato del banco esteso) e stampa la fedelta' caso per caso.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { confrontaTour } from './replay/rete.js';

const root = process.cwd();
const args = process.argv.slice(2);
const opt = (nome) => { const i = args.indexOf(nome); return i > -1 ? args[i + 1] : null; };
const tracciati = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!tracciati || !existsSync(tracciati)) {
    console.error('uso: npm run banco:replay -- <tracciati.json.gz> [--confronta <grezzo.json>] [--out <file>] [--casi a,b]');
    process.exit(2);
}
const out = path.resolve(opt('--out') || tracciati.replace(/-tracciati(\.json)?(\.gz)?$/, '').replace(/\.json(\.gz)?$/, '') + '-replay.json');
const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, REPLAY_IN: path.resolve(tracciati), REPLAY_OUT: out, ...(opt('--casi') ? { REPLAY_CASI: opt('--casi') } : {}) },
});
if (!existsSync(out)) { console.error('[replay] nessun risultato scritto'); process.exit(r.status || 1); }
const replay = JSON.parse(readFileSync(out, 'utf8'));

const confronta = opt('--confronta');
const righe = [];
if (confronta) {
    const base = JSON.parse(readFileSync(confronta, 'utf8'));
    const perId = new Map((base.casi || []).map(c => [c.id, c]));
    for (const c of replay.casi) {
        const b = perId.get(c.id);
        const f = b ? confrontaTour(b, c) : null;
        c.fedelta = f ? { identico: f.identico, tappePrima: f.tappePrima, tappeDopo: f.tappeDopo, diff: f.diff } : { identico: null, nota: 'caso assente nel grezzo' };
        righe.push(`${f?.identico ? '✅' : '❌'} ${c.id}: ${f ? `${f.tappeDopo}/${f.tappePrima} righe, ${f.diff.length} differenze` : 'nessun confronto'}`
            + `${c.replay?.uscite?.length ? ` | uscite in rete ${c.replay.uscite.length}` : ''}${c.errore ? ` | errore ${c.errore}` : ''}`);
    }
    replay.confronto = path.basename(confronta);
    writeFileSync(out, JSON.stringify(replay, null, 1));
}
console.log(`[replay] ${replay.casi.length} casi | grezzo del replay: ${path.relative(root, out)}`);
for (const x of righe) console.log(`  ${x}`);
const uscite = replay.casi.reduce((n, c) => n + (c.replay?.uscite?.length || 0), 0);
if (uscite) console.log(`[replay] FALLITO: ${uscite} uscite in rete (il tracciato non ha quelle risposte)`);
process.exit(r.status ?? (uscite ? 1 : 0));
