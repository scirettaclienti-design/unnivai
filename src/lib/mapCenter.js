/**
 * Gate F38 — il centro della mappa come stato derivato.
 *
 * Origine (device, 5deca9c): su /map l'header diceva "Manfredonia" e la mappa
 * era centrata su Roma. Selezionando una città dall'autocomplete la mappa non
 * si muoveva.
 *
 * La causa non era un fallback sbagliato: erano QUATTRO fallback indipendenti
 * che si sovrascrivevano a vicenda, senza che nessuno fosse l'autorità —
 * `initialCenter` al mount, l'effect CITY FLY-TO, il flyTo dell'autocomplete,
 * e `DEMO_CITIES[city] || DEMO_CITIES['Roma']` (18 città su tutte quelle
 * italiane: il `||` non distingueva "città sconosciuta" da "città Roma").
 *
 * Sotto c'era un vincolo strutturale: `defaultCenter` di
 * @vis.gl/react-google-maps è UNCONTROLLED, letto solo al mount. Montare la
 * mappa prima di conoscere il centro significava montarla su Roma per sempre,
 * correggibile solo con flyTo imperativi — cioè il meccanismo fragile stesso.
 *
 * Qui vive la sola catena di precedenza. Funzione pura, file separato, test
 * propri: stesso pattern di resolvePoiPhoto (Gate FOTO), getTourRenderState
 * (Gate E-1) e getSurpriseOutcome (Gate NARRATORE/POI). Un motore solo
 * (regola locked #8).
 */

const isPoint = (p) => !!p
    && Number.isFinite(p.latitude)
    && Number.isFinite(p.longitude);

/**
 * Catena di precedenza del centro mappa (decisione Ivano, 6 livelli).
 *
 *  1. tour attivo — porta il proprio centro esplicito
 *  2. centro passato dal router (location.state.initialCenter)
 *  3. città scelta dall'autocomplete
 *  4. se isManual → città geocodata (la scelta esplicita batte il GPS)
 *  5. altrimenti → GPS reale, poi città geocodata
 *  6. niente. NESSUN default Roma.
 *
 * Le coordinate città non sono un geocode nuovo: arrivano da
 * userContextService.getCoordinatesForCity, che copre qualunque città italiana
 * con fast-path su CITY_COORDS.
 *
 * @returns {{center: {latitude:number,longitude:number}|null, source: string|null}}
 */
export function resolveMapCenter({
    tourCenter = null,
    passedCenter = null,
    manualCenter = null,
    gpsCenter = null,
    cityCenter = null,
    isManual = false,
} = {}) {
    if (isPoint(tourCenter)) return { center: tourCenter, source: 'tour' };
    if (isPoint(passedCenter)) return { center: passedCenter, source: 'passed' };
    if (isPoint(manualCenter)) return { center: manualCenter, source: 'manual' };

    // La scelta esplicita dell'utente non si fa scavalcare dal GPS. Se la città
    // è scelta a mano ma il geocode non è ancora tornato, il centro resta null:
    // "non lo so ancora" è più corretto del GPS di un'altra città.
    if (isManual) {
        return isPoint(cityCenter) ? { center: cityCenter, source: 'city' } : { center: null, source: null };
    }

    if (isPoint(gpsCenter)) return { center: gpsCenter, source: 'gps' };
    if (isPoint(cityCenter)) return { center: cityCenter, source: 'city' };

    return { center: null, source: null };
}

/**
 * Tre stati espliciti, nessun valore-ponte (Gate O.2).
 *
 *  'resolved'    → c'è un centro derivato dalla città reale. La mappa monta.
 *  'pending'     → non lo so ANCORA. La mappa non monta: montarla ora
 *                  significherebbe inchiodarla a un centro provvisorio.
 *  'unavailable' → il boot è finito e non lo so. Stato onesto, mai Roma,
 *                  e uscibile (la barra di ricerca città resta a schermo).
 *
 * @returns {'resolved'|'pending'|'unavailable'}
 */
export function resolveCenterStatus({ center = null, isLocating = false, userContextLoading = false } = {}) {
    if (center) return 'resolved';
    if (isLocating || userContextLoading) return 'pending';
    return 'unavailable';
}
