/**
 * CURIOSITÀ DEL CAMMINO — la curiosità vera della via o del quartiere dove stai camminando, scritta dal server con la voce di Wikipedia del
 * luogo (verificata per nome e coordinate) e controllata come i racconti di tappa. Il client dice solo dove sei, la città, le curiosità già
 * dette in questo giro, i nomi delle tappe e la via e il quartiere di OpenStreetMap (`dv.purpose = 'curiosita'`): fonti, prompt e controllo non passano da qui.
 * `richiediCuriosita` non lancia mai: senza curiosità (nessuna fonte, scartata, rete, tetto) restituisce null e il cammino resta in silenzio.
 */
import { supabase } from '../lib/supabase';
import { consensoAiDato } from '../lib/consensoAi';

export const TIMEOUT_CURIOSITA_MS = 45_000;
export const TIMEOUT_INDIRIZZO_MS = 8_000;
/** I campi dell'indirizzo di OpenStreetMap che servono al server (la via e il quartiere): niente altro esce dal telefono. */
export const CAMPI_INDIRIZZO = ['road', 'pedestrian', 'square', 'footway', 'neighbourhood', 'quarter', 'suburb', 'city_district', 'city', 'town', 'village'];
const indirizzi = new Map(); // punto a 4 decimali (~10 m) → indirizzo

/**
 * La via e il quartiere dove sei, da OpenStreetMap (Nominatim, come la città in useEnhancedGeolocation): dal telefono, perché Nominatim
 * rifiuta le richieste dal server (403). Il server usa questi nomi solo per scegliere la voce di Wikipedia e la verifica con le coordinate.
 * Mai lancia: senza risposta, null (il server prova da solo e restano le vie a pochi passi).
 */
export async function indirizzoDalTelefono(lat, lng) {
    const k = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (indirizzi.has(k)) return indirizzi.get(k);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_INDIRIZZO_MS);
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1&accept-language=it`, { signal: controller.signal });
        const j = res.ok ? await res.json().catch(() => null) : null;
        if (!j?.address) return null;
        const a = Object.fromEntries(CAMPI_INDIRIZZO.filter(c => typeof j.address[c] === 'string').map(c => [c, j.address[c].slice(0, 80)]));
        if (indirizzi.size > 200) indirizzi.clear();
        indirizzi.set(k, a);
        return a;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {{ lat: number, lng: number, citta?: string, escludi?: string[], tappe?: string[] }} dove
 * @returns {Promise<{ testo: string, chiave: string, luogo: string, tipo: 'via'|'quartiere', fonte: { titolo: string, url: string }, cached?: boolean } | null>}
 */
export async function richiediCuriosita({ lat, lng, citta = '', escludi = [], tappe = [] } = {}) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!(await consensoAiDato())) return null; // ACCOUNT-PRIVACY: senza consenso non parte, nemmeno la richiesta di via e quartiere
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_CURIOSITA_MS);
    try {
        const indirizzo = await indirizzoDalTelefono(lat, lng);
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ dv: { purpose: 'curiosita', lat, lng, citta: String(citta || '').slice(0, 80), escludi: escludi.slice(-60), tappe: tappe.filter(Boolean).map(t => String(t).slice(0, 120)).slice(0, 30), ...(indirizzo ? { indirizzo } : {}) } }),
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
