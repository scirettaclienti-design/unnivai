// BORGO-DIAGNOSI — il replay dei tracciati (0 $, nessuna rete) con l'IMBUTO di ogni caso: chi entra e chi esce a ogni filtro
// del motore (raggio, merito, momenti e loro categorie, orari all'arrivo). Il motore non cambia: le funzioni vere sono
// avvolte da vi.mock solo per annotare ingresso e uscita.
// Controfattuali (per provare le proposte a 0 $, sempre sugli stessi tracciati):
//   DIAG_BORGO_MIN=n     soglia della mezza giornata del borgo (oggi BORGO_MIN_VERIFICATI = 4)
// Lancio: REPLAY_IN=<tracciati> REPLAY_OUT=<grezzo> DIAG_OUT=<imbuto.json> npx vitest run -c scripts/banco/vitest.diagnosi-borgo.config.js
import { it, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import config from './banco.config.json';
import { creaLuoghi, annotaRisposta, genera, registraItinerario, recordCaso, generaPerTe, registraPerTe } from './giro-caso.js';
import { creaReteReplay, fattiDalTracciato } from './replay/rete.js';

vi.mock('@/lib/supabase', () => import('./replay/supabase-finto.js'));
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const nome = (c) => c?.name || c?.title || c?.nome || c?.place_id || '?';
const segna = (passo, dati) => globalThis.__imbuto?.push({ passo, ...dati });

vi.mock('@/services/tourShape', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, applyRadiusFilter: (c, ...a) => {
        const r = m.applyRadiusFilter(c, ...a);
        const dentro = new Set(r.map(nome));
        segna('raggio', { entrano: c.length, escono: r.length, tolti: c.map(nome).filter(n => !dentro.has(n)) });
        return r;
    } };
});
vi.mock('@/services/candidateScoring', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, selectScoredCandidatePool: (c, o) => {
        const r = m.selectScoredCandidatePool(c, o);
        const dentro = new Set(r.map(nome));
        segna('merito', { entrano: c.length, escono: r.length, tolti: c.map(nome).filter(n => !dentro.has(n)) });
        return r;
    } };
});
vi.mock('@/services/momentSelection', async (importOriginal) => {
    const m = await importOriginal();
    return {
        ...m,
        bucketCandidates: (moments, candidates, o) => {
            const b = m.bucketCandidates(moments, candidates, o);
            const usati = new Set([...b.values()].flat().map(nome));
            segna('momenti', {
                anyCategory: !!o?.anyCategory,
                momenti: moments.map(x => ({ id: x.id, categorie: x.categories, candidati: (b.get(x.id) || []).map(nome) })),
                pool: candidates.map(c => ({ nome: nome(c), categorie: [...m.candidateMomentCategories(c)], tipo: c.primaryType || c.types?.[0] || null })),
                senzaMomento: candidates.map(nome).filter(n => !usati.has(n)),
            });
            return b;
        },
        applyOpeningToBuckets: (moments, buckets, o) => {
            const prima = new Map([...buckets.entries()].map(([k, v]) => [k, v.map(nome)]));
            const r = m.applyOpeningToBuckets(moments, buckets, o);
            const dopo = r?.buckets || buckets;
            segna('orari', { tolti: [...prima.entries()].flatMap(([k, v]) => { const d = new Set((dopo.get?.(k) || []).map(nome)); return v.filter(n => !d.has(n)).map(n => `${n} @${k}`); }) });
            return r;
        },
    };
});
vi.mock('@/lib/cityKnowledge', async (importOriginal) => {
    const m = await importOriginal();
    return process.env.DIAG_BORGO_MIN ? { ...m, BORGO_MIN_VERIFICATI: Number(process.env.DIAG_BORGO_MIN) } : m;
});

const IN = process.env.REPLAY_IN, OUT = process.env.REPLAY_OUT, DIAG = process.env.DIAG_OUT;
const grezzo = readFileSync(IN);
const tracciati = JSON.parse((IN.endsWith('.gz') ? gunzipSync(grezzo) : grezzo).toString('utf8'));
const E = { ...config.esteso, giornoSimulato: tracciati.giornoSimulato };
const SCELTI = (process.env.REPLAY_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
const casi = (tracciati.casi || []).filter(t => !SCELTI.length || SCELTI.includes(t.id));
const out = { replay: path.basename(IN), controfattuale: { borgoMin: process.env.DIAG_BORGO_MIN || null }, casi: [] };
const imbuti = {};
afterAll(() => {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(out, null, 1));
    if (DIAG) writeFileSync(DIAG, JSON.stringify(imbuti, null, 1));
});
const registro = creaLuoghi();

for (const traccia of casi) {
    it(traccia.id, async () => {
        const caso = traccia.caso;
        const rec = recordCaso(caso, E);
        out.casi.push(rec);
        for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
        const rete = { ...traccia.rete, places: { ...(tracciati.comune?.places || {}), ...(traccia.rete?.places || {}) } };
        const { fetch: reteReplay, stato } = creaReteReplay({ rete }, { racconto: 'registrato' });
        vi.stubGlobal('fetch', async (url, init) => {
            const res = await reteReplay(url, init);
            try { if (res.status !== 204) annotaRisposta(registro, url, await res.clone().json()); } catch { /* non JSON */ }
            return res;
        });
        globalThis.__replayFatti = traccia.fatti || {};
        globalThis.__imbuto = imbuti[traccia.id] = [];
        try {
            if (caso.modo === 'perte') registraPerTe(rec, await generaPerTe(caso, E), E, registro.luoghi);
            else registraItinerario(rec, await genera(caso, E), caso, registro.luoghi);
        } catch (e) { rec.errore = e?.code || e?.message || String(e); }
        rec.replay = { uscite: stato.uscite.map(x => `${x.tipo} ${String(x.chiave).slice(0, 160)}`), promptDiversi: stato.promptDiversi?.length ?? 0 };
    });
}
