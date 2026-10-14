// BANCO-ESTESO — genera i ≈30 tour della matrice (scripts/banco/casi-esteso.js) con
// l'account di prova e scrive il grezzo in JSON; controlli e report li fanno
// scripts/banco/esteso.mjs (controlli.js + report-esteso.js).
//
// Non si lancia da solo: `npm run banco:esteso`
// (oppure BANCO_OUT=… npx vitest run -c scripts/banco/vitest.banco.config.js scripts/banco/esteso.live.js).
// BANCO_CASI=veloce-catania-relax-2125,… limita i casi; vuoto = tutti.
//
// Ogni caso replica la chiamata reale della sua pagina (vedi casi-esteso.js) con
// l'ora SIMULATA (opts.simulatedNow, ignorata in produzione). Il motore non e'
// toccato. Il pool di ogni momento si salva nel grezzo (come BANCO-POOL).
import { it, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService, buildInsiderPool, buildPlacesProxyUrl } from '@/services/aiRecommendationService';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { resolveCityCenter } from '@/services/cityCenterService';
import { isMealPlace } from '@/services/momentSelection';
import { resolveFoodPrefs, DIETE } from '@/lib/foodPrefs';
import { voiceIssues } from '@/lib/narrationLight';
import { buildPromptFromSelections, buildQuickPrefs } from '@/pages/QuickPath';
import { isSeraStart } from '@/lib/daySkeleton';
import { groupStopsByDayAndMoment } from '@/lib/stopMoments';
import { typeLabelOf } from '@/lib/italianLabels';
import { weightsToAIProfile } from '@/services/preferenceEngine';
import { row, conComposizione } from '../prova-reale/righe.js';
import config from './banco.config.json';
import { CASI_ESTESI, istanteSimulato } from './casi-esteso.js';

const OUT = process.env.BANCO_OUT;
if (!OUT) throw new Error('BANCO_OUT mancante: lancia il banco esteso con `npm run banco:esteso`');
// ORARI-FESTIVI — BANCO_GIORNO=AAAA-MM-GG sposta il giorno simulato (deve stare nei 7 giorni che Google copre).
const E = { ...config.esteso, ...(process.env.BANCO_GIORNO ? { giornoSimulato: process.env.BANCO_GIORNO } : {}) };

// Le scelte del wizard di Veloce sono scritte in casi-esteso.js: se QuickPath.jsx cambia titolo, ci si ferma.
const quickSrc = readFileSync(path.join(process.cwd(), 'src/pages/QuickPath.jsx'), 'utf8');
for (const t of new Set(CASI_ESTESI.filter(c => c.scelta).flatMap(c => [c.scelta.mainTitle, c.scelta.subTitle]))) {
    if (!quickSrc.includes(`title: '${t}'`)) throw new Error(`QuickPath.jsx non ha piu' la scelta «${t}»: aggiorna casi-esteso.js`);
}

const SCELTI = (process.env.BANCO_CASI || '').split(',').map(s => s.trim()).filter(Boolean);
const casi = SCELTI.length ? CASI_ESTESI.filter(c => SCELTI.includes(c.id)) : CASI_ESTESI;
const out = { avvio: new Date().toISOString(), identita: null, motore: process.env.BANCO_PLACES === 'new' ? 'new' : 'legacy', giornoSimulato: E.giornoSimulato, casi: [], costo: null };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };

// ─── Il fetch che conta e annota (come banco.live.js) ────────────────────────
const realFetch = globalThis.fetch;
const cont = { ai: 0, tokenIn: 0, tokenOut: 0, google: {}, googleListaHit: 0, perModello: {}, ripieghi: [] };
// C10b2 — i token di ogni modello (il prezzo cambia da un modello all'altro)
const segnaToken = (modello, usage) => {
    const m = modello || 'gpt-4o-mini';
    const t = cont.perModello[m] || (cont.perModello[m] = { in: 0, out: 0 });
    t.in += usage?.prompt_tokens || 0; t.out += usage?.completion_tokens || 0;
    cont.tokenIn += usage?.prompt_tokens || 0; cont.tokenOut += usage?.completion_tokens || 0;
};
const luoghi = new Map();
// MIG-PLACES — i posti visti nelle ricerche del caso in corso (per contare candidati e orari noti).
let vistiCaso = new Set();
const annota = (p, query) => {
    const id = p?.place_id;
    if (!id) return;
    const l = luoghi.get(id) || { queries: new Set() };
    // Con la ricerca nuova il proxy porta gli orari (opening_hours.periods), il tipo principale e il fuso.
    if (Array.isArray(p.opening_hours?.periods)) l.periods = p.opening_hours.periods;
    // ORARI-FESTIVI — gli orari dei prossimi 7 giorni, per data
    if (p.current_opening_hours && Array.isArray(p.current_opening_hours.periods)) l.current = p.current_opening_hours;
    if (p.primary_type) l.primaryType = p.primary_type;
    if (Number.isFinite(p.utc_offset_minutes)) l.utcOffsetMinutes = p.utc_offset_minutes;
    if (Number.isFinite(p.user_ratings_total)) l.recensioni = p.user_ratings_total;
    if (Number.isFinite(p.price_level)) l.priceLevel = p.price_level;
    if (Array.isArray(p.types)) l.types = p.types;
    if (query) l.queries.add(query.toLowerCase());
    luoghi.set(id, l);
};
// MIG-PLACES — BANCO_PLACES=new: le ricerche dei posti chiedono la API nuova. Lo fa SOLO il banco:
// `engine=new` + il token dell'account di prova (il proxy lo onora solo per lui); l'app non manda ne' l'uno ne' l'altro.
const MOTORE = process.env.BANCO_PLACES === 'new' ? 'new' : 'legacy';
globalThis.fetch = vi.fn(async (url, init) => {
    let u = String(url);
    let nuova = false;
    if (MOTORE === 'new' && u.includes('places-proxy') && /[?&]path=place(%2F|\/)textsearch/.test(u)) {
        const { data } = await supabase.auth.getSession();
        u = `${u}&engine=new`;
        init = { ...(init || {}), headers: { ...(init?.headers || {}), Authorization: `Bearer ${data?.session?.access_token}` } };
        nuova = true;
    }
    const res = await realFetch(u, init);
    if (u.includes('places-proxy')) {
        let params = null;
        try { params = new URL(u, 'http://x').searchParams; } catch { /* url strano */ }
        const k = params?.get('path') || 'altro';
        // la ricerca nuova costa un'altra fascia (Enterprise): chiave propria nel listino
        const kc = nuova ? `${k}#new` : k;
        cont.google[kc] = (cont.google[kc] || 0) + 1;
        if (k !== 'place/photo' && k !== 'place/details') {
            try {
                const j = await res.clone().json();
                for (const p of j?.results || []) { annota(p, params?.get('query')); if (p?.place_id) vistiCaso.add(p.place_id); }
                for (const p of j?.candidates || []) annota(p, params?.get('input'));
            } catch { /* non JSON */ }
        }
    }
    if (u.includes('openai-proxy')) {
        try {
            const j = await res.clone().json();
            const ck = j?.cityKnowledge;
            if (ck) {
                // i posti della lista arrivano col loro dato di Google: tipo principale e orari servono ai controlli (pasto, c5)
                for (const v of ck.verificati || []) annota(v, null);
                // C10 — la lista della città: una chiamata AI e le verifiche su Google le fa il SERVER (solo la prima volta del
                // giorno); il proxy dice quante sono, e qui si contano come se le avesse fatte il client (stesso listino).
                if (!ck.cached) {
                    cont.ai++;
                    // C10b2 — ogni chiamata della lista col suo modello (e i ripieghi)
                    if (Array.isArray(ck.modelli) && ck.modelli.length) for (const x of ck.modelli) { segnaToken(x.usato, x.usage); if (x.ripiego) cont.ripieghi.push({ passaggio: x.passaggio, cosa: x.cosa, motivo: x.motivo }); }
                    else segnaToken('gpt-4o-mini', ck.usage);
                }
                if (ck.google) {
                    cont.google['place/textsearch#new'] = (cont.google['place/textsearch#new'] || 0) + (ck.google.textsearch || 0);
                    cont.google['place/findplacefromtext'] = (cont.google['place/findplacefromtext'] || 0) + (ck.google.findplace || 0);
                    cont.googleListaHit += ck.google.hit || 0;
                }
            } else {
                cont.ai++;
                segnaToken(j?._modello?.usato, j?.usage);
                if (j?._modello?.ripiego) cont.ripieghi.push({ passaggio: j._modello.passaggio, motivo: j._modello.motivo });
            }
        } catch { cont.ai++; /* stream o errore */ }
    }
    return res;
});

