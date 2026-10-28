/**
 * RACCONTO DI TAPPA — il racconto da insider di una tappa, scritto dal server con le fonti verificate (Wikipedia + descrizione Google) e
 * controllato prima di arrivare qui. Il client dice solo quale tappa (`dv.purpose = 'racconto'`): fonti, prompt e controllo non passano da qui.
 * `richiediRacconto` non lancia mai: senza racconto (senza fonti, scartato, rete, tetto) restituisce null e la tappa resta con la frase breve
 * di oggi e con «Perché sei qui adesso». Un racconto passato si tiene sul telefono 30 giorni, così lo stesso posto non richiama il server.
 */
import { supabase } from '../lib/supabase';
import { isLocaleStop } from './factsService';

const CHIAVE = 'dvai_racconti_v1';
const TTL_MS = 30 * 86_400_000;
export const TIMEOUT_RACCONTO_MS = 45_000;
/** A questa distanza dalla tappa (m) si controlla che il racconto e l'audio siano pronti. */
export const DISTANZA_RICHIAMO_M = 300;

const memo = new Map(); // place_id → Promise<{ testo, esito } | null>

const leggiTelefono = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || '{}') || {}; } catch { return {}; } };
const scriviTelefono = (placeId, testo) => {
    try {
        const tutti = leggiTelefono();
        const ora = Date.now();
        for (const [k, v] of Object.entries(tutti)) if (!v || ora - v.t > TTL_MS) delete tutti[k];
        tutti[placeId] = { testo, t: ora };
        localStorage.setItem(CHIAVE, JSON.stringify(tutti));
    } catch { /* niente storage: si richiede al server */ }
};
export const raccontoSalvato = (placeId) => {
    const v = leggiTelefono()[placeId];
    return v && Date.now() - v.t <= TTL_MS && typeof v.testo === 'string' ? v.testo : null;
};

/** Una tappa ha senso da raccontare? Servono un place_id, un nome e le coordinate; un locale (ristorante, bar…) non ha racconto di fatti. */
export const placeIdDi = (stop) => stop?.place_id || stop?.googlePlaceId || null; // il passo normalizzato (normalizeTour) lo chiama googlePlaceId
export function tappaRaccontabile(stop) {
    const s = stop || {};
    const lat = Number(s.latitude ?? s.lat), lng = Number(s.longitude ?? s.lng);
    return !!(placeIdDi(s) && (s.name || s.title) && Number.isFinite(lat) && Number.isFinite(lng) && !isLocaleStop(s));
}

async function chiediAlServer(stop, citta) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_RACCONTO_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv: { purpose: 'racconto', place_id: placeIdDi(stop), nome: stop.name || stop.title, citta: citta || '', lat: Number(stop.latitude ?? stop.lat), lng: Number(stop.longitude ?? stop.lng) } }),
        });
        const corpo = await res.json().catch(() => null);
        if (!res.ok || !corpo?.racconto) return null;
        return { testo: corpo.racconto.esito === 'passato' && typeof corpo.racconto.testo === 'string' ? corpo.racconto.testo : null, esito: corpo.racconto.esito, cached: !!corpo.racconto.cached };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Il racconto della tappa, o null. Una sola richiesta per tappa per sessione (anche se la si chiede due volte: all'avvio del tratto e a 300 m).
 * @returns {Promise<{ testo: string|null, esito: string, cached?: boolean } | null>} null = il server non ha risposto (si può riprovare più tardi)
 */
export function richiediRacconto(stop, citta) {
    if (!tappaRaccontabile(stop)) return Promise.resolve({ testo: null, esito: 'non-raccontabile' });
    const id = placeIdDi(stop);
    const salvato = raccontoSalvato(id);
    if (salvato) return Promise.resolve({ testo: salvato, esito: 'passato', cached: true });
    if (memo.has(id)) return memo.get(id);
    const p = chiediAlServer(stop, citta).then((r) => {
        if (!r) memo.delete(id); // rete o motore giù: la prossima volta si riprova
        else if (r.testo) scriviTelefono(id, r.testo);
        return r;
    });
    memo.set(id, p);
    return p;
}

export const _svuotaMemoPerTest = () => memo.clear();
