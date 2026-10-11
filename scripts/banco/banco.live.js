// BANCO-NAZ — banco di prova nazionale dei tour. Genera i tour veri su luoghi
// fissi con l'account di prova e scrive il risultato grezzo in JSON; le misure
// e il report li fa scripts/banco/banco.mjs (misure.js + report.js).
//
// Non si lancia da solo: `npm run banco` (oppure
// `BANCO_OUT=… npx vitest run -c scripts/banco/vitest.banco.config.js`).
// BANCO_CASI=a-roma,d-troina-roma limita i casi; vuoto = tutti.
//
// Nessuna modifica al motore: il banco chiama gli stessi servizi della UI e
// legge recensioni, fascia di prezzo e query di ricerca dalle risposte del
// places-proxy che passano dal fetch (le tappe finali non le portano).
import { it, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService, buildInsiderPool } from '@/services/aiRecommendationService';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { resolveCityCenter } from '@/services/cityCenterService';
import { weightsToAIProfile } from '@/services/preferenceEngine';
import { isMealPlace } from '@/services/momentSelection';
import { resolveFoodPrefs, DIETE } from '@/lib/foodPrefs';
import { voiceIssues } from '@/lib/narrationLight';
import { row, conComposizione } from '../prova-reale/righe.js';
import config from './banco.config.json';

const OUT = process.env.BANCO_OUT;
if (!OUT) throw new Error('BANCO_OUT mancante: lancia il banco con `npm run banco`');

// ─── I casi ──────────────────────────────────────────────────────────────────
// (a) e (b) dicono "Domani": senza, "una giornata" parte da adesso e il giro
// dipenderebbe dall'ora del lancio (alle 13 resta solo il pomeriggio). (d) e'
// letterale, come nel caso reale.
const NEUTRI = [
    ['Roma', 'Roma'], ['Milano', 'Milano'], ['Napoli', 'Napoli'], ['Firenze', 'Firenze'],
    ['Palermo', 'Palermo'], ['Catania', 'Catania'], ['Siracusa-Ortigia', 'Siracusa'],
    ['Polignano a Mare', 'Polignano a Mare'], ['Matera', 'Matera'], ['Scicli', 'Scicli'], ['Troina', 'Troina'],
];
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// I due profili opposti (b): interessi del wizard, vincoli del primo accesso,
// DNA con fiducia piena (cosi' il profilo arriva anche al modello).
const PROFILI = {
    A: { nome: 'arte e chiese, vegetariano, €€€', interests: ['Arte', 'Chiese'],
        onboarding: { dieta: ['vegetariano'], budget: '€€€', stile: null }, dna: { arte: 0.9, cultura: 0.8, _share: 0.45 } },
    B: { nome: 'street food e panorami, nessun vincolo, €', interests: ['Street food', 'Panorami'],
        onboarding: { dieta: [], budget: '€', stile: null }, dna: { food: 0.9, relax: 0.7, _share: 0.45 } },
};

const CASI = [
    ...NEUTRI.map(([luogo, posizione]) => ({ id: `a-${slug(luogo)}`, gruppo: 'a', tipo: 'itinerario', luogo, posizione,
        richiesta: luogo === 'Siracusa-Ortigia' ? 'Domani, una giornata in Ortigia, a Siracusa' : `Domani, una giornata a ${luogo}` })),
    ...['Roma', 'Catania'].flatMap(luogo => ['A', 'B'].map(p => ({ id: `b-${slug(luogo)}-${p}`, gruppo: 'b', tipo: 'itinerario',
        luogo, posizione: luogo, richiesta: `Domani, una giornata a ${luogo}`, profilo: p }))),
    ...['Roma', 'Catania'].map(luogo => ({ id: `c-${slug(luogo)}`, gruppo: 'c', tipo: 'perte', luogo, posizione: luogo, richiesta: '(Per Te, adesso)' })),
    { id: 'd-troina-roma', gruppo: 'd', tipo: 'itinerario', luogo: 'Roma', posizione: 'Troina', richiesta: 'una giornata a Roma', attesa: 'Roma' },
];
const SCELTI = (process.env.BANCO_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
const casi = SCELTI.length ? CASI.filter(c => SCELTI.includes(c.id)) : CASI;

const out = { avvio: new Date().toISOString(), identita: null, casi: [] };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };

