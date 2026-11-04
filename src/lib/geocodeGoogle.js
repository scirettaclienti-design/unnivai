// GOOGLE-CHIAVI — il Geocoding REST di Google NON ammette chiavi ristrette per sito (referrer): chiamarlo dal browser con la
// chiave del browser finisce in REQUEST_DENIED appena la chiave e' ristretta. Per questo passa dal server (places-proxy,
// path `geocode`, chiave del server). Ripiego di transizione: finche' il server non ha il path `geocode` (403) o il proxy e'
// spento, si prova la chiamata diretta di oggi con la chiave del browser; se Google la nega, il chiamante ha gia' il suo
// ripiego (Nominatim / nessuna coordinata). Da togliere il ripiego diretto dopo la pubblicazione di places-proxy (docs/prove/2026-11-06-google-chiavi.md).
import { buildPlacesProxyUrl, isPlacesProxyEnabled } from '../services/aiRecommendationService';

const GOOGLE_GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';
const esito = (d) => d && (Array.isArray(d.results) || d.status === 'OK' || d.status === 'ZERO_RESULTS');

/** @param {Record<string,string>} params es. { latlng: '41.9,12.4', language: 'it' } oppure { address: 'Roma' }. @returns {Promise<object|null>} il JSON di Google o null. */
export async function geocodeGoogle(params, signal) {
    // ogni tentativo ha il suo tempo massimo (5 s) e rispetta l'eventuale signal del chiamante
    const conTempo = async (url) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const dalChiamante = () => ctrl.abort();
        signal?.addEventListener?.('abort', dalChiamante);
        try {
            const r = await fetch(url, { signal: ctrl.signal });
            if (!r.ok) return null;
            const d = await r.json();
            return esito(d) ? d : null;
        } catch { return null; } finally { clearTimeout(tid); signal?.removeEventListener?.('abort', dalChiamante); }
    };
    if (isPlacesProxyEnabled()) {
        const d = await conTempo(buildPlacesProxyUrl({ path: 'geocode', ...params }));
        if (d) return d;
    }
    const chiave = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!chiave) return null;
    return conTempo(`${GOOGLE_GEOCODE}?${new URLSearchParams({ ...params, key: chiave })}`);
}
