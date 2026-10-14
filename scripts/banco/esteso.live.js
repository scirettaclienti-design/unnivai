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
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService, buildInsiderPool, buildPlacesProxyUrl } from '@/services/aiRecommendationService';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { resolveCityCenter } from '@/services/cityCenterService';
import { resolveFoodPrefs } from '@/lib/foodPrefs';
import { isSeraStart } from '@/lib/daySkeleton';
import config from './banco.config.json';
import { CASI_ESTESI, istanteSimulato } from './casi-esteso.js';
import { creaLuoghi, annotaRisposta, tappa as tappaDi, genera, registraItinerario, recordCaso } from './giro-caso.js';
import { FORMATO, creaRegistratore, fattiRegistrati } from './replay/rete.js';

// C10c-replay — i fatti aperti delle tappe si registrano (per place_id) per il replay: la funzione vera gira com'e'.
vi.mock('@/services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (...args) => {
        const res = await m.fetchFactsForStops(...args);
        try { globalThis.__bancoFatti?.(res); } catch { /* solo registrazione */ }
        return res;
    } };
});

const OUT = process.env.BANCO_OUT;
if (!OUT) throw new Error('BANCO_OUT mancante: lancia il banco esteso con `npm run banco:esteso`');
// C10c-replay — il tracciato di ogni caso (risposte dei proxy e fatti), accanto al grezzo: `npm run banco:replay` lo rigioca a 0 $.
const TRACCIATI = process.env.BANCO_TRACCIATI || OUT.replace(/\.json$/, '-tracciati.json.gz');
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
const commitGiro = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return null; } })();
const tracciati = { formato: FORMATO, registrato: out.avvio, commit: commitGiro, motore: out.motore, giornoSimulato: E.giornoSimulato, casi: [] };
const save = () => {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(out, null, 1));
    if (tracciati.casi.length) writeFileSync(TRACCIATI, gzipSync(JSON.stringify(tracciati)));
};
// C10c-replay — il registratore del caso in corso (risposte dei proxy) e i fatti delle sue tappe
let registratore = null;
let fattiCaso = null;
globalThis.__bancoFatti = (res) => { if (fattiCaso) Object.assign(fattiCaso, fattiRegistrati(res)); };

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
const registro = creaLuoghi();
const { luoghi } = registro;
const tappa = (...a) => tappaDi(luoghi, ...a);
// MIG-PLACES — i posti visti nelle ricerche del caso in corso (per contare candidati e orari noti).
let vistiCaso = new Set();
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
        if (k !== 'place/photo') {
            try {
                const j = await res.clone().json();
                for (const id of annotaRisposta(registro, u, j)) vistiCaso.add(id);
                // C10c-replay — la risposta nel tracciato del caso (chiave senza `engine`, nessuna intestazione)
                registratore?.annota(u, init, res.status, j);
            } catch { /* non JSON */ }
        }
    }
    if (u.includes('openai-proxy')) {
        try {
            const j = await res.clone().json();
            registratore?.annota(u, init, res.status, j);
            const ck = j?.cityKnowledge;
            if (ck) {
                // i posti della lista arrivano col loro dato di Google: tipo principale e orari servono ai controlli (pasto, c5)
                annotaRisposta(registro, u, j);
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

for (const caso of casi) {
    it(caso.id, async () => {
        const rec = recordCaso(caso, E);
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
        // C10c-replay — il tracciato del caso: il caso, l'ora simulata, le risposte dei proxy, i fatti delle tappe
        registratore = creaRegistratore();
        fattiCaso = {};
        const traccia = { id: caso.id, caso, ora: istanteSimulato(caso, E), rete: registratore.rete, fatti: fattiCaso };
        tracciati.casi.push(traccia);
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
                const g = await genera(caso, E);
                rec.secs = (Date.now() - t0) / 1000;
                registraItinerario(rec, g, caso, luoghi);
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
            if (rec.errore) traccia.errore = rec.errore;
            registratore = null;
            fattiCaso = null;
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
