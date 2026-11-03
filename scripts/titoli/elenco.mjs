// Elenca i titoli distinti dei giri registrati (docs/prove/dati/*.json + banco-40 tracciati) e il loro esito con titoloGiro.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { titoloGiro, titoloFondato } from '../../src/lib/titoliGiro.js';
const DATI = path.resolve(import.meta.dirname, '../../docs/prove/dati');
const out = new Map();
function raccogli(j, f) {
  const visti = new Set();
  const giro = (o) => {
    if (!o || typeof o !== 'object' || visti.has(o)) return;
    visti.add(o);
    const t = !Array.isArray(o) && (o.titolo || o.title);
    if (typeof t === 'string' && Array.isArray(o.stops) && o.stops.length && typeof o.stops[0]?.title === 'string') {
      const k = `${t}|${o.stops.map(s => s.title).join('/')}`;
      if (!out.has(k)) out.set(k, { file: f, prima: t, stops: o.stops });
      return;
    }
    for (const k of Object.keys(o)) giro(o[k]);
  };
  giro(j);
}
for (const f of fs.readdirSync(DATI)) {
  try {
    if (f.endsWith('.json')) raccogli(JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8')), f);
  } catch {}
}
const base = [...out.values()];
console.log('giri json', base.length, 'titoli distinti', new Set(base.map(g => g.prima)).size);
const CITTE = ['Catania','Troina','Firenze','Napoli','Lecce','Palermo','Cabras','Roma'];
const citta = (g) => CITTE.find(c => new RegExp(c, 'i').test(g.prima)) || (/catania|etnea|ursino|elefant|amenano|catanes/i.test(g.prima + g.stops.map(s => s.title).join(' ')) ? 'Catania' : 'Roma');
const per = new Map();
for (const g of base) { const k = g.prima; if (!per.has(k)) per.set(k, g); }
let n = 0, tieni = 0, genere = 0, daAB = 0;
const righe = [];
const DAAB = /^(Da|Dal|Dallo|Dalla|Dall'|Dai|Dagli|Dalle|Intorno|\d+ tappe)\b/;
for (const g of per.values()) {
  const c = citta(g);
  const dopo = titoloGiro(g.prima, g.stops, c);
  const tipo = dopo === g.prima ? 'TIENE' : DAAB.test(dopo) ? 'DA A B' : 'GENERE';
  n++; if (tipo === 'TIENE') tieni++; else if (tipo === 'GENERE') genere++; else daAB++;
  righe.push(tipo.padEnd(7) + ' ' + g.prima + '  =>  ' + dopo + '  ||  ' + g.stops.filter(s => !s.tempoLibero).map(s => s.title).join(' · ').slice(0, 300));
}
if (process.argv.includes('--json')) console.log(JSON.stringify(righe));
else { righe.forEach(r => console.log(r)); console.log(`tiene ${tieni} · genere ${genere} · Da A a B ${daAB} · totale ${n} · quota Da A a B ${(100 * daAB / n).toFixed(1)}%`); }
