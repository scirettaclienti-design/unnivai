/**
 * Gate FOTO — risoluzione della foto di un POI.
 *
 * Origine (device, 14-15/08): il drawer e la card mappa cercavano la foto con
 * `findPlaceFromQuery({ query: "${nome} ${città}" })` e mostravano
 * `results[0].photos[0]` SENZA verificare che il risultato fosse lo stesso
 * posto. Osservato due volte: "Ippocampo" → cortile con ghiaia,
 * "La Masseria" → parco giochi. La foto era di un altro luogo con un nome
 * simile, presentata come foto del POI.
 *
 * La regola qui è una sola: una foto si mostra solo se è ancorata al place_id
 * del POI. Se quell'ancoraggio manca, non si mostra niente — mai un ripiego
 * che sembra il posto senza esserlo.
 *
 * Funzione PURA, file separato, test propri: stesso pattern di
 * getTourRenderState (TourDetails, Gate E-1) e getSurpriseOutcome
 * (SurpriseTour, Gate NARRATORE/POI 2a). Un solo motore per drawer e card
 * (regola locked #8).
 */

/**
 * @param {object|null} poi     lo stop/POI mostrato in UI
 * @param {object|null} details risultato di fetchPlaceDetailsForTour, o null
 * @returns {string|null} URL della foto, oppure null = non mostrare foto
 */
export function resolvePoiPhoto(poi, details) {
    // Senza place_id non c'è ancoraggio possibile: qualunque foto sarebbe
    // "di un posto che si chiama così", non "di questo posto".
    if (!poi?.googlePlaceId) return null;

    // details null = proxy spento, timeout 5s, HTTP non ok, o nessun result.
    if (!details) return null;

    const url = details.googlePhoto;
    if (!url || typeof url !== 'string' || !url.trim()) return null;

    // Unsplash non è mai la foto di un POI: è il fallback stock di
    // tourShape.js (STEP_FALLBACK_IMAGE). Se arriva fin qui è un ripiego che
    // si è travestito da dato reale lungo la catena.
    if (url.includes('unsplash.com')) return null;

    return url;
}
