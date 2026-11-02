/**
 * CURIOSITÀ DEL CAMMINO — la curiosità vera della via o del quartiere dove stai camminando, scritta dal server con la voce di Wikipedia del
 * luogo (verificata per nome e coordinate) e controllata come i racconti di tappa. Il client dice solo dove sei, la città, le curiosità già
 * dette in questo giro e i nomi delle tappe (`dv.purpose = 'curiosita'`): la via e il quartiere li trova il SERVER (Google, con una memoria per
 * zona condivisa); fonti, prompt e controllo non passano da qui. Solo se il server dice «fonti non disponibili» perché non ha trovato via e quartiere (Google e le riserve giù) il
 * telefono prova UNA volta a chiedere via e quartiere a Nominatim e rimanda la richiesta con quei nomi (riserva, mai la strada normale).
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
 * RISERVA. La via e il quartiere dove sei, da OpenStreetMap (Nominatim): dal telefono, perché Nominatim rifiuta le richieste dal server
 * (403). Si usa solo dopo che il server non ha trovato le fonti (Google giù). Il server usa questi nomi solo per scegliere la voce di
 * Wikipedia e la verifica con le coordinate. Mai lancia: senza risposta, null.
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

/** Una richiesta al server. `indirizzo` solo nella riserva. Restituisce { ok, stato, corpo }. */
async function chiediAlServer({ lat, lng, citta, escludi, tappe, indirizzo, headers, controller, supabaseUrl }) {
    const res = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
        method: 'POST', headers, signal: controller.signal, // AbortController: il tempo massimo lo mette il chiamante
        body: JSON.stringify({ dv: { purpose: 'curiosita', lat, lng, citta: String(citta || '').slice(0, 80), escludi: escludi.slice(-60), tappe: tappe.filter(Boolean).map(t => String(t).slice(0, 120)).slice(0, 30), ...(indirizzo ? { indirizzo } : {}) } }),
    });
    return { ok: res.ok, stato: res.status, corpo: await res.json().catch(() => null) };
}

/**
 * @param {{ lat: number, lng: number, citta?: string, escludi?: string[], tappe?: string[] }} dove
 * @returns {Promise<{ testo: string, chiave: string, luogo: string, tipo: 'via'|'quartiere', fonte: { titolo: string, url: string }, cached?: boolean } | null>}
 */
export async function richiediCuriosita({ lat, lng, citta = '', escludi = [], tappe = [] } = {}) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!(await consensoAiDato())) return null; // ACCOUNT-PRIVACY: senza consenso non parte nemmeno la richiesta
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_CURIOSITA_MS);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json', apikey: anonKey };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const base = { lat, lng, citta, escludi, tappe, headers, controller, supabaseUrl };
        let r = await chiediAlServer(base);
        if (r.stato === 503 && r.corpo?.code === 'CURIOSITA_FONTI' && r.corpo?.senzaNomi) { // riserva: il server non ha trovato via e quartiere (Google e le sue riserve giù; non se è solo Wikipedia a non rispondere); li chiede il telefono a Nominatim
            const indirizzo = await indirizzoDalTelefono(lat, lng);
            if (indirizzo) r = await chiediAlServer({ ...base, indirizzo });
        }
        const c = r.corpo?.curiosita;
        if (!r.ok || c?.esito !== 'passata' || typeof c.testo !== 'string' || !c.testo.trim() || !c.chiave) return null;
        return { testo: c.testo.trim(), chiave: c.chiave, luogo: c.luogo || '', tipo: c.tipo === 'quartiere' ? 'quartiere' : 'via', fonte: c.fonte || null, cached: !!c.cached };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
