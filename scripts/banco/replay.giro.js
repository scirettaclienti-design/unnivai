// C10c-replay — il banco esteso rigiocato dai tracciati salvati: lo stesso motore, le risposte registrate al posto della
// rete, 0 $. Ogni caso esce nel formato del grezzo del banco (gli stessi script di report e diagnosi lo leggono) con in piu'
// `replay`: richieste servite, uscite in rete (devono essere zero), prompt diversi dal giro registrato, racconto mancante.
//
// Non si lancia da solo: `npm run banco:replay -- <tracciati.json.gz>` (scripts/banco/replay.mjs).
// REPLAY_IN (tracciati, .json o .json.gz), REPLAY_OUT (grezzo del replay), REPLAY_CASI (sottoinsieme),
// REPLAY_RACCONTO=vuoto (narratore non registrato: frasi del codice, tappe e orari non cambiano).
import { it, vi, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import config from './banco.config.json';
import { creaLuoghi, annotaRisposta, genera, registraItinerario, recordCaso } from './giro-caso.js';
import { FORMATO, creaReteReplay, fattiDalTracciato } from './replay/rete.js';
import { accessi } from './replay/supabase-finto.js';

// il database: in memoria, mai in rete
vi.mock('@/lib/supabase', () => import('./replay/supabase-finto.js'));
// i fatti aperti delle tappe: dal tracciato (solo il racconto), mai da Wikipedia o OSM
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const IN = process.env.REPLAY_IN;
const OUT = process.env.REPLAY_OUT;
if (!IN || !OUT) throw new Error('REPLAY_IN e REPLAY_OUT mancanti: lancia il replay con `npm run banco:replay -- <tracciati>`');
const RACCONTO = process.env.REPLAY_RACCONTO === 'vuoto' ? 'vuoto' : 'registrato';
const grezzo = readFileSync(IN);
const tracciati = JSON.parse((IN.endsWith('.gz') ? gunzipSync(grezzo) : grezzo).toString('utf8'));
if (tracciati.formato !== FORMATO) throw new Error(`formato del tracciato sconosciuto: ${tracciati.formato} (atteso ${FORMATO})`);
const E = { ...config.esteso, giornoSimulato: tracciati.giornoSimulato };
const SCELTI = (process.env.REPLAY_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
const casi = (tracciati.casi || []).filter(t => !SCELTI.length || SCELTI.includes(t.id));

const out = { avvio: new Date().toISOString(), identita: 'replay (nessuna rete)', motore: tracciati.motore, giornoSimulato: E.giornoSimulato,
    replay: { tracciati: path.basename(IN), registrato: tracciati.registrato, commitRegistrato: tracciati.commit, ricostruito: tracciati.ricostruito ?? null, racconto: RACCONTO },
    casi: [], costo: { totale: 0 } };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };
afterAll(() => { out.fine = new Date().toISOString(); save(); });

// i posti visti nelle risposte servite (tipi, orari): come nel giro vero, per tutto il giro
const registro = creaLuoghi();

for (const traccia of casi) {
    it(traccia.id, async () => {
        const caso = traccia.caso;
        const rec = recordCaso(caso, E);
        out.casi.push(rec);
        if (caso.modo === 'perte') { rec.saltato = 'replay: Per Te non e\' ancora rigiocabile'; save(); return; }
        for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
        // le risposte comuni a tutto il giro (tracciati ricostruiti) valgono come quelle del caso
        const rete = { ...traccia.rete, places: { ...(tracciati.comune?.places || {}), ...(traccia.rete?.places || {}) } };
        const { fetch: reteReplay, stato } = creaReteReplay({ rete }, { racconto: RACCONTO });
        vi.stubGlobal('fetch', async (url, init) => {
            const res = await reteReplay(url, init);
            try { if (res.status !== 204) annotaRisposta(registro, url, await res.clone().json()); } catch { /* non JSON */ }
            return res;
        });
        globalThis.__replayFatti = traccia.fatti || {};
        const accessi0 = accessi.length;
        const t0 = Date.now();
        try {
            const g = await genera(caso, E);
            rec.secs = (Date.now() - t0) / 1000;
            registraItinerario(rec, g, caso, registro.luoghi);
        } catch (e) {
            rec.secs = (Date.now() - t0) / 1000;
            rec.errore = e?.code || e?.message || String(e);
        } finally {
            rec.spesaUsd = 0;
            rec.replay = { servite: stato.servite, uscite: stato.uscite, promptDiversi: stato.promptDiversi, raccontoMancante: stato.raccontoMancante,
                fallimentiRigiocati: stato.fallimentiRigiocati,
                scrittureDatabase: accessi.slice(accessi0).filter(a => a.cosa !== 'from') };
            save();
        }
        // un replay che prova a uscire in rete e' fallito
        expect(stato.uscite, `uscite in rete: ${stato.uscite.map(x => `${x.tipo} ${x.chiave}`).join(' | ')}`).toEqual([]);
    });
}