// ─── Il fetch che conta e annota ─────────────────────────────────────────────
// AI: chiamate e token (in/out) sull'openai-proxy. Google: chiamate per
// percorso sul places-proxy, e per ogni luogo visto recensioni, price_level,
// types e le query di ricerca che l'hanno trovato.
const realFetch = globalThis.fetch;
const cont = { ai: 0, tokenIn: 0, tokenOut: 0, google: {} };
const luoghi = new Map();
const annota = (p, query) => {
    const id = p?.place_id;
    if (!id) return;
    const l = luoghi.get(id) || { queries: new Set() };
    if (Number.isFinite(p.user_ratings_total)) l.recensioni = p.user_ratings_total;
    if (Number.isFinite(p.price_level)) l.priceLevel = p.price_level;
    if (Array.isArray(p.types)) l.types = p.types;
    if (query) l.queries.add(query.toLowerCase());
    luoghi.set(id, l);
};
globalThis.fetch = vi.fn(async (url, init) => {
    const res = await realFetch(url, init);
    const u = String(url);
    if (u.includes('places-proxy')) {
        let params = null;
        try { params = new URL(u, 'http://x').searchParams; } catch { /* url strano */ }
        const k = params?.get('path') || 'altro';
        cont.google[k] = (cont.google[k] || 0) + 1;
        if (k !== 'place/photo') {
            try {
                const j = await res.clone().json();
                for (const p of j?.results || []) annota(p, params?.get('query'));
                if (j?.result) annota(j.result, null);
                for (const p of j?.candidates || []) annota(p, params?.get('input'));
            } catch { /* non JSON */ }
        }
    }
    if (u.includes('openai-proxy')) {
        cont.ai++;
        try {
            const j = await res.clone().json();
            cont.tokenIn += j?.usage?.prompt_tokens || 0;
            cont.tokenOut += j?.usage?.completion_tokens || 0;
        } catch { /* stream o errore */ }
    }
    return res;
});

beforeAll(async () => {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    // Il banco gira solo con l'account di prova: da ospite consumerebbe la
    // quota ospite a meta' giro e le generazioni non sarebbero etichettate.
    if (!email || !password) throw new Error("mancano le credenziali dell'account di prova in .env.local");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) throw new Error(`login dell'account di prova fallito: ${error?.status || ''} ${error?.code || 'nessuna sessione'}`);
    out.identita = 'account di prova';
    console.log(`[banco] account di prova | casi: ${casi.map(c => c.id).join(', ')} | risultato: ${OUT}`);
    save();
});
afterAll(async () => {
    out.fine = new Date().toISOString();
    save();
    await supabase.auth.signOut();
});

const oraRoma = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('it-IT', { timeZone: config.perTeOrario.fuso, hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(new Date()).map(x => [x.type, x.value]));
    return { h: Number(p.hour), testo: `${p.hour}:${p.minute}` };
};

// Una tappa del banco: la riga della prova reale + quello che serve alle misure.
const tappa = (s, fatti, comp, riempite, dieta) => {
    const r = conComposizione({ place_id: s.place_id, ...row(s, fatti, riempite) }, comp, fatti);
    const l = luoghi.get(s.place_id) || { queries: new Set() };
    const frasi = String(r.description || '').split(/(?<=[.!?])\s+/).filter(Boolean)
        .map(f => ({ testo: f, problemi: voiceIssues(f) }));
    const types = l.types || s.types || [];
    const parole = dieta.flatMap(d => [DIETE[d]?.criterio, ...(DIETE[d]?.parole || [])].filter(Boolean));
    return {
        place_id: s.place_id, title: r.title, types, moment: r.moment, at: r.at,
        lat: s.latitude ?? null, lng: s.longitude ?? null, min: r.min, scelta: r.scelta,
        ripiego: s._tracciato?.ripiego || null, motivo: r.motivo || null, famiglia: r.famiglia,
        // C5b — perche' un incrocio e' rimasto, e da dove si e' misurata la prima tappa.
        incrocio: s._tracciato?.incrocio || null, daPartenza: s._tracciato?.daPartenza || null,
        // C5c — una famiglia ripetuta: evitabile o inevitabile, con le alternative del pool.
        varieta: s._tracciato?.varieta || null,
        // C5d — una deviazione oltre 5 min: pool o composizione, con le alternative del momento.
        deviazioneProva: s._tracciato?.deviazioneProva || null,
        description: r.description, verita: r.verita, voce: r.voce, frasi, fatti: (fatti || []).length,
        recensioni: l.recensioni ?? null, priceLevel: l.priceLevel ?? null,
        pasto: isMealPlace({ types, name: r.title, title: r.title }),
        dietaCercata: parole.length ? [...l.queries].some(q => parole.some(w => q.includes(w))) : null,
    };
};

