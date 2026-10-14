/**
 * C10 — la lista della città dal server (openai-proxy, `dv.purpose = 'city_list'`): una per città e per giorno,
 * uguale per tutti. La prima richiesta del giorno la fa nascere (una chiamata AI e la verifica su Google, sul server);
 * le altre la leggono. Il client non manda testo: il prompt lo scrive il proxy.
 *
 * Non blocca mai il giro: se la lista non arriva (rete, quota, proxy) il motore va avanti senza, come prima di C10,
 * e il rapporto lo dice (`stato: 'assente'`).
 */
import { supabase } from '@/lib/supabase';

// C10b2 — 110 s: il proxy da' al modello della lista 60 s, poi il ripiego e la verifica su Google.
export const CITY_LIST_TIMEOUT_MS = 110_000;

/**
 * @param {string} citta
 * @param {string} giorno "AAAA-MM-GG", il giorno del tour
 * @returns {Promise<{ stato: 'ok'|'assente', verificati: Array, conti?: object, cached?: boolean, ms?: number, errore?: string, costo?: object }>}
 */
export async function fetchCityKnowledge(citta, giorno) {
    return chiediLista({ purpose: 'city_list', citta, giorno });
}

/**
 * C10b2 — la lista dedicata di un quartiere chiesto (6–8 luoghi da visitare, verificati come la lista): una per città, giorno
 * e quartiere, uguale per tutti. Stessa forma di fetchCityKnowledge.
 */
export async function fetchQuartiereKnowledge(citta, giorno, quartiere) {
    if (!quartiere) return { stato: 'assente', verificati: [], errore: 'quartiere mancante' };
    return chiediLista({ purpose: 'quartiere_list', citta, giorno, quartiere });
}

async function chiediLista(dv) {
    const { citta, giorno } = dv;
    const t0 = Date.now();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !citta || !giorno) return { stato: 'assente', verificati: [], errore: 'configurazione o parametri mancanti' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CITY_LIST_TIMEOUT_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv }),
        });
        const body = await res.json().catch(() => null);
        const k = body?.cityKnowledge;
        if (!res.ok || !k) return { stato: 'assente', verificati: [], errore: `${res.status} ${body?.code || ''}`.trim(), ms: Date.now() - t0 };
        return {
            stato: 'ok', verificati: Array.isArray(k.verificati) ? k.verificati : [], conti: k.conti || null, cached: !!k.cached,
            // C10b — la scala proposta dall'AI (la conferma il motore) e il centro usato dalla verifica
            scala: k.scala ?? null, centro: k.centro ?? null,
            // C10b2 — il modello usato per la lista (e se ha ripiegato)
            modelli: k.modelli ?? null,
            ms: Date.now() - t0, ...(k.google || k.usage ? { costo: { google: k.google || null, usage: k.usage || null, ms: k.ms || null } } : {}),
        };
    } catch (err) {
        return { stato: 'assente', verificati: [], errore: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err).slice(0, 80), ms: Date.now() - t0 };
    } finally {
        clearTimeout(timer);
    }
}
