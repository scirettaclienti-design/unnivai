// T29 IMPOSTAZIONI-VERIFICA — l'audit del DNA: un utente finto sceglie, finisce giri, corregge dal Profilo. A ogni evento si ricalcolano i pesi
// con la funzione vera (`pesiDaEventi`); alle tappe del percorso il giro dopo si rigioca dal tracciato (selettore spento, 0 $) col DNA di quel momento.
// Le righe sono quelle che l'app scrive (righeDelGesto: una riga per categoria, stop_reached con km e sosta).
// DNA_OUT (json). Si lancia con `node scripts/impostazioni/dna-audit.mjs`.
import { it, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import config from '../banco/banco.config.json';
import { creaLuoghi, annotaRisposta, genera, registraItinerario, recordCaso } from '../banco/giro-caso.js';
import { creaReteReplay, fattiDalTracciato } from '../banco/replay/rete.js';
import { pesiDaEventi, CORE_CATEGORIES } from '@/services/preferenceEngine';
import { righeDelGesto } from '@/lib/dnaRegistro';
import { fasciaDna } from '@/lib/fasciaDna';
import { dnaGiroDaApprendimento } from '@/lib/giroDna';
import { risultatiDalRegistro } from '@/lib/dnaProfilo';
import { ritmoAppreso } from '@/lib/dnaRitmo';
import { misure, confronto } from './metriche.js';

vi.mock('@/lib/supabase', () => import('../banco/replay/supabase-finto.js'));
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato(globalThis.__replayFatti, stops) };
});

const OUT = process.env.DNA_OUT;
if (!OUT) throw new Error('DNA_OUT mancante');
const T0 = Date.parse('2026-10-01T09:00:00Z');
const GIORNO = 86400000;

// ─── La storia dell'utente finto ───────────────────────────────────────────────────────────────────────────────────────
// Un gesto: { etichetta, giorno, righe: [...] } oppure { etichetta, giorno, giroDopo: true } (si rigioca il giro).
const riga = (kind, campi, giorno, min = 0, n = 0) => righeDelGesto(kind, campi).map((r, i) => ({ ...r, id: `${kind}-${giorno}-${min}-${n}-${i}`, created_at: new Date(T0 + giorno * GIORNO + min * 60000).toISOString() }));
const giro = (id, giorno, tappe) => {
    const righe = [];
    tappe.forEach((cat, i) => righe.push(...riga('stop_reached', { category: cat, tourId: id, value: `km=${i ? 0.5 : 0};sosta=30;tipo=${cat}`, city: 'Roma' }, giorno, i * 50, i)));
    righe.push(...riga('tour_completed', { categories: [...new Set(tappe)], tourId: id, city: 'Roma' }, giorno, tappe.length * 50));
    return righe;
};
const STORIA = [
    { etichetta: 'primo ingresso: cibo e natura', giorno: 0, seme: ['food', 'natura'], giroDopo: true },
    { etichetta: 'Al volo: sceglie Natura', giorno: 0, righe: riga('quiz_choice', { category: 'natura', value: 'natura:parco' }, 0) },
    { etichetta: 'giro 1 finito (5 tappe)', giorno: 1, righe: giro('g1', 1, ['cultura', 'cultura', 'food', 'natura', 'cultura']) },
    { etichetta: 'salta una chiesa', giorno: 2, righe: riga('stop_skipped', { category: 'cultura', tourId: 'g2' }, 2) },
    { etichetta: 'giro 2 finito (4 tappe)', giorno: 2, righe: giro('g2', 2, ['cultura', 'food', 'food', 'natura']) },
    { etichetta: 'salva un giro', giorno: 3, righe: riga('tour_saved', { categories: ['food', 'relax'], tourId: 'g3' }, 3) },
    { etichetta: 'giro 3 finito (5 tappe)', giorno: 4, righe: giro('g3', 4, ['food', 'cultura', 'natura', 'relax', 'food']), giroDopo: true },
    { etichetta: 'giro 4 finito (4 tappe)', giorno: 6, righe: giro('g4', 6, ['cultura', 'cultura', 'food', 'natura']) },
    { etichetta: 'giro 5 finito (5 tappe)', giorno: 8, righe: giro('g5', 8, ['cultura', 'food', 'natura', 'arte', 'food']), giroDopo: true },
    { etichetta: 'Profilo: «−» su Cibo', giorno: 9, righe: riga('dna_correction', { category: 'food', value: 'meno' }, 9), giroDopo: true },
    { etichetta: 'Profilo: «+» su Arte', giorno: 9, righe: riga('dna_correction', { category: 'arte', value: 'piu' }, 9, 1) },
    { etichetta: 'Profilo: «+» su Arte', giorno: 9, righe: riga('dna_correction', { category: 'arte', value: 'piu' }, 9, 2) },
    { etichetta: 'Profilo: azzera Natura', giorno: 9, righe: riga('dna_correction', { category: 'natura', value: 'azzera' }, 9, 3), giroDopo: true },
    { etichetta: 'Profilo: «−» su Relax', giorno: 9, righe: riga('dna_correction', { category: 'relax', value: 'meno' }, 9, 4) },
    { etichetta: 'Profilo: «−» su Relax', giorno: 9, righe: riga('dna_correction', { category: 'relax', value: 'meno' }, 9, 5) },
    { etichetta: 'Profilo: «+» su Relax', giorno: 9, righe: riga('dna_correction', { category: 'relax', value: 'piu' }, 9, 6) },
    { etichetta: '30 giorni dopo', giorno: 39, righe: [], giroDopo: true },
    { etichetta: '60 giorni dopo', giorno: 69, righe: [] },
];

