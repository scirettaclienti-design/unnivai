// TEST-ACC — le prove reali di Claude Code (P3d-g, P3d-i, C1…), in un file solo.
//
// Identita': se .env.local ha TEST_ACCOUNT_EMAIL e TEST_ACCOUNT_PASSWORD, lo
// script entra con l'account di prova (nessun tetto personale, tetto globale
// valido, generazioni etichettate 'test' in ai_generation_ticket). Altrimenti
// resta ospite e consuma la quota ospite come prima. Le credenziali non
// compaiono mai nell'output: si stampa solo "account di prova" o "ospite".
//
// Richieste (PROVA_RICHIESTE, separate da virgola; default: roma):
//   roma    → "Domani voglio vivere Roma da romano"
//   catania → "Domani voglio vivere Catania"
//   catania2 → "Un pomeriggio a Catania tra barocco e mare"
//   perte   → "Per Te" Roma (Home, adesso)
//   troinaRoma → posizione Troina, "Domani Roma in una giornata da Romano" (T1)
//   login   → solo l'accesso dell'account di prova, nessuna chiamata AI
// Risultato: JSON in PROVA_OUT (default: <tmp>/prova-reale.json).
import { it, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService, buildInsiderPool } from '@/services/aiRecommendationService';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { resolveCityCenter } from '@/services/cityCenterService';
import { voiceIssues } from '@/lib/narrationLight';
import { testoPulito } from '@/lib/stopPhrases';

const OUT = process.env.PROVA_OUT || path.join(os.tmpdir(), 'prova-reale.json');
const RICHIESTE = (process.env.PROVA_RICHIESTE || 'roma').split(',').map(s => s.trim()).filter(Boolean);
const out = { identita: 'ospite', richieste: RICHIESTE, risultati: {} };
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

// Chiamate AI e token, contati sul proxy.
const realFetch = globalThis.fetch;
// C1b — anche le chiamate Google (places-proxy), per percorso: textsearch,
// details, foto. Sono quelle che costano.
let calls = 0, tokens = 0;
const google = {};
const googleTot = () => Object.values(google).reduce((a, b) => a + b, 0);
globalThis.fetch = vi.fn(async (url, init) => {
    const res = await realFetch(url, init);
    const g = String(url).match(/places-proxy\/?\??.*?path=([^&]+)/) || (String(url).includes('places-proxy') ? [null, 'altro'] : null);
    if (g) { const k = decodeURIComponent(g[1]); google[k] = (google[k] || 0) + 1; }
    if (String(url).includes('openai-proxy')) {
        calls++;
        try { const j = await res.clone().json(); tokens += j?.usage?.total_tokens || 0; } catch { /* stream o errore */ }
    }
    return res;
});

beforeAll(async () => {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const password = process.env.TEST_ACCOUNT_PASSWORD;
    if (email && password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data?.session) throw new Error(`login dell'account di prova fallito: ${error?.status || ''} ${error?.code || 'nessuna sessione'}`);
        out.identita = 'account di prova';
    }
    console.log(`[prova-reale] identita': ${out.identita} | richieste: ${RICHIESTE.join(', ')} | risultato: ${OUT}`);
});
afterAll(async () => {
    out.chiamateAI = calls;
    out.chiamateGoogle = { ...google, totale: googleTot() };
    out.token = tokens;
    save();
    if (out.identita !== 'ospite') await supabase.auth.signOut();
});

// Una riga per tappa: chi l'ha scelta (modello / riparazione / ripiego), i
// minuti dalla prima e la famiglia (C1: dal tracciato interno della tappa).
const row = (s, fatti, riempite) => ({
    title: s.title, types: (s.types || []).slice(0, 3), moment: s.moment || null, at: s.scheduledTime || null,
    min: s._tracciato ? s._tracciato.minuti : (s.travelMinutesFromPrev ?? null),
    scelta: s._tracciato?.scelta ?? (riempite ? (riempite.has(s.place_id) ? 'riparazione' : 'modello') : null),
    famiglia: s._tracciato?.famiglia ?? null, ...(s._tracciato?.motivo ? { motivo: s._tracciato.motivo } : {}),
    fatti: fatti || [], description: s.description, sicura: !!s._fraseSicura,
});

// P3d-j — per la tabella tappa / fatti / descrizione / verita' / voce: le
// scelte del modello e cosa ne ha fatto il codice, piu' due controlli
// automatici (la revisione a mano resta nel resoconto).
//   verita'  la rete non ha tolto niente e il testo e' pulito (niente null,
//            segnaposto, vuoti); se usa un fatto, e' davvero uno dei fatti.
//   voce     nessuna frase con un problema di voce (voiceIssues).
const conComposizione = (r, comp, fattiPer) => {
    const c = comp.get(r.place_id) || {};
    const frasi = String(r.description || '').split(/(?<=[.!?])\s+/).filter(Boolean);
    const fatti = fattiPer || [];
    const fattoUsato = c.usaFatto ? frasi[0] : null;
    return {
        ...r,
        sceltaModello: c.scelta || null, usaFatto: c.usaFatto ?? null, gancio: c.gancio ?? null, interesse: c.interesse ?? null,
        riserva: c.riserva || [], rete: c.rete || [],
        verita: (c.rete || []).length === 0 && testoPulito(r.description) && (!fattoUsato || fatti.some(f => String(f.testo || f).startsWith(fattoUsato))),
        voce: frasi.every(f => voiceIssues(f).length === 0),
    };
};

