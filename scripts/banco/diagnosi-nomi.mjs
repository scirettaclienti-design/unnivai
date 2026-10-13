// C6a — i nomi dei posti nei pool salvati, prima e dopo la pulizia delle code commerciali (src/lib/placeName.js).
//   npx vite-node scripts/banco/diagnosi-nomi.mjs docs/prove/dati [altro.json …]
// Legge tutti i grezzi del banco nella cartella (pool dei momenti, pool di Per Te, tappe) piu' l'elenco dei nomi
// con barra letti dalla cache del proxy. Nessuna chiamata.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { cleanPlaceName } from '../../src/lib/placeName.js';

const dir = process.argv[2] || 'docs/prove/dati';
const nomi = new Map(); // "nome|citta" → fonte
const aggiungi = (n, c, f) => { if (n) nomi.set(`${n}\u0000${c || ''}`, f); };
for (const f of readdirSync(dir).filter(x => /\.json$/.test(x))) {
    let raw; try { raw = JSON.parse(readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    if (f.includes('c6a-nomi-cache')) { for (const [n, c] of raw.nomi) aggiungi(n, c, 'cache del proxy'); continue; }
    for (const c of raw.casi || raw.risultati || []) {
        const citta = c.luogo || '';
        for (const v of Object.values(c.pool || {})) {
            if (Array.isArray(v)) for (const x of v) aggiungi(x.nome, citta, f);
            else for (const x of v.candidati || []) aggiungi(x.nome, citta, f);
        }
        for (const t of c.tours || []) for (const s of t.stops || []) aggiungi(s.title, citta, f);
    }
}
const tutti = [...nomi.keys()].map(k => { const [n, c] = k.split('\u0000'); return { n, c, ...cleanPlaceName(n, { city: c }) }; });
const conBarra = tutti.filter(x => x.n.includes('|'));
const tagliati = tutti.filter(x => x.tagliato);
// i nomi senza barra non devono cambiare mai
const mutati = tutti.filter(x => !x.n.includes('|') && x.name !== x.n.trim());
console.log(`Nomi distinti (nome + citta'): ${tutti.length}; con una barra: ${conBarra.length}; ripuliti: ${tagliati.length}; senza barra e cambiati: ${mutati.length}.\n`);
console.log('| Prima | Dopo | Esito |\n|---|---|---|');
for (const x of conBarra.sort((a, b) => a.n.localeCompare(b.n))) {
    console.log(`| ${x.n.replace(/\|/g, '¦')} | ${x.name.replace(/\|/g, '¦')} | ${x.tagliato ? 'ripulito' : 'intero (coda non riconosciuta come solo commerciale)'} |`);
}
