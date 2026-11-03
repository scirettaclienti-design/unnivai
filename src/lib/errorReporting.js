/**
 * Gate GG (16/07) — Error reporting minimo.
 *
 * Motivo: la schermata ErrorBoundary diceva "Il team tecnico e' stato
 * notificato" ma nessuno riceveva niente (solo console.error). Bugia
 * rassicurante. Ora ogni crash intercettato dall'ErrorBoundary fa un POST
 * fire-and-forget alla tabella Supabase public.error_logs.
 *
 * Regole:
 *  - Fire-and-forget: la reportError() NON blocca mai la UI. Errore in
 *    Supabase = log console, non re-throw. Un crash mentre riporto un crash
 *    e' l'ultima cosa da rendere fatale.
 *  - Dedup per hash message entro DEDUP_WINDOW_MS (evita spam da loop
 *    render che re-triggera errorBoundary all'infinito).
 *  - Classificazione errore: chunk_load vs generic vs network. Serve
 *    all'ErrorBoundary per decidere il flow (chunk_load -> reload silenzioso,
 *    generic -> schermata errore umana).
 *  - Zero PII inutili: user_id se autenticato (per correlare crash a
 *    utente); NO email, NO body request. url e user_agent sono contesto
 *    tecnico standard.
 *  - Zero dependency esterne (no Sentry). Usiamo la tabella Supabase gia'
 *    accessibile via client anon.
 */

import { supabase } from './supabase.js';
import { VERSIONE_APP } from './versione.js';

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min: no duplicati stesso message
const sentHashes = new Map(); // hash -> timestamp

/**
 * Classifica il messaggio d'errore.
 *
 * Chunk-load errors (bug scoperto Ivano 16/07): dopo un deploy Vercel, il
 * browser di un utente con l'app aperta chiede un chunk .js con l'hash
 * vecchio. Il file non esiste piu' -> Vercel risponde con l'HTML della SPA
 * (fallback SPA) -> il browser prova a eseguire HTML come JS -> crash con
 * messaggi tipo:
 *   - "'text/html' is not a valid JavaScript MIME type."
 *   - "Failed to fetch dynamically imported module"
 *   - "Importing a module script failed"
 *   - "Loading chunk N failed"
 *   - "ChunkLoadError"
 *
 * Vale la pena distinguerli perche' l'azione giusta e' un reload silenzioso
 * (l'app e' cambiata sotto i piedi), non una schermata rossa.
 */
export function classifyError(error) {
    if (!error) return 'generic';
    const message = String(error.message || error).toLowerCase();
    const name = String(error.name || '').toLowerCase();

    // Match esplicito su nome (browser moderno)
    if (name === 'chunkloaderror') return 'chunk_load';

    // Match su patterns (chrome/safari/firefox variano)
    const chunkPatterns = [
        'failed to fetch dynamically imported module',
        'importing a module script failed',
        'is not a valid javascript mime type',
        'loading chunk',
        'loading css chunk',
        'chunkloaderror',
    ];
    if (chunkPatterns.some(p => message.includes(p))) return 'chunk_load';

    // Network errors (offline, DNS fail, 5xx). Distinti da chunk_load
    // perche' richiedono retry manuale, non reload automatico.
    const networkPatterns = ['networkerror', 'failed to fetch', 'load failed'];
    if (networkPatterns.some(p => message.includes(p) || name.includes(p))) return 'network';

    return 'generic';
}

/**
 * Hash grezzo del messaggio per dedup. FNV-1a 32-bit: veloce, collision
 * rate accettabile per dedup client-side (non serve crypto).
 */
function hashMessage(msg) {
    let h = 2166136261;
    const s = String(msg || '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return h.toString(36);
}


/** AVVISI (L6) — al massimo questi errori per sessione: un loop non riempie la tabella. */
export const MAX_ERRORI_PER_SESSIONE = 10;
let inviatiInSessione = 0;
/** Solo per i test. */
export function azzeraSessioneErrori() { inviatiInSessione = 0; sentHashes.clear(); }

/** Il messaggio senza dati personali: via email, indirizzi web con query, numeri lunghi, token. */
export function pulisciMessaggio(m) {
    return String(m || '')
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
        .replace(/(https?:\/\/[^\s?#"')]+)[?#][^\s"')]*/g, '$1')
        .replace(/\b(eyJ[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g, '[token]')
        .replace(/\d[\d\s().-]{7,}\d/g, '[numero]')
        .slice(0, 300);
}

/** Rumore che non è un errore dell'app (estensioni del browser, script di terzi). */
export function eRumore(m) {
    const t = String(m || '');
    return !t || /^script error\.?$/i.test(t) || /ResizeObserver loop/i.test(t) || /chrome-extension:|moz-extension:|safari-extension:/i.test(t);
}

/**
 * Riporta un errore alla tabella error_logs. Fire-and-forget.
 *
 * @param {Error|string} error - istanza Error o stringa
 * @param {object} context - contesto extra (route, componentStack, ecc)
 * @returns {Promise<void>} sempre risolve (non rigetta mai)
 */
export async function reportError(error, context = {}) {
    try {
        if (!error) return;
        const message = pulisciMessaggio(error.message || error || 'Unknown error');
        if (eRumore(message)) return;
        const stack = error?.stack ? pulisciMessaggio(String(error.stack).slice(0, 1000)) : null;
        const errorType = classifyError(error);

        // Dedup: se stesso hash gia' inviato entro DEDUP_WINDOW_MS, skip. Tetto per sessione.
        const key = hashMessage(message);
        const now = Date.now();
        for (const [k, ts] of sentHashes.entries()) {
            if (now - ts > DEDUP_WINDOW_MS) sentHashes.delete(k);
        }
        if (sentHashes.has(key)) return;
        if (inviatiInSessione >= MAX_ERRORI_PER_SESSIONE) return;
        sentHashes.set(key, now);
        inviatiInSessione += 1;

        // AVVISI (L6): niente utente, niente user agent, niente query dell'indirizzo: pagina (solo il percorso), messaggio, versione.
        const payload = {
            error_type: errorType,
            message,
            stack,
            url: typeof window !== 'undefined' ? window.location.pathname.slice(0, 200) : null,
            user_agent: null,
            user_id: null,
            context: { versione: VERSIONE_APP, ...(context.errorType ? { tipo: context.errorType } : {}) },
        };

        // Fire-and-forget: NON await. Se Supabase e' irraggiungibile, l'errore
        // resta in console (sotto). L'utente non deve mai vedere "errore
        // durante il report dell'errore" — sarebbe assurdo.
        supabase.from('error_logs').insert(payload).then(({ error: e }) => {
            if (e) console.warn('[errorReporting] insert failed:', e.message);
        });
    } catch (e) {
        // Ultima linea di difesa: se qualcosa in questa funzione stessa
        // esplode, log-and-swallow. Non rigettiamo mai.
        console.warn('[errorReporting] exception:', String(e));
    }
}

/**
 * AVVISI (L6) — raccoglie anche gli errori che l'ErrorBoundary non vede (eventi, promesse rifiutate).
 * Una volta sola; non mostra mai niente all'utente; se la tabella non c'e' l'insert fallisce in silenzio.
 */
let installata = false;
export function installaRaccoltaErrori(target = typeof window !== 'undefined' ? window : null) {
    if (installata || !target) return;
    installata = true;
    target.addEventListener('error', (ev) => { reportError(ev?.error || ev?.message, {}); });
    target.addEventListener('unhandledrejection', (ev) => { reportError(ev?.reason, {}); });
}
