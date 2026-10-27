// Il Map ID della mappa: sorgente unica (GoogleMapContainer lo riesporta) e la scelta fra quello di sempre, quello della mappa del giro
// (Ossidiana) e quelli delle fasce orarie. L'env e' la sorgente; il literal e' un fallback DICHIARATO (se `VITE_GOOGLE_MAP_ID` manca la
// mappa parte comunque sullo stile storico).
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || '28861a61c07876f819652d2d';

// ─── MAP ID DELLA MAPPA DEL GIRO ─────────────────────────────────────────────
// La mappa del giro (panoramica e navigazione) e' lo stile Google «Unnivai · Ossidiana Navigazione», assegnato alla modalita' BUIO del suo
// Map ID: `VITE_GOOGLE_MAP_ID_NAV` (Vercel e .env locale), mai nel codice. Senza la variabile la mappa e' quella di sempre (`MAP_ID`).
export const MAP_ID_NAV = import.meta.env.VITE_GOOGLE_MAP_ID_NAV || null;

// Le fasce orarie: durante la navigazione la mappa prende il colore della fascia (mattina, tramonto, notte), ognuna con il suo Map ID.
// Il resto del giorno resta Ossidiana. Se la variabile di una fascia manca, si resta su Ossidiana.
export const MAP_ID_FASCE = {
    mattina: import.meta.env.VITE_GOOGLE_MAP_ID_NAV_MATTINA || null,
    tramonto: import.meta.env.VITE_GOOGLE_MAP_ID_NAV_TRAMONTO || null,
    notte: import.meta.env.VITE_GOOGLE_MAP_ID_NAV_NOTTE || null,
};
/** Il Map ID di una fascia: il suo se c'e', altrimenti Ossidiana (`MAP_ID_NAV`), altrimenti null. */
export const mapIdFascia = (fascia) => (fascia && MAP_ID_FASCE[fascia]) || MAP_ID_NAV;

/** La mappa del giro usa lo stile dedicato? Con un giro aperto (o in navigazione), con la variabile, e se il chiamante non impone un suo Map ID. */
export const stileNavigazioneAttivo = ({ giroAttivo = false, isNavigating = false, mapId = null } = {}) => !mapId && (!!giroAttivo || !!isNavigating) && !!MAP_ID_NAV;
/** Il Map ID da usare: quello del chiamante, poi Ossidiana per la mappa del giro, poi quello di sempre. */
export const mapIdPer = ({ giroAttivo = false, isNavigating = false, mapId = null } = {}) => mapId || (stileNavigazioneAttivo({ giroAttivo, isNavigating }) && MAP_ID_NAV) || MAP_ID;
/** Lo stile Ossidiana e' assegnato alla modalita' BUIO del Map ID: la mappa del giro si crea con `colorScheme: DARK`. Senza la variabile niente cambia. */
export const opzioniNavigazione = (p = {}) => (stileNavigazioneAttivo(p) ? { colorScheme: 'DARK' } : {});
