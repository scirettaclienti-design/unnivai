/**
 * CURIOSITÀ DEL CAMMINO — la curiosità vera della via o del quartiere dove stai camminando, scritta dal server con la voce di Wikipedia del
 * luogo (verificata per nome e coordinate) e controllata come i racconti di tappa. Il client dice solo dove sei, la città, le curiosità già
 * dette in questo giro e i nomi delle tappe (`dv.purpose = 'curiosita'`): fonti, prompt e controllo non passano da qui.
 * `richiediCuriosita` non lancia mai: senza curiosità (nessuna fonte, scartata, rete, tetto) restituisce null e il cammino resta in silenzio.
 */
import { supabase } from '../lib/supabase';

export const TIMEOUT_CURIOSITA_MS = 45_000;

/**
 * @param {{ lat: number, lng: number, citta?: string, escludi?: string[], tappe?: string[] }} dove
 * @returns {Promise<{ testo: string, chiave: string, luogo: string, tipo: 'via'|'quartiere', fonte: { titolo: string, url: string }, cached?: boolean } | null>}
 */
export async function richiediCuriosita({ lat, lng, citta = '', escludi = [], tappe = [] } = {}) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_CURIOSITA_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv: { purpose: 'curiosita', lat, lng, citta: String(citta || '').slice(0, 80), escludi: escludi.slice(-60), tappe: tappe.filter(Boolean).map(t => String(t).slice(0, 120)).slice(0, 30) } }),
        });
        const corpo = await res.json().catch(() => null);
        const c = corpo?.curiosita;
        if (!res.ok || c?.esito !== 'passata' || typeof c.testo !== 'string' || !c.testo.trim() || !c.chiave) return null;
        return { testo: c.testo.trim(), chiave: c.chiave, luogo: c.luogo || '', tipo: c.tipo === 'quartiere' ? 'quartiere' : 'via', fonte: c.fonte || null, cached: !!c.cached };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
