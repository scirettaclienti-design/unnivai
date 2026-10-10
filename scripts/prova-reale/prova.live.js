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
//   perte   → "Per Te" Roma (Home, adesso)
// Risultato: JSON in PROVA_OUT (default: <tmp>/prova-reale.json).
import { it, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { aiRecommendationService, buildInsiderPool } from '@/services/aiRecommendationService';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { resolveCityCenter } from '@/services/cityCenterService';

const OUT = process.env.PROVA_OUT || path.join(os.tmpdir(), 'prova-reale.json');
const RICHIESTE = (process.env.PROVA_RICHIESTE || 'roma').split(',').map(s => s.trim()).filter(Boolean);
const out = { identita: 'ospite', richieste: RICHIESTE, risultati: {} };
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

// Chiamate AI e token, contati sul proxy.
const realFetch = globalThis.fetch;
let calls = 0, tokens = 0;
globalThis.fetch = vi.fn(async (url, init) => {
    const res = await realFetch(url, init);
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
    out.token = tokens;
    save();
    if (out.identita !== 'ospite') await supabase.auth.signOut();
});

// Una riga per tappa: chi l'ha scelta (modello / riparazione) e i minuti dalla prima.
const row = (s, fatti, riempite) => ({
    title: s.title, types: (s.types || []).slice(0, 3), moment: s.moment || null, at: s.scheduledTime || null,
    min: s.travelMinutesFromPrev ?? null, scelta: riempite ? (riempite.has(s.place_id) ? 'riparazione' : 'modello') : null,
    fatti: fatti || [], description: s.description, sicura: !!s._fraseSicura,
});

const ITINERARI = {
    roma: ['Roma', 'Domani voglio vivere Roma da romano'],
    catania: ['Catania', 'Domani voglio vivere Catania'],
};

for (const key of RICHIESTE) {
    it(key, async () => {
        const c0 = calls; const t0 = Date.now();
        try {
            if (key === 'perte') {
                const cc = await resolveCityCenter('Roma');
                const themed = await placesDiscoveryService.discoverAllThemes('Roma', cc.latitude, cc.longitude);
                const insider = buildInsiderPool(themed, cc, 'Roma');
                const r = await aiRecommendationService.generateHomeTours({ city: 'Roma', cityCenter: cc, themedCandidates: { insider, ...themed },
                    prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, aiProfile: '' });
                const per = new Map((r._report?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                out.risultati.perte = { source: r._source, secs: (Date.now() - t0) / 1000, chiamate: calls - c0, momento: r._report?.momento,
                    tours: (r.tours || []).map(t => ({ tema: t.themeType, stops: t.stops.map(s => row(s, per.get(s.place_id), null)) })) };
            } else if (ITINERARI[key]) {
                const [city, prompt] = ITINERARI[key];
                const cc = await resolveCityCenter(city);
                const r = await aiRecommendationService.generateItinerary(city, { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' }, prompt, {}, '', cc, { pathType: 'custom' });
                const per = new Map((r._narrationReport?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
                const riempite = new Set((r._momentReport?.riempite || []).map(x => x.place_id));
                out.risultati[key] = { source: r._source, secs: (Date.now() - t0) / 1000, chiamate: calls - c0,
                    frasiTolte: r._narrationReport?.frasiTolte, momentReport: r._momentReport,
                    stops: (r.days || []).flatMap(d => d.stops.map(s => row(s, per.get(s.place_id), riempite))) };
            } else {
                out.risultati[key] = { errore: 'richiesta sconosciuta' };
            }
        } catch (e) {
            out.risultati[key] = { errore: e?.code || e?.message, chiamate: calls - c0 };
        }
        save();
    });
}
