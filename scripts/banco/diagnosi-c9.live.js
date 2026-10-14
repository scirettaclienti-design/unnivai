// C9-DIAGNOSI — il giro di Ivano (Crea, «Domani un giorno da catanese», Catania, mercoledi' 14/10 22:19) con l'account di prova.
//
// Due modi, stesso motore, stesso codice (nessuna modifica al motore):
//   C9_MODE=record   chiamate vere (Google e AI) e REGISTRAZIONE di ogni risposta del proxy: costa ~0,2 $ (listino del banco).
//   C9_MODE=replay   le risposte registrate al posto della rete: 0 $. Una chiamata non registrata e' un errore dichiarato, mai una chiamata vera.
// Variabili: C9_OUT (risultato JSON), C9_FIXTURE (le risposte registrate: scritte in record, lette in replay).
//
// Non si lancia da solo: npx vitest run -c scripts/banco/vitest.c9.config.js
import { it, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { resolveCityCenter } from '@/services/cityCenterService';
import config from './banco.config.json';

// ─── Tracciatura: le funzioni del motore sono avvolte SOLO in questo test, per vedere cosa entra e cosa esce ───
// (nessun file del motore e' toccato; la funzione originale gira com'e' e il risultato e' lo stesso)
vi.mock('@/services/candidateScoring', async (importOriginal) => {
    const m = await importOriginal();
    // VARIANTE (solo esperimento, dichiarata): i luoghi famosi (non pasti, sopra una soglia di recensioni) prendono un bonus di merito
    const famosi = (c) => {
        const f = globalThis.__c9?.variante?.famosi;
        if (!f) return 0;
        const locale = (c.types || []).some(t => ['restaurant', 'food', 'bar', 'cafe', 'bakery', 'meal_takeaway', 'night_club'].includes(t));
        return !locale && (c.user_ratings_total || 0) >= f.soglia ? f.valore : 0;
    };
    return { ...m, computeCandidateScore: (c, pool, w) => m.computeCandidateScore(c, pool, w) + famosi(c), selectScoredCandidatePool: (cands, o = {}) => {
        const v = globalThis.__c9?.variante;
        const base = v && o.limit >= 20 ? { ...o, ...(v.maxIcons != null ? { maxIcons: v.maxIcons } : {}), ...(v.limite != null ? { limit: v.limite } : {}) } : o;
        const opts = v?.famosi ? { ...base, bonus: (c) => (o.bonus ? o.bonus(c) : 0) + famosi(c) } : base;
        const out = m.selectScoredCandidatePool(cands, opts);
        try { globalThis.__c9?.merito?.(cands, opts, out, m); } catch (e) { globalThis.__c9?.errori?.push(String(e)); }
        return out;
    } };
});
vi.mock('@/services/momentSelection', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, repairMomentSelection: (args) => {
        const res = m.repairMomentSelection(args);
        try { globalThis.__c9?.repair?.(args, res); } catch (e) { globalThis.__c9?.errori?.push(String(e)); }
        return res;
    } };
});

const OUT = process.env.C9_OUT;
const FIX = process.env.C9_FIXTURE;
const MODE = process.env.C9_MODE === 'replay' ? 'replay' : process.env.C9_MODE === 'extra' ? 'extra' : 'record';
const EXTRA = process.env.C9_EXTRA; // risposte registrate in piu' (modo extra le scrive; replay le legge)
if (!OUT || !FIX) throw new Error('C9_OUT e C9_FIXTURE mancanti');

