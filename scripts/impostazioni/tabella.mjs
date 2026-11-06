// T29 — la tabella di un grezzo delle varianti: ogni variante contro il neutro della stessa citta' e dello stesso flusso.
import { readFileSync } from 'node:fs';
import { confronto, misure } from './metriche.js';
const [, , file, baseDi = 'neutro'] = process.argv;
const j = JSON.parse(readFileSync(file, 'utf8'));
const per = {};
for (const c of j.casi) { const id = c.variante?.id || c.id; if (!id) continue; per[id] = c; }
const pre = (id) => id.split('-').slice(0, 2).join('-');
const riga = (a) => a.map(x => String(x ?? '–')).join(' | ');
console.log(riga(['variante', 'uscite', 'tappe', 'km', 'min', 'pasti', 'minPasti', '€pasti', 'diverse%', '−', '+']));
for (const [id, c] of Object.entries(per)) {
    const n = per[`${pre(id)}-${baseDi}`];
    const m = misure(c);
    const x = n ? confronto(n, c) : null;
    console.log(riga([id, c.replay?.uscite?.length ?? c.errore ?? 0, m.tappe, m.km, m.minuti, m.pasti, m.minutiPasti, m.prezzoPasti?.toFixed(2), x?.identico ? 'IDENTICO' : x?.diverse, x?.tolte.join(', ').slice(0, 90), x?.aggiunte.join(', ').slice(0, 90)]));
}
