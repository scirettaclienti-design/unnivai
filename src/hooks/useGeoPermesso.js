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
 * (`gpsActive`, coordinate), la mappa non ha già il tuo punto (`posizioneNota`: il puntino utente è visibile) e il browser non dice
 * che il permesso è concesso. Se l'hai rifiutata e il banner te l'ha già detto una volta (`giaMostrato`), non insiste a ogni apertura.
 */
export const serveBannerPosizione = ({ gpsActive = false, gpsCoords = null, permesso = 'unknown', posizioneNota = false, giaMostrato = false } = {}) => {
    if (gpsActive || gpsCoords || posizioneNota) return false;
    if (permesso === 'granted') return false;
    if (permesso === 'denied' && giaMostrato) return false;
    return true;
};

const CHIAVE_BANNER = 'dvai_gps_banner_negato_v1';
/** Il banner di un permesso negato è già stato mostrato su questo telefono? (localStorage; senza, si mostra ogni volta) */
export const bannerNegatoGiaMostrato = () => { try { return localStorage.getItem(CHIAVE_BANNER) === '1'; } catch { return false; } };
export const ricordaBannerNegato = () => { try { localStorage.setItem(CHIAVE_BANNER, '1'); } catch { /* niente storage: si rimostra */ } };
/** Il permesso è tornato concesso: la prossima volta che sarà negato, il banner si rimostra una volta. */
export const dimenticaBannerNegato = () => { try { localStorage.removeItem(CHIAVE_BANNER); } catch { /* niente */ } };
