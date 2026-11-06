// PER-TE-TRE (T27) — i sei controlli del banco 40 sui giri di Per Te della prova (prima e dopo). 0 $: legge i grezzi.
//   node scripts/prova-perte/controlli.mjs docs/prove/dati/per-te-tre/dopo.json
import { readFileSync } from 'node:fs';
import { esitoDi } from '../banco/esiti40.js';
const config = JSON.parse(readFileSync('scripts/banco/banco.config.json', 'utf8'));
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let ko = 0;
for (const c of g.casi.filter(x => x.id)) {
    const e = esitoDi(c, { id: c.id, modo: c.modo, luogo: c.luogo, ora: c.ora, attesa: c.luogo }, config);
    const rossi = Object.entries(e.controlli || {}).filter(([, v]) => v && v.ok === false);
    if (rossi.length) ko += 1;
    console.log(`${rossi.length ? '❌' : '✅'} ${c.id} (${e.stato}): ${e.tappe} tappe${rossi.length ? ' — ' + rossi.map(([k, v]) => `${k}: ${JSON.stringify(v.dettagli ?? v.motivo ?? v).slice(0, 240)}`).join(' | ') : ''}`);
}
console.log(ko ? `${ko} casi con difetti` : 'tutti i casi passano i sei controlli');