// I parametri esatti che la pagina Crea (AiItinerary.jsx) passa al motore, con solo testo e durata:
//   prefsObject = { budget:'', duration:'1 Giorno', interests:[], group:'', pace:'' }   (i cinque `userPreferences`, uno scelto)
//   userPrompt  = 'Domani un giorno da catanese'
//   meteo       = { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 }  → il ripiego 'sunny'/20 del banco
//   aiProfile   = ''   (nessun grafo preferenze né DNA: l'account di prova non ne ha)
//   cityCenter  = resolveCityCenter('Catania')
//   opts        = { dnaWeights: {}, pathType: 'custom', onboardingPrefs: null }  + (solo banco) { skipUserQuota, simulatedNow }
const CASO = {
    id: 'c9-catania-domani-da-catanese', luogo: 'Catania', oggi: '2026-10-14', ora: '22:19', fuso: '+02:00',
    richiesta: 'Domani un giorno da catanese',
    prefs: { budget: '', duration: '1 Giorno', interests: [], group: '', pace: '' },
};
const NOW = `${CASO.oggi}T${CASO.ora}:00${CASO.fuso}`;

const out = { avvio: new Date().toISOString(), modo: MODE, caso: CASO, chiamata: null, risultato: null, log: [], proxy: [], mancanti: [], costo: null };
const save = () => { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1)); };

