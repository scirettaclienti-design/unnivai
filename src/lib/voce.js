/**
 * VOCE-1 — la voce umana della navigazione (OpenAI gpt-4o-mini-tts, voce marin o cedar), al posto della voce del browser.
 *
 * `parla(testo)` chiede l'audio a openai-proxy (`dv.purpose = 'voce'`): modello, tono e formato li sceglie il server; una frase già
 * detta arriva dalla cache e costa 0 $. Se qualcosa non va (rete, tetto, server, riproduzione bloccata) si torna alla voce del browser,
 * senza errori a schermo. La chiave OpenAI non è mai qui.
 *
 * Ogni frase detta lascia una riga nel registro (`registroVoce`, anche in `window.__voceRegistro`): ora, testo, voce, sorgente
 * ('cache' | 'nuova' | 'browser'). Serve alla prova e al conto del costo.
 */
import { supabase } from '@/lib/supabase';

export const VOCI = [
    { id: 'marin', nome: 'Marin' },
    { id: 'cedar', nome: 'Cedar' },
];
export const VOCE_PREDEFINITA = 'marin';
const CHIAVE_SCELTA = 'dvai_voce_scelta_v1';
export const TIMEOUT_VOCE_MS = 12_000;

export function voceScelta() {
    try {
        const v = localStorage.getItem(CHIAVE_SCELTA);
        return VOCI.some(x => x.id === v) ? v : VOCE_PREDEFINITA;
    } catch { return VOCE_PREDEFINITA; }
}
export function scegliVoce(id) {
    if (!VOCI.some(x => x.id === id)) return voceScelta();
    try { localStorage.setItem(CHIAVE_SCELTA, id); } catch { /* la scelta vale per questa sessione */ }
    return id;
}

// ─── registro di ogni frase detta ────────────────────────────────────────────
export const registroVoce = [];
function registra(riga) {
    registroVoce.push(riga);
    try { if (typeof window !== 'undefined') window.__voceRegistro = registroVoce; } catch { /* niente */ }
}

// ─── l'audio: un solo elemento, sbloccato da un gesto (iOS) e riusato per ogni frase ──────────────────
let el = null;
let numero = 0; // l'ultima richiesta vince: una frase vecchia che arriva tardi non parla
const urlDiSessione = new Map(); // `${voce}|${testo}` → url già ottenuto in questa sessione (0 chiamate al server)
const SILENZIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

function audio() {
    if (!el && typeof Audio !== 'undefined') {
        el = new Audio();
        el.preload = 'auto';
    }
    return el;
}

/** Da chiamare dentro un gesto dell'utente (tasto Voce, Avvia): iOS dopo questo lascia parlare lo stesso elemento anche senza tocchi. */
export function sbloccaVoce() {
    try {
        const a = audio();
        if (!a || a.dataset?.sbloccato) return;
        a.src = SILENZIO;
        const p = a.play();
        if (a.dataset) a.dataset.sbloccato = '1';
        p?.catch?.(() => { if (a.dataset) delete a.dataset.sbloccato; });
    } catch { /* niente */ }
}

export function fermaVoce() {
    numero += 1;
    try { el?.pause?.(); } catch { /* niente */ }
    try { window.speechSynthesis?.cancel(); } catch { /* niente */ }
    try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; } catch { /* niente */ }
}

function mediaSession(titolo) {
    try {
        if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
        navigator.mediaSession.metadata = new MediaMetadata({ title: titolo || 'Unnivai', artist: 'Unnivai', album: 'Il tuo giro' });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('pause', () => fermaVoce());
        navigator.mediaSession.setActionHandler('stop', () => fermaVoce());
    } catch { /* niente */ }
}

async function chiediAlServer(testo, voce) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('configurazione mancante');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_VOCE_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv: { purpose: 'voce', testo, voce } }),
        });
        const corpo = await res.json().catch(() => null);
        if (!res.ok || !corpo?.url) throw new Error(`voce ${res.status} ${corpo?.code || ''}`.trim());
        return corpo; // { url, source: 'cache' | 'nuova', ... }
    } finally {
        clearTimeout(timer);
    }
}

function riproduci(url) {
    return new Promise((resolve, reject) => {
        const a = audio();
        if (!a) { reject(new Error('niente audio')); return; }
        const fine = () => { a.onended = null; a.onerror = null; resolve(); };
        a.onended = fine;
        a.onerror = () => { a.onended = null; a.onerror = null; reject(new Error('riproduzione')); };
        a.src = url;
        const p = a.play();
        p?.catch?.((e) => { a.onended = null; a.onerror = null; reject(e); });
    });
}

function paroleDelBrowser(testo) {
    return new Promise((resolve) => {
        try {
            if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') { resolve(false); return; }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(testo);
            u.lang = 'it-IT'; u.rate = 0.95;
            u.onend = () => resolve(true);
            u.onerror = () => resolve(false);
            window.speechSynthesis.speak(u);
        } catch { resolve(false); }
    });
}

/**
 * Dice `testo`. Mai lancia: se la voce umana non è disponibile parla il browser, se non c'è nemmeno quello tace.
 * @returns {Promise<'cache'|'nuova'|'browser'|'muto'>} da dove è venuta la voce
 */
export async function parla(testo, { voce = voceScelta(), titolo = null } = {}) {
    const frase = String(testo || '').replace(/\s+/g, ' ').trim();
    if (!frase) return 'muto';
    const mio = ++numero;
    try { el?.pause?.(); } catch { /* niente */ }
    try { window.speechSynthesis?.cancel(); } catch { /* niente */ }
    const chiave = `${voce}|${frase}`;
    try {
        let url = urlDiSessione.get(chiave);
        let sorgente = 'cache';
        if (!url) {
            const r = await chiediAlServer(frase, voce);
            url = r.url;
            sorgente = r.source === 'nuova' ? 'nuova' : 'cache';
            urlDiSessione.set(chiave, url);
        }
        if (mio !== numero) return 'muto'; // nel frattempo è arrivata una frase più nuova (o uno stop)
        registra({ ora: new Date().toISOString(), testo: frase, voce, sorgente });
        mediaSession(titolo || frase.slice(0, 60));
        await riproduci(url);
        return sorgente;
    } catch {
        if (mio !== numero) return 'muto';
        registra({ ora: new Date().toISOString(), testo: frase, voce, sorgente: 'browser' });
        const parlato = await paroleDelBrowser(frase);
        return parlato ? 'browser' : 'muto';
    }
}

// Il primo tocco in qualunque punto della pagina sblocca l'audio su iOS (Avvia, Voce…): le frasi dopo parlano anche a telefono in tasca.
try {
    if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => sbloccaVoce(), { once: true, capture: true });
} catch { /* niente */ }
