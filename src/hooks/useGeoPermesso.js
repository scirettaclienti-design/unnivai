import { useEffect, useState } from 'react';

/**
 * NAV-2 — il permesso di posizione, com'è davvero adesso (Permissions API: Safari da iOS 16, Chrome, Firefox).
 * 'granted' | 'denied' | 'prompt' | 'unknown' (il browser non lo dice). Si aggiorna se l'utente cambia idea nelle impostazioni.
 */
export function useGeoPermesso() {
    const [stato, setStato] = useState('unknown');
    useEffect(() => {
        let vivo = true;
        let ricerca = null;
        const aggiorna = () => { if (vivo && ricerca) setStato(ricerca.state || 'unknown'); };
        try {
            const q = typeof navigator !== 'undefined' ? navigator.permissions?.query?.({ name: 'geolocation' }) : null;
            if (q && typeof q.then === 'function') {
                q.then((r) => { ricerca = r; aggiorna(); try { r.addEventListener?.('change', aggiorna); } catch { /* vecchi browser */ } }).catch(() => {});
            }
        } catch { /* il browser non risponde: resta 'unknown' */ }
        return () => { vivo = false; try { ricerca?.removeEventListener?.('change', aggiorna); } catch { /* niente */ } };
    }, []);
    return stato;
}

/**
 * Il banner «Attiva la tua posizione» serve solo se la posizione è davvero negata o assente: non c'è un GPS già letto
 * (`gpsActive`, coordinate) e il browser non dice che il permesso è concesso.
 */
export const serveBannerPosizione = ({ gpsActive = false, gpsCoords = null, permesso = 'unknown' } = {}) => {
    if (gpsActive || gpsCoords) return false;
    if (permesso === 'granted') return false;
    return true;
};
