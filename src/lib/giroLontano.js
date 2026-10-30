/**
 * GIRO-LONTANO — sei lontano dal giro? Funzioni pure (nessuna rete), usate dalla generazione (Crea) e dalla mappa.
 *
 * «Lontano» = più di SOGLIA_LONTANO_KM dalla tappa 1 (sulla mappa) o dal centro della città del giro (alla generazione, quando la tappa 1
 * non c'è ancora), oppure posizione non disponibile. Da lontano:
 *  · la panoramica non calcola il cammino da te: durata e km solo fra le tappe, inquadratura sulle tappe;
 *  · «Avvia» non apre una navigazione verso un punto a centinaia di km: lo dice, e la panoramica resta;
 *  · un giro di Crea senza orario scritto parte domani alle 9:30 (tourWindow, `lontano`).
 * In città, senza orario scritto, il giro parte da adesso più il cammino fino alla tappa 1 (`minutiFinoAllaTappa`).
 */
import { distanzaFraM } from './navGuida.js';
import { travelMinutes } from './tourTiming.js';

export const SOGLIA_LONTANO_KM = 20;

const punto = (p) => {
    const lat = Number(p?.latitude ?? p?.lat), lng = Number(p?.longitude ?? p?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;
};

/**
 * Quanto sei lontano da un punto del giro (la tappa 1, o il centro della città).
 * @returns {{ lontano: boolean, km: number|null, senzaPosizione: boolean }} km arrotondati a un decimale; null senza posizione o senza punto
 */
export function distanzaDalGiro(posizione, riferimento) {
    const tu = punto(posizione), giro = punto(riferimento);
    if (!tu) return { lontano: true, km: null, senzaPosizione: true };
    if (!giro) return { lontano: false, km: null, senzaPosizione: false };
    const km = Math.round(distanzaFraM(tu, giro) / 100) / 10;
    return { lontano: km > SOGLIA_LONTANO_KM, km, senzaPosizione: false };
}

/** La prima tappa vera di un elenco (non un tempo libero), o null. */
export const primaTappa = (stops) => (Array.isArray(stops) ? stops.find((s) => s && !s.tempoLibero && punto(s)) || null : null);

/** La prima tappa vera di un risultato del motore ({ days: [{ stops }] }). */
export const primaTappaDelGiro = (risultato) => primaTappa(risultato?.days?.[0]?.stops);

/** I minuti a piedi da te alla tappa 1 (stessa velocità del resto del giro); null se manca qualcosa. */
export function minutiFinoAllaTappa(posizione, tappa) {
    const tu = punto(posizione), t = punto(tappa);
    if (!tu || !t) return null;
    const m = travelMinutes(tu, t);
    return Number.isFinite(m) ? m : null;
}

/** «535» per il messaggio: km interi da 10 in su, un decimale sotto (non serve sotto la soglia, ma resta onesto). */
export const kmDetti = (km) => (km >= 10 ? String(Math.round(km)) : String(km).replace('.', ','));

/**
 * La posizione di adesso per Crea, letta una volta (va bene una posizione di al massimo 5 minuti fa), o null: posizione negata,
 * GPS assente, nessuna risposta entro `timeoutMs`. Non chiede di nuovo il permesso se è già stato negato.
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
export async function leggiPosizione({ geolocation = globalThis.navigator?.geolocation, permissions = globalThis.navigator?.permissions, timeoutMs = 8000 } = {}) {
    if (!geolocation?.getCurrentPosition) return null;
    try {
        const stato = await permissions?.query?.({ name: 'geolocation' });
        if (stato?.state === 'denied') return null;
    } catch { /* Safari vecchi: niente Permissions API, si prova lo stesso */ }
    return new Promise((ok) => {
        let fatto = false;
        const fine = (v) => { if (!fatto) { fatto = true; ok(v); } };
        const t = setTimeout(() => fine(null), timeoutMs);
        try {
            geolocation.getCurrentPosition(
                (pos) => { clearTimeout(t); const p = punto(pos?.coords); fine(p ? { latitude: p.lat, longitude: p.lng } : null); },
                () => { clearTimeout(t); fine(null); },
                { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: timeoutMs },
            );
        } catch { clearTimeout(t); fine(null); }
    });
}
