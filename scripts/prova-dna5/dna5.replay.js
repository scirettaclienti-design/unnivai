// DNA-5 — la prova dei tre utenti finti (A lento e culturale, B veloce e a piedi tanto, C famiglia con bambini) e dell'utente senza
// DNA (0): lo stesso Crea («Domani, una giornata a Roma», caso a-roma del banco, 5/11 dalle 9:30) e lo stesso Per Te (Roma, 5/11
// alle 10:30, caso c-roma) rigiocati dai tracciati del banco a 0 $, con il motore vero. Cambia solo cio' che il codice decide col DNA:
// il selettore registrato e' quello di un utente nuovo, quindi la scelta la fa il codice (REPLAY_SELETTORE=vuoto, come DNA-3) e le
// frasi sono quelle del codice (racconto vuoto). Una richiesta che il tracciato non ha (es. la ricerca della sosta di DNA-3c) NON
// esce in rete: fallisce e si conta in `uscite` (il motore la tratta come una ricerca fallita: niente sosta).
//
// Lancio: npx vitest run -c scripts/prova-dna5/vitest.dna5.config.js  → scrive docs/prove/dati/2026-11-05-dna-5.json
import { it, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import config from '../banco/banco.config.json';
import { creaLuoghi, annotaRisposta, genera, generaPerTe } from '../banco/giro-caso.js';
import { creaReteReplay, fattiDalTracciato } from '../banco/replay/rete.js';
import { UTENTI, preferenzeDi } from './utenti.js';
import { dnaGiroDaApprendimento } from '@/lib/giroDna';
import { righeDnaDelGiro } from '@/lib/dnaDelGiro';
import { ordinaPerTe } from '@/lib/perTeDna';
import { placeKind } from '@/lib/placeKind';
import { stopCoreCategory } from '@/services/preferenceEngine';
import { haversineKm, displayedTourMinutes } from '@/lib/tourTiming';
import { TETTO_PIEDI_KM } from '@/lib/tettoCammino';

vi.mock('@/lib/supabase', () => import('../banco/replay/supabase-finto.js'));
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const IN = path.resolve('docs/prove/dati/banco-40-tracciati.json.gz');
const OUT = path.resolve(process.env.DNA5_OUT || 'docs/prove/dati/2026-11-05-dna-5.json');
const tracciati = JSON.parse(gunzipSync(readFileSync(IN)).toString('utf8'));
const E = { ...config.esteso, giornoSimulato: tracciati.giornoSimulato, ...(tracciati.fusoOffset ? { fusoOffset: tracciati.fusoOffset } : {}) };
const traccia = (id) => tracciati.casi.find(t => t.id === id);
const out = { tracciati: path.basename(IN), registrato: tracciati.registrato, crea: {}, perTe: {} };
afterAll(() => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); });

const hm = (iso) => (iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '--');
const lat = (s) => Number(s.latitude ?? s.lat);
const lng = (s) => Number(s.longitude ?? s.lng);
function kmGiro(stops) {
    let km = 0; let max = 0;
    for (let i = 1; i < stops.length; i++) {
        const d = haversineKm(lat(stops[i - 1]), lng(stops[i - 1]), lat(stops[i]), lng(stops[i]));
        if (Number.isFinite(d)) { km += d; max = Math.max(max, d); }
    }
    return { km: Math.round(km * 100) / 100, trattoMax: Math.round(max * 100) / 100 };
}
const tappa = (s) => ({
    ora: hm(s.scheduledTime), nome: s.title, tipo: placeKind({ types: s.types, primaryType: s.primaryType }).kind, categoria: stopCoreCategory(s),
    sosta: s.stayMinutes, momento: s.moment || null, ...(s._tracciato?.dna ? { sostaDna: s._tracciato.dna.merenda ? 'merenda' : s._tracciato.dna.categoria } : {}),
});
const riassunto = (stops) => {
    const vere = stops.filter(s => !s.tempoLibero);
    const { km, trattoMax } = kmGiro(vere);
    return {
        tappe: vere.length, km, trattoMax, minuti: displayedTourMinutes(stops),
        sosteVisite: vere.filter(s => !['pasto', 'bar', 'caffe', 'forno', 'dolce', 'spuntino', 'notte', 'negozio', 'servizi'].includes(placeKind({ types: s.types, primaryType: s.primaryType }).kind)).map(s => s.stayMinutes),
        pasti: vere.filter(s => placeKind({ types: s.types, primaryType: s.primaryType }).kind === 'pasto').map(s => `${hm(s.scheduledTime)} ${s.title} (${s.stayMinutes} min)`),
        tempoLibero: stops.filter(s => s.tempoLibero).map(s => s.stayMinutes),
        elenco: stops.map(s => (s.tempoLibero ? { ora: hm(s.scheduledTime), tempoLibero: s.stayMinutes } : tappa(s))),
    };
};