const leggi = (f) => JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
const tracciati = leggi('docs/prove/dati/banco-40-tracciati.json.gz');
const base = tracciati.casi.find(c => c.id === 'a-roma');
const E = { ...config.esteso, giornoSimulato: tracciati.giornoSimulato, fusoOffset: tracciati.fusoOffset };
const luoghi = Object.assign({}, ...tracciati.casi.filter(c => c.caso?.luogo === 'Roma').map(c => c.rete?.places || {}));
const fatti = Object.assign({}, ...tracciati.casi.filter(c => c.caso?.luogo === 'Roma').map(c => c.fatti || {}));
const out = { avvio: new Date().toISOString(), eventi: [], giri: [], sospetti: {} };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };
afterAll(save);
const registro = creaLuoghi();

async function giroCon(pesi, share, righe, seme) {
    const caso = { ...base.caso, id: 'audit', dna: share > 0 ? { ...pesi, _share: share } : undefined,
        dnaGiro: dnaGiroDaApprendimento({ righeRegistro: righe, onboardingPrefs: {}, ritmoPreferito: pesiDaEventi(righe, seme, T0).ritmo, compagniaPreferita: pesiDaEventi(righe, seme, T0).compagnia }, { scelto: '', gruppo: '', testo: base.caso.richiesta }) };
    for (const k of Object.keys(window.localStorage)) window.localStorage.removeItem(k);
    const rec = recordCaso(caso, E);
    const { fetch: rete, stato } = creaReteReplay({ rete: { ...base.rete, places: luoghi } }, { racconto: 'vuoto', selettore: 'vuoto' });
    vi.stubGlobal('fetch', async (url, init) => {
        const res = await rete(url, init);
        try { if (res.status !== 204) annotaRisposta(registro, url, await res.clone().json()); } catch { /* non JSON */ }
        return res;
    });
    globalThis.__replayFatti = fatti;
    const g = await genera(caso, E);
    registraItinerario(rec, g, caso, registro.luoghi);
    rec.replay = { uscite: stato.uscite.length };
    return rec;
}

