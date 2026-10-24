// Il Map ID della mappa: sorgente unica (GoogleMapContainer lo riesporta) e la scelta fra quello di sempre e quello della navigazione.
// L'env e' la sorgente; il literal e' un fallback DICHIARATO (se `VITE_GOOGLE_MAP_ID` manca la mappa parte comunque sullo stile storico).
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || '28861a61c07876f819652d2d';

// ─── MAP ID DELLA NAVIGAZIONE ────────────────────────────────────────────────
// La mappa di navigazione ha il suo stile Google (creato da Ivano in Cloud Console, «DoveVAI — Navigazione») legato a un suo Map ID.
// Il Map ID sta SOLO nella variabile d'ambiente `VITE_GOOGLE_MAP_ID_NAV` (Vercel e .env locale), mai nel codice. Se manca, la mappa
// di navigazione e' quella di sempre (`MAP_ID`). Il Map ID e' letto alla creazione della mappa: passare da esplorazione a navigazione
// ricrea l'istanza (la libreria lo fa da sola quando `mapId` cambia).
export const MAP_ID_NAV = import.meta.env.VITE_GOOGLE_MAP_ID_NAV || null;
/** Il Map ID da usare: quello della navigazione solo mentre si naviga e solo se c'e'. */
export const mapIdPer = ({ isNavigating = false, mapId = null } = {}) => mapId || (isNavigating && MAP_ID_NAV) || MAP_ID;

/** La mappa di navigazione usa lo stile Google dedicato? Solo mentre si naviga, solo con la variabile, e solo se il chiamante non impone un suo Map ID. */
export const stileNavigazioneAttivo = ({ isNavigating = false, mapId = null } = {}) => !mapId && !!isNavigating && !!MAP_ID_NAV;
/**
 * Lo stile «Unnivai · Ossidiana Navigazione» e' assegnato alla modalita' BUIO del Map ID: la mappa si crea con `colorScheme: DARK`
 * e vista dall'alto (inclinazione 0), come nel canvas. Senza la variabile niente cambia (inclinazione di prima, schema del sistema).
 */
export const opzioniNavigazione = (p = {}) => (stileNavigazioneAttivo(p) ? { colorScheme: 'DARK', tilt: 0 } : {});
/** L'inclinazione della camera in navigazione: 0 con lo stile dedicato, altrimenti quella di sempre. */
export const inclinazioneNav = (normale) => (MAP_ID_NAV ? 0 : normale);
