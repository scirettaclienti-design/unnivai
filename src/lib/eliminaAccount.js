/**
 * ACCOUNT-PRIVACY — la parte del telefono di «Elimina account» (Apple 5.1.1(v)).
 * Chiama la Edge Function `elimina-account` con il JWT dell'utente: lei verifica chi è e cancella solo lui.
 * Onesta: se la funzione non c'è ancora (404 del gateway) o il database non ha la migrazione (503), lo dice e NON dà un «fatto».
 */

import { supabase } from './supabase';
import { ELIMINA, PAROLA_ELIMINA } from './testiAccount';
import { CHIAVE_CONSENSO } from './consensoAi';

export const TIMEOUT_ELIMINA_MS = 45_000;

/** La parola scritta basta a confermare? (maiuscole e spazi non contano) */
export const confermaValida = (scritto) => String(scritto ?? '').trim().toLowerCase() === PAROLA_ELIMINA;

/** @returns {Promise<{ ok: true } | { ok: false, motivo: 'non-attiva'|'sessione'|'rete'|'timeout'|'non-riuscita', messaggio: string }>} */
export async function eliminaAccount() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return { ok: false, motivo: 'non-riuscita', messaggio: ELIMINA.NON_RIUSCITA };

    let token = null;
    try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token ?? null;
    } catch { /* niente sessione */ }
    if (!token) return { ok: false, motivo: 'sessione', messaggio: ELIMINA.SESSIONE };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_ELIMINA_MS);
    let res;
    try {
        res = await fetch(`${url}/functions/v1/elimina-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${token}` },
            body: JSON.stringify({ conferma: PAROLA_ELIMINA }),
            signal: controller.signal,
        });
    } catch (err) {
        // Scaduto il tempo la cancellazione potrebbe essere andata a buon fine: non si dice «non ho cancellato niente».
        if (err?.name === 'AbortError') return { ok: false, motivo: 'timeout', messaggio: ELIMINA.SENZA_RISPOSTA };
        return { ok: false, motivo: 'rete', messaggio: ELIMINA.SENZA_RETE };
    } finally {
        clearTimeout(timer);
    }

    const corpo = await res.json().catch(() => null);
    if (res.ok && corpo?.esito === 'eliminato') return { ok: true };
    // La funzione non è pubblicata (il gateway risponde 404) o la migrazione non è applicata: onesti, niente è stato cancellato.
    if (res.status === 404 || corpo?.code === 'MIGRAZIONE_MANCANTE') return { ok: false, motivo: 'non-attiva', messaggio: ELIMINA.NON_ATTIVA };
    if (res.status === 401) return { ok: false, motivo: 'sessione', messaggio: ELIMINA.SESSIONE };
    return { ok: false, motivo: 'non-riuscita', messaggio: ELIMINA.NON_RIUSCITA };
}

/** Dopo la cancellazione: via dal telefono quello che era dell'utente (le chiavi dell'app, il suo consenso). */
export function pulisciTelefono() {
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith('dvai_') || k.startsWith('unnivai_') || k === CHIAVE_CONSENSO || k.startsWith('read_generated_notifs') || k.startsWith('deleted_generated_notifs'))
            .forEach((k) => localStorage.removeItem(k));
    } catch { /* storage ko */ }
}