it('la storia del DNA', async () => {
    let righe = [];
    let seme = [];
    let giroPrima = null;
    for (const [i, ev] of STORIA.entries()) {
        righe = [...righe, ...(ev.righe || [])];
        if (ev.seme) seme = ev.seme;
        const ora = new Date(T0 + ev.giorno * GIORNO + 12 * 3600000);
        const p = pesiDaEventi(righe, seme, ora);
        const riga1 = { i, etichetta: ev.etichetta, giorno: ev.giorno, pesi: p.pesi, fiducia: p.share, eventi: p.eventi, fascia: fasciaDna?.({ ...p.pesi, _share: p.share }, p.share) ?? null };
        out.eventi.push(riga1);
        if (ev.giroDopo) {
            const r = await giroCon(p.pesi, p.share, righe, seme);
            const x = giroPrima ? confronto(giroPrima, r) : null;
            out.giri.push({ dopo: ev.etichetta, i, misure: misure(r), tappe: (r.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero).map(s => s.title), uscite: r.replay.uscite, rispettoAlPrecedente: x && { identico: x.identico, tolte: x.tolte, aggiunte: x.aggiunte, diverse: x.diverse } });
            giroPrima = r;
        }
        save();
    }
    // Con fiducia piena (20 giri finiti, 45%): la stessa correzione muove il giro?
    let piena = [];
    for (let g = 1; g <= 22; g++) piena = [...piena, ...giro(`p${g}`, g, ['cultura', 'food', 'natura', 'cultura'])];
    const oraPiena = new Date(T0 + 23 * GIORNO);
    const giroPieno = async (righeP) => { const p = pesiDaEventi(righeP, [], oraPiena); return { p, r: await giroCon(p.pesi, p.share, righeP, []) }; };
    const prima = await giroPieno(piena);
    out.fiduciaPiena = { base: { pesi: prima.p.pesi, fiducia: prima.p.share, tappe: (prima.r.tours || []).flatMap(t => t.stops || []).filter(x => !x.tempoLibero).map(x => x.title) }, correzioni: [] };
    for (const [nome, extra] of [['azzera Cultura', riga('dna_correction', { category: 'cultura', value: 'azzera' }, 22)],
        ['azzera Natura', riga('dna_correction', { category: 'natura', value: 'azzera' }, 22)],
        ['«+» ×3 su Relax', [1, 2, 3].flatMap(k => riga('dna_correction', { category: 'relax', value: 'piu' }, 22, k))]]) {
        const d = await giroPieno([...piena, ...extra]);
        const x = confronto(prima.r, d.r);
        out.fiduciaPiena.correzioni.push({ nome, pesi: d.p.pesi, identico: x.identico, diverse: x.diverse, tolte: x.tolte, aggiunte: x.aggiunte });
    }
    // Sospetto 2 — quanti giri servono per arrivare al 100%
    const quanti = [];
    let r2 = [];
    for (let g = 1; g <= 8; g++) {
        r2 = [...r2, ...giro(`s${g}`, g, ['cultura', 'cultura', 'food', 'natura', 'food'])];
        quanti.push({ giro: g, ...Object.fromEntries(['cultura', 'food', 'natura'].map(k => [k, pesiDaEventi(r2, [], new Date(T0 + g * GIORNO + 12 * 3600000)).pesi[k]])) });
    }
    out.sospetti.saturazione = quanti;
    // Sospetto 1 — un giro con una tappa saltata pesa quanto: tappe raggiunte e saltate nello stesso giro
    out.sospetti.conti = { raggiunta: 0.05, saltata: -0.1, giroFinito: 0.3, salvato: 0.2, correzione: 0.15, tappeRaggiuntePerUnSalto: 2 };
    // Sospetto 4 — una correzione nel tempo
    const c = riga('dna_correction', { category: 'arte', value: 'piu' }, 0);
    out.sospetti.correzioneNelTempo = [0, 30, 60, 90].map(g => ({ giorno: g, peso: pesiDaEventi(c, [], new Date(T0 + g * GIORNO)).pesi.arte }));
    // Sospetto 5 — lo stesso tour due volte
    const due = [...giro('stesso', 1, ['cultura', 'food', 'cultura']), ...giro('stesso', 3, ['cultura', 'food', 'cultura'])];
    out.sospetti.stessoTour = { mete: risultatiDalRegistro?.(due)?.giri ?? null, ritmo: ritmoAppreso(due)?.giri ?? null };
    out.categorie = CORE_CATEGORIES;
}, 300000);