for (const caso of casi) {
    it(caso.id, async () => {
        const rec = { ...caso };
        out.casi.push(rec);
        // Ogni caso parte a cache vuota (ricerche Places, centri citta'): le
        // chiamate Google sono quelle di UNA generazione. La sessione (sb-*) resta.
        for (const k of Object.keys(window.localStorage)) if (!k.startsWith('sb-')) window.localStorage.removeItem(k);
        const c0 = { ...cont, google: { ...cont.google } };
        const delta = () => ({
            ai: { chiamate: cont.ai - c0.ai, tokenIn: cont.tokenIn - c0.tokenIn, tokenOut: cont.tokenOut - c0.tokenOut },
            google: Object.fromEntries(Object.entries(cont.google).map(([k, v]) => [k, v - (c0.google[k] || 0)]).filter(([, v]) => v > 0)),
        });
        const t0 = Date.now();
        try {
            const prof = caso.profilo ? PROFILI[caso.profilo] : null;
            const food = resolveFoodPrefs({ onboarding: prof?.onboarding || null });
            if (prof) rec.vincoli = { dieta: food.dieta, budget: food.budget, maxPriceLevel: food.maxPriceLevel };
            if (prof) rec.profiloNome = prof.nome;
            if (caso.tipo === 'perte') {
                const ora = oraRoma();
                const { da, a } = config.perTeOrario;
                if (ora.h < da || ora.h >= a) { rec.saltato = `fuori orario: alle ${ora.testo} (Per Te solo tra le ${da} e le ${a})`; return; }
                rec.ora = ora.testo;
                const cc = await resolveCityCenter(caso.posizione);
                const themed = await placesDiscoveryService.discoverAllThemes(caso.posizione, cc.latitude, cc.longitude, { foodPrefs: food });
                const insider = buildInsiderPool(themed, cc, caso.posizione, undefined, { _share: 0 });
                const r = await aiRecommendationService.generateHomeTours({ city: caso.posizione, cityCenter: cc, themedCandidates: { insider, ...themed },
                    prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, aiProfile: '',
                    // come in prova.live.js: solo il preflight, il tetto vero e' sul server
                    opts: { dnaWeights: { _share: 0 }, skipUserQuota: true } });
                rec.secs = (Date.now() - t0) / 1000;
                rec.source = r._source;
                rec.momento = r._report?.momento ?? null;
                const per = new Map((r._report?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const comp = new Map((r._report?.composizione || []).map(x => [x.place_id, x]));
                rec.tours = (r.tours || []).map(t => ({ tema: t.themeType, stops: t.stops.map(s => tappa(s, per.get(s.place_id), comp, null, [])) }));
            } else {
                const cc = await resolveCityCenter(caso.posizione);
                if (caso.attesa) {
                    const ac = await resolveCityCenter(caso.attesa);
                    rec.attesa = { city: caso.attesa, center: { lat: ac.latitude, lng: ac.longitude } };
                }
                const prefs = prof ? { interests: prof.interests, duration: '1 Giorno' } : { duration: '1 Giorno' };
                const r = await aiRecommendationService.generateItinerary(caso.posizione, prefs, caso.richiesta, {},
                    prof ? weightsToAIProfile(prof.dna) : '', cc,
                    { pathType: 'custom', skipUserQuota: true, dnaWeights: prof ? prof.dna : {}, onboardingPrefs: prof?.onboarding || null });
                rec.secs = (Date.now() - t0) / 1000;
                rec.source = r._source;
                rec.destinazione = r.destination ? { city: r.destination.city, fromText: r.destination.fromText, note: r.destination.note || null } : null;
                rec.giorno = r.tourWindow ? { date: r.tourWindow.date, start: r.tourWindow.start } : null;
                rec.frasiTolte = r._narrationReport?.frasiTolte ?? null;
                // BANCO-POOL — per ogni momento i candidati che il codice ha messo in
                // classifica (al massimo 15: famiglia, merito, minuti, deviazione,
                // scelto o perche' no) e le scelte del modello: le diagnosi dopo un
                // giro si fanno da qui, senza rigenerare.
                rec.pool = r._momentReport?.pool ?? null;
                rec.sceltaModello = r._momentReport?.sceltaModello ?? null;
                rec.ricerche = { prima: r._momentReport?.ricercheMirate ?? null, dopo: r._momentReport?.ricercheDopo ?? null };
                const per = new Map((r._narrationReport?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const comp = new Map((r._narrationReport?.composizione || []).map(x => [x.place_id, x]));
                const riempite = new Set((r._momentReport?.riempite || []).map(x => x.place_id));
                rec.tours = (r.days || []).map(d => ({ tema: d.title || null, stops: d.stops.map(s => tappa(s, per.get(s.place_id), comp, riempite, food.dieta)) }));
            }
        } catch (e) {
            rec.secs = (Date.now() - t0) / 1000;
            rec.errore = e?.code || e?.message || String(e);
        } finally {
            Object.assign(rec, delta());
            save();
        }
    });
}