// C10b — le citta' che hanno gia' la lista in questo giro (il primo tour la paga) e il tetto superato.
const cittaGiaListate = new Set();
let oltreTetto = false;

// Costo corrente (token + Google contati; le foto le carica il browser, non lo script).
const P = config.prezziUsd;
const costoOra = () => Object.entries(cont.perModello).reduce((a, [m, t]) => {
    const pr = P.openaiPerModello?.[m] || { input: P.openaiInputPerMilione, output: P.openaiOutputPerMilione };
    return a + ((t.in || 0) * pr.input + (t.out || 0) * pr.output) / 1e6;
}, 0) + Object.entries(cont.google).reduce((a, [k, n]) => a + n * (P.google[k] ?? P.google.altro), 0);

beforeAll(async () => {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    if (!email || !password) throw new Error("mancano le credenziali dell'account di prova in .env.local");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) throw new Error(`login dell'account di prova fallito: ${error?.status || ''} ${error?.code || 'nessuna sessione'}`);
    out.identita = 'account di prova';
    console.log(`[banco-esteso] account di prova | ${casi.length} casi | giorno simulato ${E.giornoSimulato} | risultato: ${OUT}`);
    save();
});
afterAll(async () => {
    out.fine = new Date().toISOString();
    out.costo = { totale: costoOra(), ai: { chiamate: cont.ai, tokenIn: cont.tokenIn, tokenOut: cont.tokenOut, perModello: cont.perModello, ripieghi: cont.ripieghi }, google: cont.google, tettoUsd: E.tettoUsd };
    save();
    await supabase.auth.signOut();
});

const GRUPPO_ID = { Solo: 'solo', 'In coppia': 'coppia', 'Con gli amici': 'amici', 'In famiglia': 'famiglia' };

// Una tappa: la riga della prova reale + quello che servono ai controlli.
const tappa = (s, fatti, comp, riempite, dieta, atStimato) => {
    const r = conComposizione({ place_id: s.place_id, ...row(s, fatti, riempite) }, comp, fatti);
    const l = luoghi.get(s.place_id) || { queries: new Set() };
    const frasi = String(r.description || '').split(/(?<=[.!?])\s+/).filter(Boolean).map(f => ({ testo: f, problemi: voiceIssues(f) }));
    const types = l.types || s.types || [];
    const parole = dieta.flatMap(d => [DIETE[d]?.criterio, ...(DIETE[d]?.parole || [])].filter(Boolean));
    const qs = [...l.queries];
    const conDieta = (q) => parole.some(w => q.includes(w));
    return {
        place_id: s.place_id, title: r.title, types, moment: r.moment, at: r.at || atStimato || null, atStimato: !r.at && !!atStimato,
        ...(s.tempoLibero ? { tempoLibero: true } : {}),
        // C8a — la passeggiata fra il drink e la cena
        ...(s.passeggiata ? { passeggiata: true } : {}),
        lat: s.latitude ?? null, lng: s.longitude ?? null, min: r.min, scelta: r.scelta, stay: s.stayMinutes ?? null,
        ripiego: s._tracciato?.ripiego || null, motivo: r.motivo || null, famiglia: r.famiglia,
        incrocio: s._tracciato?.incrocio || null, daPartenza: s._tracciato?.daPartenza || null,
        varieta: s._tracciato?.varieta || null, deviazioneProva: s._tracciato?.deviazioneProva || null,
        description: r.description, verita: r.verita, voce: r.voce, frasi, fatti: (fatti || []).length,
        recensioni: l.recensioni ?? null, priceLevel: l.priceLevel ?? null,
        // C7 — il tipo principale decide cosa e' un pasto (un cocktail bar marcato anche `restaurant` e' un bar)
        pasto: isMealPlace({ types, primaryType: l.primaryType ?? s.primaryType, name: r.title, title: r.title }),
        ...((l.primaryType ?? s.primaryType) ? { primaryType: l.primaryType ?? s.primaryType } : {}),
        // TESTI — il tipo interno della tappa e l'etichetta che la schermata mostra (dal tipo principale; null = nessuna etichetta)
        ...(s.type ? { tipoInterno: s.type } : {}),
        etichetta: s.tempoLibero ? null : typeLabelOf({ ...s, primaryType: s.primaryType ?? l.primaryType }),
        // C6a — il nome originale di Google, se il nome mostrato e' stato ripulito dalle code commerciali
        ...(s._tracciato?.nomeOriginale ? { nomeOriginale: s._tracciato.nomeOriginale } : {}),
        // ORARI — il motore segna se l'orario del posto e' noto (aperto per tutta la sosta) o sconosciuto
        ...(s._orario || s._tracciato?.orario ? { orario: s._orario ?? s._tracciato.orario } : {}),
        // ORARI-FESTIVI — da quale orario viene il verdetto del motore ('orario del giorno' | 'orario della settimana')
        ...(s._orarioFonte || s._tracciato?.orarioFonte ? { orarioFonte: s._orarioFonte ?? s._tracciato.orarioFonte } : {}),
        // C7 — cosa ha voluto il tema (pasto del tema / esperienza), "tipico" (locale o no, e perche'), il momento chiesto dal testo
        ...(s._tracciato?.tema ? { tema: s._tracciato.tema } : {}),
        ...(s._tracciato?.tipico ? { tipico: s._tracciato.tipico } : {}),
        ...(s._tracciato?.esplicito ? { esplicito: s._tracciato.esplicito } : {}),
        dietaCercata: parole.length ? qs.some(conDieta) : null,
        dietaSolo: parole.length ? (qs.length > 0 && qs.every(conDieta)) : null,
    };
};