const ITINERARI = {
    roma: ['Roma', 'Domani voglio vivere Roma da romano'],
    catania: ['Catania', 'Domani voglio vivere Catania'],
    catania2: ['Catania', 'Un pomeriggio a Catania tra barocco e mare'],
    // T1 — posizione simulata Troina, citta' e giorno scritti nel testo (caso reale di Ivano).
    troinaRoma: ['Troina', 'Domani Roma in una giornata da Romano'],
};

for (const key of RICHIESTE) {
    if (key === 'login') {
        it('login', () => {
            if (out.identita !== 'account di prova') throw new Error('mancano le credenziali dell\'account di prova in .env.local');
        });
        continue;
    }
    it(key, async () => {
        // C1b — ogni richiesta parte a cache vuota (ricerche Places e centri
        // citta'), cosi' le chiamate Google sono quelle di UNA generazione. La
        // sessione Supabase (chiavi sb-*) resta.
        for (const k of Object.keys(window.localStorage)) if (!k.startsWith('sb-')) window.localStorage.removeItem(k);
        const c0 = calls; const g0 = { ...google }; const t0 = Date.now();
        const gDelta = () => Object.fromEntries(Object.entries(google).map(([k, v]) => [k, v - (g0[k] || 0)]).filter(([, v]) => v > 0));
        try {
            if (key === 'perte') {
                const cc = await resolveCityCenter('Roma');
                const themed = await placesDiscoveryService.discoverAllThemes('Roma', cc.latitude, cc.longitude);
                const insider = buildInsiderPool(themed, cc, 'Roma');
                const r = await aiRecommendationService.generateHomeTours({ city: 'Roma', cityCenter: cc, themedCandidates: { insider, ...themed },
                    prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, aiProfile: '',
                    // come per gli itinerari: solo il preflight, il tetto vero e' sul server
                    opts: { skipUserQuota: out.identita !== 'ospite' } });
                const per = new Map((r._report?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                out.risultati.perte = { source: r._source, secs: (Date.now() - t0) / 1000, chiamate: calls - c0, momento: r._report?.momento,
                    composizione: true,
                    tours: (r.tours || []).map(t => ({ tema: t.themeType, stops: t.stops.map(s => conComposizione({ place_id: s.place_id, ...row(s, per.get(s.place_id), null) }, new Map((r._report?.composizione || []).map(x => [x.place_id, x])), per.get(s.place_id))) })) };
            } else if (ITINERARI[key]) {
                const [city, prompt] = ITINERARI[key];
                const cc = await resolveCityCenter(city);
                // C1b — con l'account di prova si salta il solo preflight del client: legge
                // il contatore personale (che il server continua a incrementare) e non
                // conosce l'esenzione TEST-ACC. Il tetto vero resta sul server.
                const r = await aiRecommendationService.generateItinerary(city, { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' }, prompt, {}, '', cc,
                    { pathType: 'custom', skipUserQuota: out.identita !== 'ospite' });
                const per = new Map((r._narrationReport?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const riempite = new Set((r._momentReport?.riempite || []).map(x => x.place_id));
                out.risultati[key] = { source: r._source, secs: (Date.now() - t0) / 1000, chiamate: calls - c0, google: gDelta(),
                    posizione: city,
                    destinazione: r.destination ? { city: r.destination.city, fromText: r.destination.fromText, note: r.destination.note } : null,
                    giorno: r.tourWindow ? { date: r.tourWindow.date, start: r.tourWindow.start, reason: r.tourWindow.reason } : null,
                    frasiTolte: r._narrationReport?.frasiTolte, momentReport: r._momentReport,
                    titoli: (r.days || []).map(d => d.title), meteo: (r.days || []).map(d => d.weather ?? null),
                    stops: (r.days || []).flatMap(d => d.stops.map(s => conComposizione({ place_id: s.place_id, ...row(s, per.get(s.place_id), riempite) }, new Map((r._narrationReport?.composizione || []).map(x => [x.place_id, x])), per.get(s.place_id)))) };
            } else {
                out.risultati[key] = { errore: 'richiesta sconosciuta' };
            }
        } catch (e) {
            out.risultati[key] = { errore: e?.code || e?.message, chiamate: calls - c0 };
        }
        save();
    });
}
