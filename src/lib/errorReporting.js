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
        const message = String(error.message || error || 'Unknown error');
        const stack = error?.stack ? String(error.stack).slice(0, 4000) : null;
        const errorType = classifyError(error);

        // Dedup: se stesso hash gia' inviato entro DEDUP_WINDOW_MS, skip.
        // Pulizia opportunistica delle entry scadute (evita crescita infinita
        // di sentHashes durante la sessione).
        const key = hashMessage(message);
        const now = Date.now();
        for (const [k, ts] of sentHashes.entries()) {
            if (now - ts > DEDUP_WINDOW_MS) sentHashes.delete(k);
        }
        if (sentHashes.has(key)) return;
        sentHashes.set(key, now);

        // userId opzionale — chiama getSession, non richiede sessione
        let userId = null;
        try {
            const { data } = await supabase.auth.getSession();
            userId = data?.session?.user?.id ?? null;
        } catch { /* getSession puo' fallire, non blocchiamo il report */ }

        const payload = {
            error_type: errorType,
            message: message.slice(0, 1000),
            stack,
            url: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : null,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
            user_id: userId,
            context: Object.keys(context).length ? context : null,
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
