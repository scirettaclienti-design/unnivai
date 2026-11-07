// T29 IMPOSTAZIONI-VERIFICA — ogni impostazione cambiata da sola, sullo stesso luogo e alla stessa ora, dal tracciato.
// Il selettore e' spento (REPLAY_SELETTORE=vuoto di DNA-3): le tappe le sceglie il codice, quindi due varianti con le stesse impostazioni
// danno lo stesso giro e ogni differenza viene dall'impostazione, non dal modello. Una richiesta che il tracciato non ha e' un'uscita:
// la variante non vale e si misura col giro vero.
// IMP_IN (uno o piu' tracciati separati da virgole), IMP_OUT (grezzo), IMP_VARIANTI (sottoinsieme), IMP_SELETTORE=registrato.
import { it, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import config from '../banco/banco.config.json';
import { creaLuoghi, annotaRisposta, genera, registraItinerario, recordCaso } from '../banco/giro-caso.js';
import { creaReteReplay, fattiDalTracciato } from '../banco/replay/rete.js';
import { VARIANTI, casoDellaVariante } from './casi-impostazioni.js';

vi.mock('@/lib/supabase', () => import('../banco/replay/supabase-finto.js'));
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const OUT = process.env.IMP_OUT;
const FILE = (process.env.IMP_IN || 'docs/prove/dati/impostazioni-verifica/tracciati.json.gz').split(',').map(s => s.trim()).filter(Boolean);
if (!OUT) throw new Error('IMP_OUT mancante');
const SELETTORE = process.env.IMP_SELETTORE === 'registrato' ? 'registrato' : 'vuoto';
const leggi = (f) => { const g = readFileSync(f); return JSON.parse((f.endsWith('.gz') ? gunzipSync(g) : g).toString('utf8')); };
const tracciati = FILE.map(leggi);
const tutti = tracciati.flatMap(t => t.casi.map(c => ({ ...c, _fuso: t.fusoOffset, _giorno: t.giornoSimulato })));

// Le risposte di Google non dipendono dall'impostazione: le ricerche di tutti i casi della stessa citta' valgono per ogni variante.
const memo = new Map();
const una = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
const placesDi = (luogo) => una(`p:${luogo}`, () => Object.assign({}, ...tutti.filter(c => c.caso?.luogo === luogo).map(c => c.rete?.places || {})));
const listeDi = (luogo, tipo) => una(`${tipo}:${luogo}`, () => Object.assign({}, ...tutti.filter(c => c.caso?.luogo === luogo).map(c => c.rete?.ai?.[tipo] || {})));
const fattiDi = (luogo) => una(`f:${luogo}`, () => Object.assign({}, ...tutti.filter(c => c.caso?.luogo === luogo).map(c => c.fatti || {})));

const SCELTE = (process.env.IMP_VARIANTI || '').split(',').map(s => s.trim()).filter(Boolean);
const varianti = VARIANTI.filter(v => !SCELTE.length || SCELTE.includes(v.id));
const out = { avvio: new Date().toISOString(), selettore: SELETTORE, tracciati: FILE.map(f => path.basename(f)), casi: [] };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };
afterAll(save);
const registro = creaLuoghi();

for (const v of varianti) {
    it(v.id, async () => {
        const base = tutti.find(c => c.id === v.base);
        if (!base) { out.casi.push({ variante: v, errore: `tracciato ${v.base} mancante` }); return; }
        const E = { ...config.esteso, giornoSimulato: base._giorno, ...(base._fuso ? { fusoOffset: base._fuso } : {}) };
        const caso = casoDellaVariante(v, base.caso);
        const rec = recordCaso(caso, E);
        rec.variante = v;
        out.casi.push(rec);
        for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
        const rete = { ...base.rete, places: placesDi(base.caso.luogo),
            ai: { ...base.rete.ai, lista: listeDi(base.caso.luogo, 'lista'), quartiere: listeDi(base.caso.luogo, 'quartiere') } };
        const { fetch: reteReplay, stato } = creaReteReplay({ rete }, { racconto: 'vuoto', selettore: SELETTORE });
        vi.stubGlobal('fetch', async (url, init) => {
            const res = await reteReplay(url, init);
            try { if (res.status !== 204) annotaRisposta(registro, url, await res.clone().json()); } catch { /* non JSON */ }
            return res;
        });
        globalThis.__replayFatti = fattiDi(base.caso.luogo);
        try {
            const g = await genera(caso, E);
            registraItinerario(rec, g, caso, registro.luoghi);
        } catch (e) {
            rec.errore = e?.code || e?.message || String(e);
        } finally {
            rec.replay = { uscite: stato.uscite, servite: stato.servite, promptDiversi: stato.promptDiversi.length };
            save();
        }
    });
}