const meteoApp = { condition: 'sunny', temperature: 20 }; // il valore di ripiego che le pagine passano (weatherCondition || 'sunny', temperatureC || 20)

async function genera(caso) {
    const now = istanteSimulato(caso, E);
    const cc = await resolveCityCenter(caso.luogo);
    const base = { skipUserQuota: true, simulatedNow: now }; // skipUserQuota: solo il preflight del client (vedi memoria test-acc-preflight)
    const onboarding = caso.onboarding || null;
    const food = resolveFoodPrefs({ userPrompt: caso.richiesta || '', wizardBudget: caso.prefs?.budget, onboarding });
    const rec = { vincoli: food.dieta?.length || food.budget ? { dieta: food.dieta, budget: food.budget, maxPriceLevel: food.maxPriceLevel } : null };
    let r;
    if (caso.modo === 'crea') {
        const prefs = { budget: '', duration: '', interests: [], group: '', pace: '', ...caso.prefs };
        rec.chiamata = { pagina: 'AiItinerary.jsx', pathType: 'custom', prefs, testo: caso.richiesta };
        // C10 — i profili A e B portano il loro DNA (con fiducia piena) e il profilo al selettore, come il banco nazionale
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, caso.richiesta, meteoApp, caso.dna ? weightsToAIProfile(caso.dna) : '', cc,
            { dnaWeights: caso.dna || {}, pathType: 'custom', onboardingPrefs: onboarding, ...base });
    } else if (caso.modo === 'veloce') {
        const s = caso.scelta;
        const durata = { Veloce: 'veloce', Medio: 'medio', Lungo: 'lungo' }[caso.durata];
        const prompt = buildPromptFromSelections({ main: s.main, sub: s.sub, duration: durata, group: GRUPPO_ID[caso.gruppo], city: caso.luogo });
        // C8a — ritmo e umore come la pagina: QuickPath passa al motore le preferenze di buildQuickPrefs (stessa funzione della pagina)
        const prefs = buildQuickPrefs({ main: s.main, mainTitle: s.mainTitle, subTitle: s.subTitle, durationTitle: caso.durata, groupTitle: caso.gruppo });
        rec.chiamata = { pagina: 'QuickPath.jsx', pathType: 'quick', prefs, testo: prompt };
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, prompt, meteoApp, '', cc,
            { dnaWeights: {}, pathType: 'quick', onboardingPrefs: onboarding, ...base });
    } else if (caso.modo === 'sorprendimi') {
        const prefs = { interests: caso.tema ? [caso.tema] : ['Arte', 'Cibo', 'Scoperte Urbane'], duration: 'Mezza Giornata' };
        const prompt = `Sei l'intelligenza di Unnivai. Genera un'esperienza a sorpresa esaltante a ${caso.luogo}.
            Categoria di oggi: ${caso.tema ? caso.tema : 'Mix delle sue più profonde passioni storiche'}.
            L'esperienza DEVE essere fuori dai soliti schemi turistici commerciali e sembrare magia pura, calzando i suoi gusti inconsci.
            NON inventare coordinate.`;
        rec.chiamata = { pagina: 'SurpriseTour.jsx', pathType: null, prefs, testo: prompt.replace(/\s+/g, ' ') };
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, prompt, {}, '', { latitude: cc.latitude, longitude: cc.longitude },
            { dnaWeights: {}, onboardingPrefs: onboarding, ...base });
    }
    return { r, rec, cc, now, food };
}

