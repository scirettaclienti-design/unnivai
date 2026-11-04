/**
 * CHAT-VERITA — la chat con la guida. Il telefono manda la domanda, gli ultimi turni e le tappe del giro (`dv.purpose = 'chat'`); le fonti,
 * il prompt, il revisore e la risposta onesta stanno sul server (openai-proxy, chat.ts). Qui niente testo libero oltre alla domanda e ai turni.
 * `chiediAllaGuida` non lancia mai: un guasto diventa un messaggio onesto, mai un fatto.
 */
import { supabase } from '../lib/supabase';
import { AI_ENGINE_MESSAGE } from '../lib/aiEngineError';
import { assicuraConsensoAi, haConsensoAi } from '../lib/consensoAi';
import { CONSENSO_AI } from '../lib/testiAccount';

export const TIMEOUT_CHAT_MS = 30_000;
export const MSG_CHAT_RETE = 'Non riesco a raggiungere la guida. Riprova tra poco.';
export const TURNI_MAX = 6;

const placeIdDi = (s) => s?.place_id || s?.googlePlaceId || null;
const ora = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
};

/** Una tappa del giro (o il luogo aperto sulla mappa) → solo i campi che servono al server. */
export function luogoPerChat(s) {
    const lat = Number(s?.latitude ?? s?.lat), lng = Number(s?.longitude ?? s?.lng);
    const nome = String(s?.title || s?.name || s?.label || '').trim();
    if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
        place_id: placeIdDi(s), nome: nome.slice(0, 120), lat, lng,
        ora: ora(s?.scheduledTime), sosta: Number.isFinite(Number(s?.stayMinutes)) ? Number(s.stayMinutes) : null,
    };
}

// Il centro del giro può arrivare come { lat, lng } o { latitude, longitude }; senza, lo calcola il server dalle tappe.
const centroDa = (c) => {
    const lat = Number(c?.lat ?? c?.latitude), lng = Number(c?.lng ?? c?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/**
 * Le tappe vanno nell'ordine del giro; `aperto` è il luogo aperto sulla mappa (anche fuori dal giro), `prossima` la prossima tappa
 * se il telefono la sa (in navigazione), altrimenti null: senza, la guida non suppone dove sei.
 * @param {{ domanda: string, storia?: Array<{ role: 'user'|'assistant', content: string }>, citta?: string, tappe?: object[], aperto?: object|null, prossima?: object|null, centro?: {lat:number,lng:number}|null }} r
 * @returns {Promise<{ testo: string, fonti: Array<{ nome: string, titolo: string, url: string }>, esito: string | null }>}
 */
export async function chiediAllaGuida({ domanda, storia = [], citta = '', tappe = [], aperto = null, prossima = null, centro = null }) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return { testo: MSG_CHAT_RETE, fonti: [], esito: null };
    // ACCOUNT-PRIVACY — la chat manda domanda e tappe a un servizio AI di terzi: prima serve il consenso.
    if (!(await assicuraConsensoAi())) return { testo: CONSENSO_AI.BLOCCATO, fonti: [], esito: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_CHAT_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const luoghi = (tappe || []).map(luogoPerChat).filter(Boolean).slice(0, 12);
        const p = prossima ? luogoPerChat(prossima) : null;
        const i = p ? luoghi.findIndex((l) => (p.place_id && l.place_id === p.place_id) || l.nome === p.nome) : -1;
        const indiceProssima = i >= 0 ? i : null;
        const turni = storia.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content).slice(-TURNI_MAX)
            .map((m) => ({ ruolo: m.role === 'assistant' ? 'guida' : 'utente', testo: String(m.content).slice(0, 600) }));
        const r = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv: {
                purpose: 'chat', domanda: String(domanda).slice(0, 500), storia: turni, citta,
                luoghi, aperto: aperto ? luogoPerChat(aperto) : null, prossima: indiceProssima, centro: centroDa(centro),
            } }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && typeof j?.chat?.testo === 'string' && j.chat.testo.trim()) {
            return { testo: j.chat.testo, fonti: Array.isArray(j.chat.fonti) ? j.chat.fonti : [], esito: j.chat.esito || null };
        }
        // quota: il testo del server; motore fermo: il testo di sempre; altro: rete
        if (r.status === 429 && typeof j?.error === 'string') return { testo: j.error, fonti: [], esito: null };
        if (r.status === 502) return { testo: AI_ENGINE_MESSAGE, fonti: [], esito: null };
        return { testo: MSG_CHAT_RETE, fonti: [], esito: null };
    } catch {
        return { testo: MSG_CHAT_RETE, fonti: [], esito: null };
    } finally {
        clearTimeout(timer);
    }
}

// CHAT-FOCUS-FONTI — all'avvio del giro le fonti delle tappe si preparano sul server (nessuna AI, nessuna quota), così la prima domanda non le cerca.
// Una volta per giro; mai prima del consenso (senza, non parte niente); un proxy di prima risponde 400 e qui non succede nulla.
const giriPrecaricati = new Set();
export function chiavePrecarica(tappe, citta) {
    const luoghi = (tappe || []).map(luogoPerChat).filter(Boolean).slice(0, 12);
    return luoghi.length ? `${citta || ''}|${luoghi.map((l) => l.place_id || l.nome).join(',')}` : null;
}
/** Non lancia e non aspetta nessuno: ritorna true se la richiesta è partita. */
export async function precaricaFontiGiro({ tappe = [], citta = '' }) {
    try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const chiave = chiavePrecarica(tappe, citta);
        if (!supabaseUrl || !anonKey || !chiave || giriPrecaricati.has(chiave)) return false;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !haConsensoAi(session.user)) return false;
        giriPrecaricati.add(chiave);
        const luoghi = (tappe || []).map(luogoPerChat).filter(Boolean).slice(0, 12);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_CHAT_MS);
        fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ dv: { purpose: 'chat', precarica: true, citta, luoghi } }),
        }).catch(() => { giriPrecaricati.delete(chiave); }).finally(() => clearTimeout(timer));
        return true;
    } catch {
        return false;
    }
}