// ─── Le chiamate ai proxy: registrate (record) o servite dal file (replay) ───
const realFetch = globalThis.fetch;
const fixture = MODE === 'replay' ? JSON.parse(readFileSync(FIX, 'utf8')) : { registrato: new Date().toISOString(), risposte: {} };
if (MODE === 'replay' && EXTRA) for (const f of EXTRA.split(',')) { try { Object.assign(fixture.risposte, JSON.parse(readFileSync(f, 'utf8')).risposte); } catch { /* nessun extra */ } }
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const chiaveDi = (u, init) => {
    const url = new URL(u, 'http://x');
    if (u.includes('places-proxy')) {
        const e = [...url.searchParams.entries()].filter(([k]) => k !== 'key' && k !== 'engine').sort(([a], [b]) => a.localeCompare(b));
        return `places|${e.map(([k, v]) => `${k}=${v}`).join('&')}`;
    }
    // La richiesta AI porta un `dv.ticket` casuale per ogni generazione: non fa parte della chiave.
    let corpo = String(init?.body ?? '');
    try { const j = JSON.parse(corpo); delete j.dv; corpo = JSON.stringify(j); } catch { /* non JSON */ }
    return `ai|${sha(corpo)}`;
};
// Il tipo di una chiamata AI dalla sua richiesta (traduttore, selettore, narratore) e dalla sua risposta registrata.
const tipoRichiesta = (body) => {
    const t = String(body || '');
    if (t.includes('traduttore di intenti')) return 'traduttore';
    if (t.includes('"moment"') || t.includes('g1-') || t.includes('ESATTAMENTE')) return 'selettore';
    return 'narratore';
};
const tipoRisposta = (corpo) => {
    const c = (corpo?.choices?.[0]?.message?.content) || '';
    if (c.includes('"queries"')) return 'traduttore';
    if (c.includes('"days"')) return 'narratore';
    if (c.includes('"stops"')) return 'selettore';
    return 'altro';
};
const servite = {};
const senzaFoto = (j) => {
    // le foto non servono alle decisioni del motore: si tiene solo il primo riferimento
    for (const r of j?.results || []) if (Array.isArray(r.photos)) r.photos = r.photos.slice(0, 1);
    return j;
};
const cont = { ai: 0, tokenIn: 0, tokenOut: 0, google: {}, googleHit: {} };
globalThis.fetch = vi.fn(async (url, init) => {
    const u = String(url);
    const proxy = u.includes('places-proxy') ? 'places' : u.includes('openai-proxy') ? 'ai' : null;
    if (!proxy) return realFetch(url, init); // Supabase (quota, profilo): non costa e non e' del pool
    const params = (() => { try { return new URL(u, 'http://x').searchParams; } catch { return null; } })();
    const path_ = params?.get('path') || null;
    if (proxy === 'places' && path_ === 'place/photo') return new Response('', { status: 204 });
    const k = chiaveDi(u, init);
    if (MODE === 'replay') {
        let r = fixture.risposte[k];
        if (!r && proxy === 'ai') {
            // file registrato senza corpi di richiesta: la risposta del tipo giusto, nell'ordine registrato
            const tipo = tipoRichiesta(init?.body);
            const candidate = Object.entries(fixture.risposte).filter(([kk, v]) => kk.startsWith('ai|') && tipoRisposta(v.corpo) === tipo);
            const n = servite[tipo] = (servite[tipo] || 0) + 1;
            r = candidate[Math.min(n, candidate.length) - 1]?.[1];
            if (r) out.proxy.push({ tipo: 'ai', fallback: tipo });
        }
        // VARIANTI (solo esperimenti, dichiarate nel report): le query del traduttore, o il selettore che non sceglie (decide il codice per merito)
        if (r && proxy === 'ai') {
            const tipo = tipoRisposta(r.corpo);
            if (tipo === 'traduttore' && process.env.C9_QUERIES) {
                const j = JSON.parse(r.corpo.choices[0].message.content);
                j.queries = process.env.C9_QUERIES.split('|');
                r = { ...r, corpo: { ...r.corpo, choices: [{ ...r.corpo.choices[0], message: { ...r.corpo.choices[0].message, content: JSON.stringify(j) } }] } };
            }
            if (tipo === 'selettore' && process.env.C9_SELETTORE === 'codice') {
                r = { ...r, corpo: { ...r.corpo, choices: [{ ...r.corpo.choices[0], message: { ...r.corpo.choices[0].message, content: JSON.stringify({ stops: [] }) } }] } };
            }
        }
        if (!r) { out.mancanti.push(k.slice(0, 300)); out.corpiMancanti = [...(out.corpiMancanti || []), String(init?.body ?? '').slice(0, 20000)]; return new Response(JSON.stringify({ status: 'NON_REGISTRATA' }), { status: 599 }); }
        out.proxy.push({ tipo: proxy, path: path_, query: params?.get('query') ?? null, radius: params?.get('radius') ?? null, location: params?.get('location') ?? null, n: r.corpo?.results?.length ?? null, cache: 'replay' });
        return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    const res = await realFetch(url, init);
    let corpo = null;
    try { corpo = await res.clone().json(); } catch { /* non JSON */ }
    const cache = res.headers.get('X-Cache');
    fixture.risposte[k] = { richiesta: proxy === 'ai' ? String(init?.body ?? '') : undefined, status: res.status, corpo: proxy === 'places' ? senzaFoto(corpo) : corpo, engine: res.headers.get('X-Engine'), cache };
    out.proxy.push({ tipo: proxy, path: path_, query: params?.get('query') ?? null, radius: params?.get('radius') ?? null, location: params?.get('location') ?? null,
        n: corpo?.results?.length ?? null, status: corpo?.status ?? res.status, cache, engine: res.headers.get('X-Engine') });
    if (proxy === 'places') {
        cont.google[path_ || 'altro'] = (cont.google[path_ || 'altro'] || 0) + 1;
        if (cache === 'HIT') cont.googleHit[path_ || 'altro'] = (cont.googleHit[path_ || 'altro'] || 0) + 1;
    } else { cont.ai++; cont.tokenIn += corpo?.usage?.prompt_tokens || 0; cont.tokenOut += corpo?.usage?.completion_tokens || 0; }
    mkdirSync(path.dirname(FIX), { recursive: true });
    writeFileSync(FIX, JSON.stringify(fixture));
    return res;
});

// Il motore scrive nel log cosa scarta ([AI-radius], [Qualita], [C7 ZONE], [Gate …]): lo si tiene.
for (const lv of ['log', 'info', 'warn']) {
    const orig = console[lv].bind(console);
    console[lv] = (...a) => {
        const s = a.map(x => (typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(' ');
        if (out.log.length < 4000) out.log.push(`${lv}: ${s.slice(0, 600)}`);
        orig(...a);
    };
}


// ─── Gli appunti della tracciatura ───
const idDi = (c) => c?.place_id || c?.googlePlaceId || c?.name;
out.meriti = [];
out.riparazioni = [];
out.erroriTraccia = [];
globalThis.__c9 = {
    variante: (process.env.C9_MAXICONS || process.env.C9_LIMITE || process.env.C9_FAMOSI)
        ? { ...(process.env.C9_MAXICONS ? { maxIcons: Number(process.env.C9_MAXICONS) } : {}), ...(process.env.C9_LIMITE ? { limite: Number(process.env.C9_LIMITE) } : {}),
            ...(process.env.C9_FAMOSI ? { famosi: { soglia: Number(process.env.C9_FAMOSI.split(':')[0]), valore: Number(process.env.C9_FAMOSI.split(':')[1]) } } : {}) } : null,
    errori: out.erroriTraccia,
    // il Gate MERITO: chi entra, con quale punteggio, quale e' un'icona, chi esce e perche'
    merito: (cands, o, outPool, m) => {
        const lista = (Array.isArray(cands) ? cands : []);
        const pool = lista.filter(c => m.passesQualityThreshold(c, o.city));
        const icone = m.identifyIcons(pool);
        const dentro = new Set(outPool.map(idDi));
        out.meriti.push({
            limite: o.limit, maxIcons: o.maxIcons ?? 1, ingresso: lista.length, sopraSoglia: pool.length, ammessi: outPool.length,
            icone: [...icone].length,
            candidati: lista.map(c => {
                const soprasoglia = m.passesQualityThreshold(c, o.city);
                const punteggio = soprasoglia ? m.computeCandidateScore(c, pool, o.dnaWeights || {}) + (o.bonus ? o.bonus(c) : 0) : null;
                return { place_id: c.place_id ?? null, nome: c.name || c.title, tipoPrincipale: c.primaryType ?? c.primary_type ?? null, rating: c.rating ?? null, recensioni: c.user_ratings_total ?? null,
                    sopraSoglia: soprasoglia, icona: icone.has(idDi(c)), punteggio: punteggio == null ? null : Math.round(punteggio * 1000) / 1000, ammesso: dentro.has(idDi(c)),
                    lat: c.latitude ?? c.lat ?? null, lng: c.longitude ?? c.lng ?? null, types: c.types || [] };
            }),
        });
    },
    // ogni ripartizione dei momenti (compresi i tentativi di fillGaps): quante tappe per momento e perche' qualcuno non e' entrato
    repair: (args, res) => {
        const rep = res?.report || {};
        out.riparazioni.push({
            n: out.riparazioni.length + 1,
            tappe: Object.fromEntries((args.moments || []).map(m => [m.id, m.stops])),
            riempite: (rep.riempite || []).map(x => ({ nome: x.name, momento: x.momento })),
            scartate: rep.scartate || [],
            tempoLibero: (rep.tempoLibero || []).map(x => ({ momento: x.momento, buco: x.buco ?? null, motivo: x.motivo })),
            pool: Object.fromEntries(Object.entries(rep.pool || {}).map(([k, v]) => [k, (v.candidati || []).map(c => ({ nome: c.nome, famiglia: c.famiglia, minuti: c.minuti, scelto: c.scelto, motivo: c.motivo }))])),
        });
    },
};

const P = config.prezziUsd;
const costoListino = () => (cont.tokenIn * P.openaiInputPerMilione + cont.tokenOut * P.openaiOutputPerMilione) / 1e6
    + Object.entries(cont.google).reduce((a, [k, n]) => a + n * (P.google[k] ?? P.google.altro), 0);
const costoReale = () => (cont.tokenIn * P.openaiInputPerMilione + cont.tokenOut * P.openaiOutputPerMilione) / 1e6
    + Object.entries(cont.google).reduce((a, [k, n]) => a + (n - (cont.googleHit[k] || 0)) * (P.google[`${k}#new`] ?? P.google[k] ?? P.google.altro), 0);

beforeAll(async () => {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    if (!email || !password) throw new Error("mancano le credenziali dell'account di prova in .env.local");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) throw new Error(`login dell'account di prova fallito: ${error?.status || ''} ${error?.code || 'nessuna sessione'}`);
    save();
});
afterAll(async () => {
    out.fine = new Date().toISOString();
    out.costo = { listino: costoListino(), reale: costoReale(), ai: { chiamate: cont.ai, tokenIn: cont.tokenIn, tokenOut: cont.tokenOut }, google: cont.google, googleDallaCache: cont.googleHit };
    save();
    await supabase.auth.signOut();
});

it.skipIf(MODE === 'extra')(CASO.id, async () => {
    for (const k of Object.keys(window.localStorage)) if (!k.startsWith('sb-')) window.localStorage.removeItem(k);
    const cc = await resolveCityCenter(CASO.luogo);
    out.chiamata = { pagina: 'AiItinerary.jsx', pathType: 'custom', prefs: CASO.prefs, testo: CASO.richiesta, meteo: { condition: 'sunny', temperature: 20 }, aiProfile: '',
        cityCenter: { latitude: cc.latitude, longitude: cc.longitude, isSmallTown: cc.isSmallTown ?? null, radiusKm: cc.radiusKm ?? null }, ora: NOW };
    const t0 = Date.now();
    const r = await aiRecommendationService.generateItinerary(CASO.luogo, CASO.prefs, CASO.richiesta, { condition: 'sunny', temperature: 20 }, '', cc,
        { dnaWeights: {}, pathType: 'custom', onboardingPrefs: null, skipUserQuota: true, simulatedNow: NOW });
    out.secs = (Date.now() - t0) / 1000;
    out.risultato = {
        source: r._source, destinazione: r.destination ? { city: r.destination.city, fromText: r.destination.fromText, note: r.destination.note || null } : null,
        tourWindow: r.tourWindow ? { date: r.tourWindow.date, start: r.tourWindow.start, reason: r.tourWindow.reason, windows: (r.tourWindow.windows || []).map(w => ({ date: w.date, start: w.start, end: w.end })) } : null,
        momentReport: r._momentReport ?? null,
        giorni: (r.days || []).map(d => ({ titolo: d.title || null, stops: (d.stops || []).map(s => ({
            title: s.title, place_id: s.place_id ?? null, moment: s.moment ?? null, momentLabel: s.momentLabel ?? null, tempoLibero: !!s.tempoLibero,
            scheduledTime: s.scheduledTime ?? null, stay: s.stayMinutes ?? null, cammino: s.travelMinutesFromPrev ?? null, attesa: s.waitMinutesBefore ?? null,
            types: s.types || [], primaryType: s.primaryType ?? null, lat: s.latitude ?? null, lng: s.longitude ?? null, description: s.description ?? null,
            tracciato: s._tracciato ?? null,
        })) })),
    };
    save();
}, 300000);

// ─── Modo extra: poche ricerche IN PIU' (stesso URL che il motore costruirebbe), registrate in C9_FIXTURE; niente giro ───
it.skipIf(MODE !== 'extra')('ricerche extra', async () => {
    const { buildPlacesProxyUrl } = await import('@/services/aiRecommendationService');
    // C9_CENTRO="lat,lng": il centro che il motore usa per Catania (gia' registrato nel giro), cosi' non si rifa la ricerca del centro
    const cc = process.env.C9_CENTRO ? { latitude: Number(process.env.C9_CENTRO.split(',')[0]), longitude: Number(process.env.C9_CENTRO.split(',')[1]) } : await resolveCityCenter(CASO.luogo);
    for (const q of String(process.env.C9_QUERY_EXTRA || '').split('|').filter(Boolean)) {
        const url = buildPlacesProxyUrl({ path: 'place/textsearch', query: `${q} ${CASO.luogo}`, location: `${cc.latitude},${cc.longitude}`, radius: '20000' });
        const res = await fetch(url);
        await res.json();
    }
    out.risultato = { extra: true };
    save();
}, 120000);