for (const caso of casi) {
    it(caso.id, async () => {
        const rec = { id: caso.id, modo: caso.modo, tipo: caso.modo === 'perte' ? 'perte' : 'itinerario', luogo: caso.luogo, ora: caso.ora,
            oggi: caso.giorno ?? E.giornoSimulato, richiesta: caso.richiesta || (caso.modo === 'veloce' ? null : caso.tema || null), onboarding: caso.onboarding || null };
        out.casi.push(rec);
        // Con la ricerca nuova non c'e' la fase dei dettagli per gli orari: le generazioni possono usare tutto il tetto.
        const tettoGen = MOTORE === 'new' ? (Number(process.env.BANCO_TETTO) || E.tettoUsd) : E.tettoGenerazioniUsd;
        // C10b — PRIMA di lanciare: la stima del caso (un tour, piu' la lista nuova se e' il primo tour della citta' in questo
        // giro) deve stare nel tetto restante; DOPO: se la spesa vera ha passato il tetto, i casi seguenti non partono.
        // BANCO_LISTE_PRONTE=1: le liste del giorno ci sono gia' (fatte prima del giro): nessun caso le paga
        const listaNuova = !process.env.BANCO_LISTE_PRONTE && caso.modo !== 'perte' && !cittaGiaListate.has(caso.luogo.toLowerCase());
        const stima = (E.stimaCaso?.tourUsd ?? 0.2) + (listaNuova ? (E.stimaCaso?.listaNuovaUsd ?? 0.75) : 0);
        rec.stimaUsd = Math.round(stima * 1000) / 1000;
        if (oltreTetto) { rec.saltato = `tetto superato da un caso precedente ($${costoOra().toFixed(3)} > $${tettoGen})`; save(); return; }
        if (costoOra() + stima > tettoGen) {
            rec.saltato = `stima oltre il tetto restante: $${stima.toFixed(3)} > $${(tettoGen - costoOra()).toFixed(3)} (spesi $${costoOra().toFixed(3)} su $${tettoGen})`;
            save(); return;
        }
        cittaGiaListate.add(caso.luogo.toLowerCase());
        // Ogni caso parte a cache vuota: le chiamate Google sono quelle di UNA generazione. La sessione (sb-*) resta.
        for (const k of Object.keys(window.localStorage)) if (!k.startsWith('sb-')) window.localStorage.removeItem(k);
        vistiCaso = new Set();
        const c0 = { ...cont, google: { ...cont.google }, perModello: JSON.parse(JSON.stringify(cont.perModello)), ripieghi: [...cont.ripieghi] };
        const costo0 = costoOra();
        const delta = () => ({
            ai: { chiamate: cont.ai - c0.ai, tokenIn: cont.tokenIn - c0.tokenIn, tokenOut: cont.tokenOut - c0.tokenOut,
                perModello: Object.fromEntries(Object.entries(cont.perModello).map(([m, t]) => [m, { in: t.in - (c0.perModello[m]?.in || 0), out: t.out - (c0.perModello[m]?.out || 0) }]).filter(([, t]) => t.in || t.out)),
                ripieghi: cont.ripieghi.slice(c0.ripieghi.length) },
            google: Object.fromEntries(Object.entries(cont.google).map(([k, v]) => [k, v - (c0.google[k] || 0)]).filter(([, v]) => v > 0)),
            googleListaHit: cont.googleListaHit - (c0.googleListaHit || 0),
        });
        const t0 = Date.now();
        try {
            if (caso.modo === 'perte') {
                const now = istanteSimulato(caso, E);
                const food = resolveFoodPrefs({ onboarding: caso.onboarding });
                if (food.dieta?.length || food.budget) rec.vincoli = { dieta: food.dieta, budget: food.budget, maxPriceLevel: food.maxPriceLevel };
                rec.chiamata = { pagina: 'DashboardUser.jsx', pathType: null, prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, testo: null };
                const cc = await resolveCityCenter(caso.luogo);
                // C8b — dalle 18:00 Per Te e' il giro della sera (nessuna ricerca per temi); prima la ricerca del cibo segue l'ora (colazione, merenda)
                const sera = isSeraStart(new Date(now));
                const themed = sera ? {} : await placesDiscoveryService.discoverAllThemes(caso.luogo, cc.latitude, cc.longitude, { foodPrefs: food, ora: new Date(now) });
                const insider = sera ? [] : buildInsiderPool(themed, cc, caso.luogo, undefined, { _share: 0 });
                const r = await aiRecommendationService.generateHomeTours({ city: caso.luogo, cityCenter: cc, themedCandidates: { insider, ...themed },
                    prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, aiProfile: '',
                    opts: { dnaWeights: { _share: 0 }, onboardingPrefs: caso.onboarding || null, skipUserQuota: true, simulatedNow: now } });
                rec.secs = (Date.now() - t0) / 1000;
                rec.source = r._source;
                rec.momento = r._report?.momento ?? null;
                rec.tourDate = E.giornoSimulato;
                rec.pool = Object.fromEntries(Object.entries({ insider, ...themed }).map(([k, arr]) => [k,
                    (Array.isArray(arr) ? arr : []).slice(0, 25).map(p => ({ place_id: p.place_id || p.googlePlaceId, nome: p.name || p.title, types: (p.types || []).slice(0, 4), rating: p.rating ?? null, recensioni: p.user_ratings_total ?? null }))]));
                const per = new Map((r._report?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const comp = new Map((r._report?.composizione || []).map(x => [x.place_id, x]));
                rec.serale = sera;
                if (sera) {
                    // C8b — di sera il giro e' quello del motore dei momenti: gli orari sono veri, valgono i controlli degli itinerari
                    rec.tipo = 'itinerario';
                    rec.finestraMinuti = r._report?.momentReport?.finestraMinuti ?? null;
                    rec.continuita = r._report?.momentReport?.continuita ?? null;
                    const mr = r._report?.momentReport; rec.motori = mr ? { tolti: mr.momentiTolti ?? null, facoltativiSenzaPosto: mr.facoltativiSenzaPosto ?? null, ricercheMirate: mr.ricercheMirate ?? null } : null;
                }
                rec.tours = (r.tours || []).map(t => {
                    // "Per Te" di giorno non ha orari: l'arrivo si stima da ora simulata + cammino + soste.
                    let t_ = new Date(now).getTime();
                    return { tema: t.themeType, titolo: t.title || null, stops: t.stops.map(s => {
                        t_ += (s.travelMinutesFromPrev || 0) * 60000;
                        const stimato = new Date(t_).toISOString();
                        t_ += (s.stayMinutes || 0) * 60000;
                        const x = tappa(s, per.get(s.place_id), comp, null, food.dieta || [], stimato);
                        // C8b — i controlli dei pasti valgono anche per Per Te: il momento si ricava dall'ora d'arrivo (la mattina e' prima di mezzogiorno)
                        if (!x.moment) { const hh = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date(x.at))); if (hh < 12) x.moment = 'mattina'; }
                        return x;
                    }) };
                });
                rec.schermo = { giorni: (rec.tours || []).map(t => ({ titolo: t.titolo, meteo: null })), note: r._source === 'closed-now' ? [r._messaggio] : [] };
                // ORARI — il messaggio "meglio domattina" al posto dei tour e' un ripiego dichiarato
                rec.ripiegoDichiarato = r._source === 'closed-now';
                if (r._source === 'closed-now') rec.chiusoOra = r._messaggio;
                rec.orariMotore = r._report?.orari ?? null;
            } else {
                const { r, rec: extra, food } = await genera(caso);
                Object.assign(rec, extra);
                rec.richiesta = rec.chiamata?.testo ?? rec.richiesta;
                rec.secs = (Date.now() - t0) / 1000;
                rec.source = r._source;
                rec.destinazione = r.destination ? { city: r.destination.city, fromText: r.destination.fromText, note: r.destination.note || null } : null;
                rec.tourDate = r.tourWindow?.date ?? null;
                rec.giorno = r.tourWindow ? { date: r.tourWindow.date, start: r.tourWindow.start, reason: r.tourWindow.reason } : null;
                rec.frasiTolte = r._narrationReport?.frasiTolte ?? null;
                rec.pool = r._momentReport?.pool ?? null;
                rec.finestraMinuti = r._momentReport?.finestraMinuti ?? null;
                rec.motori = r._momentReport ? { tolti: r._momentReport.momentiTolti ?? null, facoltativiSenzaPosto: r._momentReport.facoltativiSenzaPosto ?? null, ricercheMirate: r._momentReport.ricercheMirate ?? null } : null;
                rec.sceltaModello = r._momentReport?.sceltaModello ?? null;
                rec.ricerche = { prima: r._momentReport?.ricercheMirate ?? null, dopo: r._momentReport?.ricercheDopo ?? null };
                // ORARI — il messaggio "meglio domattina" al posto del giro e' un ripiego dichiarato
                rec.ripiegoDichiarato = !!(r._singleStop || r._queryDiBaseDopoVuoto || r._source === 'closed-now');
                if (r._source === 'closed-now') rec.chiusoOra = r._messaggio;
                rec.orariMotore = r._orari ?? null;
                // CONTINUITA' — le tappe aggiunte ai buchi e i buchi dichiarati, dal rapporto del motore
                rec.continuita = r._momentReport?.continuita ?? null;
                // C7 — il tema cibo, il tipico, le cucine estere escluse, le zone tolte, le ricerche mirate fatte
                rec.tema = r._momentReport?.tema ?? null;
                // C10 — la lista della città in questo giro (stato, dal server o nuova, verificati, nel pool, ancore, seminate)
                rec.citta = r._citta ?? null;
                // C10b2 — il modello di ogni passaggio di questo giro
                rec.modelli = r._modelli ?? null;
                if (caso.profilo) rec.profilo = caso.profilo;
                // TESTI — le sezioni come la schermata le intitola (groupStopsByDayAndMoment, la stessa funzione di AiItinerary e TourStopsByMoment) con l'ora della sua prima tappa
                const sezioni = (r.days || []).flatMap(d => groupStopsByDayAndMoment(d.stops || []).flatMap(g => g.groups))
                    .filter(g => g.moment).map(g => ({ etichetta: g.moment.label, ora: g.items[0]?.timeLabel ?? null }));
                rec.schermo = { giorni: (r.days || []).map(d => ({ titolo: d.title || null, meteo: d.weather ?? null })), sezioni,
                    note: [r.destination?.note, r._messaggio, ...(r.days || []).map(d => d.dietNote), ...(r.days || []).map(d => d.scalaNote)].filter(Boolean) };
                const per = new Map((r._narrationReport?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const comp = new Map((r._narrationReport?.composizione || []).map(x => [x.place_id, x]));
                const riempite = new Set((r._momentReport?.riempite || []).map(x => x.place_id));
                rec.tours = (r.days || []).map(d => ({ tema: d.title || null, stops: d.stops.map(s => tappa(s, per.get(s.place_id), comp, riempite, food.dieta || [], null)) }));
            }
        } catch (e) {
            rec.secs = (Date.now() - t0) / 1000;
            rec.errore = e?.code || e?.message || String(e);
        } finally {
            Object.assign(rec, delta());
            // C10b — il controllo dopo: la spesa vera del caso e il tetto
            rec.spesaUsd = Math.round((costoOra() - costo0) * 1000) / 1000;
            if (costoOra() > tettoGen) { oltreTetto = true; rec.oltreTetto = `dopo questo caso $${costoOra().toFixed(3)} > tetto $${tettoGen}`; }
            // MIG-PLACES — candidati visti dalle ricerche del caso, e quanti con orari settimanali
            rec.candidatiVisti = vistiCaso.size;
            rec.candidatiConOrari = [...vistiCaso].filter(id => luoghi.get(id)?.periods).length;
            save();
        }
    });
}

// ─── Gli orari di apertura dei posti scelti (place/details, opening_hours) ───
// Il pool porta solo `open_now` (textsearch), non i periodi: gli orari si prendono
// QUI, dopo la generazione, una volta per place_id, nell'ordine in cui un orario
// sbagliato fa piu' male (dove si mangia e si beve, poi musei e negozi, poi il resto),
// finche' il tetto di spesa lo consente. Quelli non richiesti restano "sconosciuti".
const PRIORITA = (s) => {
    const t = s.types || [];
    if (s.pasto || t.some(x => ['restaurant', 'food', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'night_club', 'ice_cream_shop'].includes(x))) return 0;
    if (t.some(x => ['museum', 'art_gallery', 'store', 'clothing_store', 'book_store', 'shopping_mall'].includes(x))) return 1;
    return 2;
};
it('orari', async () => {
    if (MOTORE === 'new') {
        // MIG-PLACES — gli orari sono gia' arrivati con la ricerca: nessuna chiamata in piu'.
        // Per ogni caso, gli orari dei posti scelti (periods null = Google non li ha) e, in `luoghiOrari`,
        // quelli di TUTTI i posti visti: servono al confronto sulla copertura del pool.
        for (const c of out.casi) {
            c.orari = Object.fromEntries((c.tours || []).flatMap(t => t.stops || []).filter(s => s.place_id)
                .map(s => [s.place_id, { chiamato: true, periods: luoghi.get(s.place_id)?.periods ?? null, ...(luoghi.get(s.place_id)?.current ? { current: luoghi.get(s.place_id).current } : {}) }]));
        }
        out.luoghiOrari = Object.fromEntries([...luoghi.entries()].map(([id, l]) => [id, { periods: l.periods ?? null, primaryType: l.primaryType ?? null, utcOffsetMinutes: l.utcOffsetMinutes ?? null, ...(l.current ? { current: l.current } : {}) }]));
        const tutti = Object.values(out.luoghiOrari);
        out.orariRiepilogo = { postiDistinti: tutti.length, chiamati: 0, nonRichiesti: 0, senzaOrari: tutti.filter(o => !o.periods).length, daRicerca: true };
        save();
        return;
    }
    const tutte = out.casi.flatMap(c => (c.tours || []).flatMap(t => t.stops || [])).filter(s => !s.tempoLibero && s.place_id);
    const ordine = new Map();
    for (const s of tutte) if (!ordine.has(s.place_id) || PRIORITA(s) < ordine.get(s.place_id).p) ordine.set(s.place_id, { p: PRIORITA(s) });
    const ids = [...ordine.entries()].sort((a, b) => a[1].p - b[1].p).map(([id]) => id);
    const orari = {};
    const prezzo = P.google['place/details'];
    let i = 0;
    while (i < ids.length) {
        const lotto = ids.slice(i, i + 5);
        if (costoOra() + lotto.length * prezzo > E.tettoUsd) break;
        await Promise.all(lotto.map(async (id) => {
            try {
                const res = await fetch(buildPlacesProxyUrl({ path: 'place/details', place_id: id, fields: 'opening_hours' }));
                const j = res.ok ? await res.json() : null;
                const oh = j?.result?.opening_hours;
                orari[id] = { chiamato: true, periods: Array.isArray(oh?.periods) && oh.periods.length ? oh.periods : null };
            } catch { orari[id] = { chiamato: true, periods: null, errore: true }; }
        }));
        i += lotto.length;
    }
    for (const id of ids.slice(i)) orari[id] = { chiamato: false, periods: null };
    for (const c of out.casi) c.orari = Object.fromEntries((c.tours || []).flatMap(t => t.stops || []).filter(s => s.place_id && orari[s.place_id]).map(s => [s.place_id, orari[s.place_id]]));
    out.orariRiepilogo = { postiDistinti: ids.length, chiamati: i, nonRichiesti: ids.length - i, senzaOrari: Object.values(orari).filter(o => o.chiamato && !o.periods).length };
    save();
});