function prepara(t) {
    for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
    const rete = { ...t.rete, places: { ...(tracciati.comune?.places || {}), ...(t.rete?.places || {}) } };
    const { fetch: reteReplay, stato } = creaReteReplay({ rete }, { racconto: 'vuoto', selettore: 'vuoto' });
    const registro = creaLuoghi();
    vi.stubGlobal('fetch', async (url, init) => {
        const res = await reteReplay(url, init);
        try { if (res.status !== 204) annotaRisposta(registro, url, await res.clone().json()); } catch { /* non JSON */ }
        return res;
    });
    globalThis.__replayFatti = t.fatti || {};
    return stato;
}

const PROFILI = { '0': null, A: UTENTI.A, B: UTENTI.B, C: UTENTI.C };

for (const [id, u] of Object.entries(PROFILI)) {
    const dnaGiro = u ? dnaGiroDaApprendimento({ righeRegistro: u.registro, onboardingPrefs: u.onboardingPrefs, ...preferenzeDi(u) }) : null;

    it(`Crea — utente ${id}`, async () => {
        const t = traccia('a-roma');
        const stato = prepara(t);
        const caso = { ...t.caso, ...(u ? { dna: u.pesi, dnaGiro } : {}) };
        const g = await genera(caso, E);
        const stops = g.r.days?.[0]?.stops || [];
        const giro = g.r._momentReport?.dnaGiro ?? null;
        out.crea[id] = {
            utente: u?.nome || '0 — senza DNA',
            dnaGiro: giro,
            merenda: g.r._momentReport?.soste?.merenda ?? null,
            sosteDna: (g.r._momentReport?.soste?.aggiunte || []).map(x => `${x.nome} (${x.categoria}${x.merenda ? ', merenda' : ''}, ${x.minuti} min)`),
            ...riassunto(stops),
            riquadro: righeDnaDelGiro({ pesi: u?.pesi || {}, fiducia: u?.pesi?._share || 0, tappe: stops, registro: u?.registro || [], giro, interessi: u?.interessi || [] }),
            uscite: stato.uscite.map(x => `${x.tipo} ${x.chiave.slice(0, 80)}`),
        };
    });

    it(`Per Te — utente ${id}`, async () => {
        const t = traccia('c-roma');
        const stato = prepara(t);
        const caso = { ...t.caso, ...(u ? { dna: u.pesi, dnaGiro } : {}) };
        const g = await generaPerTe(caso, E);
        const tours = g.r.tours || [];
        const ordinati = u ? ordinaPerTe(tours, { pesi: u.pesi, fiducia: u.pesi._share, compagnia: dnaGiro?.compagnia?.valore || null }) : { tours, punteggi: [] };
        const primo = ordinati.tours.find(x => x.themeType !== 'insider') || ordinati.tours[0];
        out.perTe[id] = {
            utente: u?.nome || '0 — senza DNA',
            dnaGiro: g.r._report?.dnaGiro ?? null,
            ordine: ordinati.tours.map(x => x.themeType),
            punteggi: ordinati.punteggi,
            tours: ordinati.tours.map(x => ({ tema: x.themeType, titolo: x.title, ...riassunto(x.stops || []) })),
            tettoRispettato: ordinati.tours.every(x => kmGiro(x.stops || []).trattoMax <= TETTO_PIEDI_KM + 1e-9),
            riquadro: primo ? righeDnaDelGiro({ pesi: u?.pesi || {}, fiducia: u?.pesi?._share || 0, tappe: primo.stops, registro: u?.registro || [], giro: g.r._report?.dnaGiro ?? null, interessi: u?.interessi || [] }) : [],
            scarti: (g.r._report?.scarti || []).filter(x => /ritmo/.test(x.motivo)).map(x => `${x.tour}: ${x.title}`),
            uscite: stato.uscite.map(x => `${x.tipo} ${x.chiave.slice(0, 80)}`),
        };
    });
}
