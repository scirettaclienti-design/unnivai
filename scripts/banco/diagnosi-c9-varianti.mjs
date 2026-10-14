#!/usr/bin/env node
// C9-DIAGNOSI — le prove «e se» a 0 $: rigioca il giro di Ivano (Crea, «Domani un giorno da catanese», Catania) dalle risposte REGISTRATE,
// cambiando solo una cosa alla volta (le query del traduttore, i tetti del merito, un bonus ai luoghi famosi). Nessuna rete a pagamento:
// l'AI e Google rispondono dal file; una chiamata non registrata e' dichiarata (`mancanti`), mai fatta.
//
//   node scripts/banco/diagnosi-c9-varianti.mjs            rigioca tutte le varianti e scrive docs/prove/dati/2026-10-15-c9-varianti.json
//
// LIMITE dichiarato: il selettore AI e' quello REGISTRATO nel giro vero (le sue scelte valgono dove i luoghi esistono ancora, il resto lo
// riempie il codice per merito): un luogo nuovo nel pool non puo' essere scelto dal modello. Le ricerche mirate della sera (bar, passeggiata)
// dipendono dal punto da cui partono: se non sono state registrate, la serata di quella variante non e' misurabile (`seraMisurabile: false`).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const DATI = 'docs/prove/dati';
const FIX = `${DATI}/2026-10-15-c9-fixture-catania.json`;
const EXTRA = [`${DATI}/2026-10-15-c9-extra-fixture-catania.json`, `${DATI}/2026-10-15-c9-extra2-fixture-catania.json`].join(',');
const BASE = 'piazza storica|trattoria tipica|belvedere panorama';
const MONUMENTI = 'piazza storica|trattoria tipica|monumenti';
const ESPERIENZE = 'mercato storico palazzo barocco via storica|trattoria tipica|belvedere panorama';

const VARIANTI = [
    { id: 'base', nome: 'Il giro di Ivano (registrato)', query: BASE },
    { id: 'a', nome: 'Stesso pool, merito senza tetto icone e senza limite 20', query: BASE, maxIcons: 10, limite: 40 },
    { id: 'a3', nome: 'Come A + bonus +0,3 ai luoghi famosi (≥ 2.500 recensioni, non pasti)', query: BASE, maxIcons: 10, limite: 40, famosi: '2500:0.3' },
    { id: 'b1', nome: '«monumenti» al posto di «belvedere panorama», merito di oggi', query: MONUMENTI },
    { id: 'b2', nome: 'Come B1, merito senza tetto icone e senza limite 20', query: MONUMENTI, maxIcons: 10, limite: 40 },
    { id: 'b3', nome: 'Come B2 + bonus +0,3 ai luoghi famosi', query: MONUMENTI, maxIcons: 10, limite: 40, famosi: '2500:0.3' },
    { id: 'b4', nome: 'La ricerca «esperienze» di C7 al posto di «piazza storica», merito di oggi', query: ESPERIENZE },
    { id: 'b5', nome: 'Come B4, merito senza tetto icone e senza limite 20', query: ESPERIENZE, maxIcons: 10, limite: 40 },
];

const ESSENZIALI = [
    ['Cattedrale di Sant\'Agata', /cattedrale di sant/i], ['La Pescheria', /pescheria/i], ['Via Etnea', /^via etnea/i],
    ['Monastero dei Benedettini', /benedettini/i], ['Castello Ursino', /ursino/i], ['Teatro Massimo Bellini', /teatro massimo/i],
    ['Villa Bellini', /villa bellini|giardino bellini/i], ['Fera \'o Luni', /fera .?o.?luni/i],
];
const hm = (iso) => { if (!iso) return null; const d = new Date(new Date(iso).getTime() + 2 * 3600000); return d.toISOString().slice(11, 16); };

const out = [];
for (const v of VARIANTI) {
    const tmp = path.join(os.tmpdir(), `c9-var-${v.id}.json`);
    const env = { ...process.env, C9_MODE: 'replay', C9_QUERIES: v.query, C9_MAXICONS: v.maxIcons ?? '', C9_LIMITE: v.limite ?? '', C9_FAMOSI: v.famosi ?? '', C9_EXTRA: EXTRA, C9_OUT: tmp, C9_FIXTURE: FIX };
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.c9.config.js', 'scripts/banco/diagnosi-c9.live.js'], { cwd: root, env, encoding: 'utf8' });
    let d; try { d = JSON.parse(readFileSync(tmp, 'utf8')); } catch { out.push({ ...v, errore: `nessun risultato (vitest ${r.status})` }); continue; }
    const stops = (d.risultato?.giorni || []).flatMap(g => g.stops);
    const vere = stops.filter(s => !s.tempoLibero);
    const mer = d.meriti?.[0];
    const libero = (momenti) => stops.filter(s => s.tempoLibero && momenti.includes(s.moment)).reduce((a, s) => a + (s.stay || 0), 0);
    const seraMisurabile = !(d.mancanti || []).some(k => /bar cocktail|lungomare/.test(k));
    out.push({
        id: v.id, nome: v.nome, query: v.query, merito: { maxIcons: v.maxIcons ?? 1, limite: v.limite ?? 20, famosi: v.famosi ?? null },
        tappeVere: vere.length, tempoLiberoMattinaPomeriggio: libero(['mattina', 'pomeriggio']), tempoLiberoTotale: stops.filter(s => s.tempoLibero).reduce((a, s) => a + (s.stay || 0), 0),
        seraMisurabile, mancanti: (d.mancanti || []).length,
        poolIngresso: mer?.ingresso ?? null, poolAmmessi: mer?.ammessi ?? null, icone: mer?.icone ?? null,
        tour: stops.map(s => `${hm(s.scheduledTime)} ${s.tempoLibero ? `TEMPO LIBERO ${s.stay} min` : s.title}`),
        essenziali: Object.fromEntries(ESSENZIALI.map(([nome, rx]) => {
            const c = (mer?.candidati || []).find(x => rx.test(x.nome || ''));
            const inTour = vere.some(s => rx.test(s.title || ''));
            return [nome, !c ? 'non nel pool' : `${c.ammesso ? 'ammesso' : 'tagliato dal merito'}${c.icona ? ' (icona)' : ''}, punteggio ${c.punteggio}${inTour ? ' → NEL TOUR' : ' → non nel tour'}`];
        })),
    });
}
mkdirSync(DATI, { recursive: true });
writeFileSync(`${DATI}/2026-10-15-c9-varianti.json`, JSON.stringify(out, null, 1));
console.log('| Variante | Tappe | Tempo libero mattina+pomeriggio | Serata misurabile | Pool (ingresso → ammessi) |');
console.log('|---|---|---|---|---|');
for (const x of out) console.log(x.errore ? `| ${x.id} | ${x.errore} |||| ` : `| ${x.id} — ${x.nome} | ${x.tappeVere} | ${x.tempoLiberoMattinaPomeriggio} min | ${x.seraMisurabile ? 'sì' : 'no'} | ${x.poolIngresso} → ${x.poolAmmessi} |`);
