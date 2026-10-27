// nav-camera — la dissolvenza fra la mappa vecchia e quella della fascia (usata da GoogleMapContainer).
/** La durata della dissolvenza. */
export const DISSOLVENZA_MS = 600;
// I metodi di camera che, durante la dissolvenza, vanno applicati a TUTTE e due le mappe (cosi' si vede la stessa vista).
const METODI_CAMERA = new Set(['moveCamera', 'panTo', 'setCenter', 'setZoom', 'setTilt', 'setHeading', 'fitBounds', 'panBy']);
/** Un google.maps.Map che applica i comandi di camera anche all'altra mappa (solo durante la dissolvenza). */
export function specchiaCamera(principale, altra) {
    if (!altra) return principale;
    return new Proxy(principale, {
        get(t, p) {
            const v = t[p];
            if (typeof v !== 'function') return v;
            if (METODI_CAMERA.has(p)) return (...a) => { try { altra[p]?.(...a); } catch { /* l'altra mappa sta per essere rilasciata */ } return v.apply(t, a); };
            return v.bind(t);
        },
    });
}
