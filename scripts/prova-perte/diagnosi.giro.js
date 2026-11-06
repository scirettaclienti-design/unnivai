// PER-TE-TRE (T27) — diagnosi di Per Te a 0 $: un caso «perte» rigiocato dai tracciati salvati, col DNA dato, e il resoconto
// interno del motore (tour proposti, serviti, scarti col motivo, proposte «per dopo»). Nessuna rete.
// PERTE_IN (tracciati .json.gz), PERTE_CASI (id), PERTE_DNA (JSON dei pesi), PERTE_OUT (json del resoconto).
import { it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import config from '../banco/banco.config.json';
import { creaReteReplay, fattiDalTracciato } from '../banco/replay/rete.js';
import { generaPerTe } from '../banco/giro-caso.js';

vi.mock('@/lib/supabase', () => import('../banco/replay/supabase-finto.js'));
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const IN = process.env.PERTE_IN;
const tracciati = JSON.parse(gunzipSync(readFileSync(IN)).toString('utf8'));
const E = { ...config.esteso, giornoSimulato: tracciati.giornoSimulato, ...(tracciati.fusoOffset ? { fusoOffset: tracciati.fusoOffset } : {}) };
const SCELTI = (process.env.PERTE_CASI || '').split(',').filter(Boolean);
const DNA = process.env.PERTE_DNA ? JSON.parse(process.env.PERTE_DNA) : null;
const out = [];
for (const traccia of (tracciati.casi || []).filter(t => SCELTI.includes(t.id))) {
    it(traccia.id, async () => {
        for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
        const rete = { ...traccia.rete, places: { ...(tracciati.comune?.places || {}), ...(traccia.rete?.places || {}) } };
        const { fetch: f, stato } = creaReteReplay({ rete }, {});
        vi.stubGlobal('fetch', f);
        globalThis.__replayFatti = traccia.fatti || {};
        const caso = { ...traccia.caso, ...(DNA ? { dna: DNA } : {}) };
        const { r, themed } = await generaPerTe(caso, E);
        const rep = r._report || {};
        const motivi = {};
        for (const s of rep.scarti || []) { const k = `${s.tour}: ${s.motivo.replace(/\(.*\)/, '').trim()}`; motivi[k] = (motivi[k] || 0) + 1; }
        const riga = {
            id: traccia.id, luogo: caso.luogo, ora: caso.ora, source: r._source,
            pool: Object.fromEntries(Object.entries(themed || {}).map(([k, v]) => [k, (v || []).length])),
            proposti: rep.tourProposti, serviti: rep.tourServiti, proposte: rep.proposte, passioni: rep.passioni, mancanti: r.passioniMancanti,
            elenco: (r.tours || []).map(t => `${t.themeType}${t.perDopo ? '(dopo)' : ''} «${t.title}»: ${t.stops.filter(s => !s.tempoLibero).map(s => s.title).join(' · ')}`),
            tours: (r.tours || []).map(t => `${t.themeType}:${t.stops.length}${t.perDopo ? '(dopo)' : ''}`),
            motivi, uscite: stato.uscite.map(u => `${u.tipo} ${String(u.chiave).slice(0, 80)}`),
        };
        out.push(riga);
        console.log(JSON.stringify(riga, null, 1));
        if (process.env.PERTE_OUT) writeFileSync(process.env.PERTE_OUT, JSON.stringify(out, null, 1));
    });
}
