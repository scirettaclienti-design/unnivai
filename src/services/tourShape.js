// DVAI-053 — Normalizzatore unificato per oggetti Tour e Step.
//
// Prima del fix, 8 sorgenti producevano step con shape sottilmente diversa
// (placesDiscoveryService, generateItinerary insider, smart tematici, SurpriseTour,
// AiItinerary, QuickPath, mock e poi un'ulteriore trasformazione in TourDetails).
// La stessa "Piazza del Duomo" appariva con campi diversi (lat vs latitude,
// title vs name, immagine reale vs Unsplash, narrativa presente o assente).
//
// Soluzione: TUTTE le shape passano per normalizeTour / normalizeTourStep e
// producono un oggetto identico, qualunque sia la sorgente.

// Fallback Unsplash quando nessuna foto reale è disponibile. Brand-neutral.
const STEP_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80';

// ─── DVAI-055-b: utility geografiche centralizzate nel normalizer ────────────
// Il filtro raggio "tappe entro raggio città" vive qui perché TUTTE le sorgenti
// (Per Te tematici, Per Te insider, SurpriseTour, AiItinerary, QuickPath, DB,
// mock) passano da normalizeTour. Prima erano solo in aiRecommendationService
// che copriva solo il motore insider — i tour tematici sfuggivano al filtro.

// TODO V1.1: sostituire con lookup popolazione da API/tabella (V1.1_BACKLOG #11).
// Lista provvisoria: top 30 comuni italiani per popolazione (>~130k abitanti).
export const TOP_30_CITIES = new Set([
    'roma', 'milano', 'napoli', 'torino', 'palermo', 'genova', 'bologna', 'firenze', 'bari', 'catania',
    'venezia', 'verona', 'messina', 'padova', 'trieste', 'brescia', 'taranto', 'parma', 'prato', 'modena',
    'reggio calabria', 'reggio emilia', 'perugia', 'livorno', 'ravenna', 'cagliari', 'foggia', 'rimini', 'salerno', 'ferrara',
]);

export const isSmallTown = (cityName) => !TOP_30_CITIES.has(String(cityName || '').trim().toLowerCase());

// Distanza in km tra due punti geografici (Haversine).
export function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Filtro raggio + scalata onesta.
// - Filtra rawStops entro R_km dal centro città.
// - Se < 2 tappe residue, riprova con R_wider (rifiltra rawStops originali, NON chiama AI).
// - Se anche R_wider < 2 → ritorna le poche o zero tappe: chi consuma decide.
export function applyRadiusFilter(rawStops, cityCenter, cityName) {
    if (!cityCenter || !Number.isFinite(cityCenter.latitude) || !Number.isFinite(cityCenter.longitude)) {
        return rawStops;
    }
    const small = cityCenter.isSmallTown ?? isSmallTown(cityName);
    const R = cityCenter.radiusKm ?? (small ? 5 : 10);
    const R_wider = small ? 12 : 20;

    const filterAt = (radius) => rawStops.filter(s => {
        const lat = s.latitude ?? s.lat;
        const lng = s.longitude ?? s.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true; // no coords → passa (non giudicare)
        const d = haversineKm(cityCenter.latitude, cityCenter.longitude, lat, lng);
        if (d > radius) {
            console.warn(`[AI-radius] Scartata "${s.title || '?'}": ${d.toFixed(1)} km > ${radius} km da ${cityName || '?'}`);
            return false;
        }
        return true;
    });

    let filtered = filterAt(R);
    if (filtered.length < 2 && rawStops.length >= 2) {
        console.warn(`[AI-radius] ${cityName || '?'}: solo ${filtered.length} tappe entro ${R} km, allargo a ${R_wider} km`);
        filtered = filterAt(R_wider);
    }
    return filtered;
}
// ─── fine utility geografiche ─────────────────────────────────────────────────

// Set chiuso delle categorie supportate. Tutto ciò che non rientra → 'place'.
export const TOUR_CATEGORIES = ['food', 'cultura', 'storia', 'arte', 'natura', 'shopping', 'relax', 'place'];

// DVAI-053 — Resolver alias categoria.
// Riceve un valore arbitrario (italiano, inglese, type Google Places, type AI…) e
// lo riconduce a uno dei TOUR_CATEGORIES. Mantenere ESTESO: meglio una categoria
// mappata in più che un POI reale che finisce su 'place' generico.
export const CATEGORY_ALIASES = {
    // ─── FOOD ────────────────────────────────────────────────────────────────
    food: 'food',
    cibo: 'food',
    ristorante: 'food',
    restaurant: 'food',
    cafe: 'food',
    bar: 'food',
    bakery: 'food',
    pasticceria: 'food',
    pizzeria: 'food',
    trattoria: 'food',
    osteria: 'food',
    enoteca: 'food',
    gelateria: 'food',
    ice_cream: 'food',
    meal_takeaway: 'food',
    meal_delivery: 'food',
    night_club: 'food',
    liquor_store: 'food',
    gastronomia: 'food',
    street_food: 'food',

    // ─── CULTURA ─────────────────────────────────────────────────────────────
    cultura: 'cultura',
    culture: 'cultura',
    chiesa: 'cultura',
    church: 'cultura',
    place_of_worship: 'cultura',
    cattedrale: 'cultura',
    duomo: 'cultura',
    basilica: 'cultura',
    cathedral: 'cultura',
    synagogue: 'cultura',
    mosque: 'cultura',
    hindu_temple: 'cultura',
    library: 'cultura',
    biblioteca: 'cultura',
    university: 'cultura',
    università: 'cultura',
    museo: 'cultura',
    museum: 'cultura',
    teatro: 'cultura',
    theatre: 'cultura',
    theater: 'cultura',
    auditorium: 'cultura',
    conservatorio: 'cultura',

    // ─── STORIA ──────────────────────────────────────────────────────────────
    storia: 'storia',
    history: 'storia',
    monument: 'storia',
    monumento: 'storia',
    palazzo: 'storia',
    castello: 'storia',
    castle: 'storia',
    rovine: 'storia',
    ruins: 'storia',
    archeologia: 'storia',
    archaeological_site: 'storia',
    cemetery: 'storia',
    cimitero: 'storia',
    fortress: 'storia',
    fortezza: 'storia',
    tower: 'storia',
    torre: 'storia',
    catacombs: 'storia',
    catacombe: 'storia',
    centro_storico: 'storia',

    // ─── ARTE ────────────────────────────────────────────────────────────────
    arte: 'arte',
    art: 'arte',
    art_gallery: 'arte',
    galleria: 'arte',
    gallery: 'arte',
    affresco: 'arte',
    sculpture: 'arte',
    street_art: 'arte',
    murales: 'arte',

    // ─── NATURA ──────────────────────────────────────────────────────────────
    natura: 'natura',
    nature: 'natura',
    park: 'natura',
    parco: 'natura',
    giardino: 'natura',
    garden: 'natura',
    villa: 'natura',
    villa_comunale: 'natura',
    villa_pubblica: 'natura',
    natural_feature: 'natura',
    campground: 'natura',
    zoo: 'natura',
    aquarium: 'natura',
    acquario: 'natura',
    beach: 'natura',
    spiaggia: 'natura',
    mountain: 'natura',
    montagna: 'natura',
    lago: 'natura',
    lake: 'natura',
    viewpoint: 'natura',
    panorama: 'natura',
    belvedere: 'natura',

    // ─── SHOPPING ────────────────────────────────────────────────────────────
    shopping: 'shopping',
    shop: 'shopping',
    store: 'shopping',
    mercato: 'shopping',
    market: 'shopping',
    shopping_mall: 'shopping',
    clothing_store: 'shopping',
    jewelry_store: 'shopping',
    book_store: 'shopping',
    libreria: 'shopping',
    home_goods_store: 'shopping',
    department_store: 'shopping',
    supermarket: 'shopping',
    boutique: 'shopping',
    artigianato: 'shopping',
    artigiano: 'shopping',

    // ─── RELAX ───────────────────────────────────────────────────────────────
    relax: 'relax',
    spa: 'relax',
    terme: 'relax',
    rooftop: 'relax',
    sky_bar: 'relax',
    lounge: 'relax',
    wellness: 'relax',
    yoga: 'relax',
    meditation: 'relax',

    // NOTE: piazza/square → cultura (le piazze italiane famose sono primariamente
    // luoghi storico-culturali, non "relax"). Vedi DVAI-053 prova di unificazione.
    piazza: 'cultura',
    square: 'cultura',

    // ─── PLACE (fallback esplicito) ─────────────────────────────────────────
    place: 'place',
    point_of_interest: 'place',     // troppo generico, non scartare ma marca 'place'
    establishment: 'place',
    tourist_attraction: 'cultura',  // di solito è cultura → meglio promuovere
    landmark: 'cultura',
};

/**
 * Normalizza il valore raw di una categoria/tipologia in uno dei TOUR_CATEGORIES.
 * Default: 'place' se il valore è null/undefined o non in tabella alias.
 */
export function normalizeStepCategory(raw) {
    if (!raw) return 'place';
    const key = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
    if (TOUR_CATEGORIES.includes(key)) return key;
    return CATEGORY_ALIASES[key] || 'place';
}

/**
 * Normalizza un singolo step di un tour (qualunque sia la sorgente: AI insider,
 * placesDiscoveryService, smart tematici, SurpriseTour, AiItinerary, QuickPath,
 * mock numerici, riga di DB già passata da mapTourToUI).
 *
 * @param {object} raw   - lo step originale, arbitrariamente strutturato
 * @param {number} index - posizione dello step (per id/title di default)
 * @param {string} cityFallback - città da usare se raw.city è assente
 * @returns {object} step in shape canonica
 */
export function normalizeTourStep(raw = {}, index = 0, cityFallback = 'Roma') {
    // Coordinate: accetta sia `latitude/longitude` che `lat/lng`.
    const latRaw = raw.latitude ?? raw.lat;
    const lngRaw = raw.longitude ?? raw.lng;
    const lat = (latRaw !== null && latRaw !== undefined) ? parseFloat(latRaw) : NaN;
    const lng = (lngRaw !== null && lngRaw !== undefined) ? parseFloat(lngRaw) : NaN;
    const hasLat = Number.isFinite(lat);
    const hasLng = Number.isFinite(lng);

    // Immagine: priorità foto reale Places > foto fornita > photos[0] > fallback Unsplash
    let imageSource = 'fallback';
    let image = STEP_FALLBACK_IMAGE;
    if (raw.googlePhoto) {
        image = raw.googlePhoto;
        imageSource = 'places';
    } else if (raw.image && typeof raw.image === 'string') {
        image = raw.image;
        imageSource = 'provided';
    } else if (raw.photo && typeof raw.photo === 'string') {
        image = raw.photo;
        imageSource = 'provided';
    } else if (Array.isArray(raw.photos) && raw.photos.length > 0 && typeof raw.photos[0] === 'string') {
        image = raw.photos[0];
        imageSource = 'provided';
    }

    return {
        // Identità
        id: raw.id || `step-${index}`,
        index,

        // Tassonomia
        title: raw.title || raw.name || raw.label || `Tappa ${index + 1}`,
        description: raw.description || '',
        category: normalizeStepCategory(raw.category || raw.type),

        // Coordinate: forniamo SEMPRE entrambi i nomi per compat con lettori esistenti
        // (alcune pagine leggono `.latitude`, altre `.lat`).
        latitude: hasLat ? lat : null,
        longitude: hasLng ? lng : null,
        lat: hasLat ? lat : null,
        lng: hasLng ? lng : null,

        // Tempi
        time: raw.time || null,
        suggestedMinutes: Number.isFinite(Number(raw.suggestedMinutes)) ? Number(raw.suggestedMinutes) : 30,

        // Narrativa "insider" — null se assenti (non undefined né mancanti)
        transition: raw.transition || null,
        insiderTip: raw.insiderTip || null,
        bestTime: raw.bestTime || null,

        // Media
        image,
        imageSource,

        // Verifica Places (opzionali)
        googlePlaceId: raw.googlePlaceId || null,
        googleRating: typeof raw.googleRating === 'number' ? raw.googleRating : null,
        openNow: typeof raw.openNow === 'boolean' ? raw.openNow : null,

        // Metadata
        city: raw.city || cityFallback,
        price: typeof raw.price === 'number' ? raw.price : 0,
        // Gate O.4: rating/reviewsCount POI-level da Google Places. null se
        // il POI non li ha (non 0 fake, non "N/D"). Attribuzione Google si
        // fa lato UI dove il dato viene mostrato.
        rating: Number.isFinite(raw.rating) && raw.rating > 0 ? raw.rating : null,
        reviewsCount: Number.isFinite(raw.reviewsCount) && raw.reviewsCount > 0 ? raw.reviewsCount : null,
    };
}

/**
 * Normalizza un oggetto Tour completo (qualunque sia la sorgente).
 * Garantisce:
 *  - `image/imageUrl/images[]` sempre presenti (cover = root explicit > 1° step > Unsplash)
 *  - `steps[]` sempre array di shape canonica (accetta `steps`, `stops`, o ricostruisce da `itinerary`)
 *  - `itinerary[]` derivato dagli steps per back-compat con render esistente
 *  - `guide/guideAvatar` con default coerenti se `isAiGenerated`
 *  - `city` sempre presente
 *
 * Tutti gli altri campi sull'oggetto raw vengono propagati (spread iniziale).
 */
export function normalizeTour(raw = {}, opts = {}) {
    const city = raw.city || opts.cityFallback || 'Roma';

    // Determina la sorgente degli step: priorità `steps`, poi `stops`, poi ricostruisci da `itinerary`.
    const sourceSteps = Array.isArray(raw.steps) && raw.steps.length > 0
        ? raw.steps
        : Array.isArray(raw.stops) && raw.stops.length > 0
            ? raw.stops
            : Array.isArray(raw.itinerary) && raw.itinerary.length > 0
                ? raw.itinerary.map(it => ({ title: it.activity || it.title, description: it.description, time: it.time, transition: it.transition, insiderTip: it.insiderTip, bestTime: it.bestTime }))
                : [];

    const rawNormalized = sourceSteps.map((s, i) => normalizeTourStep(s, i, city));

    // DVAI-055-b: filtro centralizzato prossimità.
    // Attivo se opts.cityCenter è passato AND opts.enforceRadius !== false.
    // Il filtro riusa applyRadiusFilter (Haversine + scalata onesta borgo/città).
    // Vale per tutte le sorgenti: tematici Per Te, featured insider, SurpriseTour,
    // AiItinerary, QuickPath (dove abilitato), TourDetails (solo se raw.isAiGenerated).
    const shouldEnforceRadius = opts.enforceRadius !== false
        && opts.cityCenter && Number.isFinite(opts.cityCenter.latitude)
        && rawNormalized.length > 0;
    const steps = shouldEnforceRadius
        ? applyRadiusFilter(rawNormalized, opts.cityCenter, city)
        : rawNormalized;

    // Cover: priorità immagine root esplicita > prima foto reale di uno step SUPERSTITE >
    // primo step SUPERSTITE con image valida > fallback Unsplash.
    // DVAI-055-b — regola "no fake content": cover deve puntare a una tappa reale
    // rimasta dopo il filtro. Se il filtro ha scartato lo step 0, la cover si
    // ricalcola da uno step successivo, mai da una tappa fantasma.
    const firstPlacesPhoto = steps.find(s => s.imageSource === 'places')?.image;
    const firstProvidedImage = steps.find(s => s.imageSource === 'provided')?.image;
    const firstAnyStepImage = steps.find(s => s.image && s.image !== STEP_FALLBACK_IMAGE)?.image;
    const cover = raw.image || raw.imageUrl || firstPlacesPhoto || firstProvidedImage || firstAnyStepImage || STEP_FALLBACK_IMAGE;

    // Galleria: priorità images esplicito > foto reali di tutti gli step > cover
    const images = Array.isArray(raw.images) && raw.images.length > 0
        ? raw.images
        : (steps.map(s => s.image).filter(Boolean));

    // Itinerary derivato dagli steps normalizzati per back-compat con il render
    // attuale di TourDetails (che legge `tour.itinerary[i].activity`).
    const itinerary = steps.map((s, i) => ({
        time: s.time || `Tappa ${i + 1}`,
        activity: s.title,
        emoji: '📍',
        description: s.description,
        transition: s.transition,
        insiderTip: s.insiderTip,
        bestTime: s.bestTime,
    }));

    return {
        ...raw,
        // Cover root sempre presente nei 3 formati attesi
        image: cover,
        imageUrl: cover,
        images,
        // Steps SEMPRE normalizzati (sostituisce qualunque raw.steps eterogenea)
        steps,
        // Itinerary derivato (back-compat)
        itinerary,
        // Default guide coerenti
        guide: raw.guide || (raw.isAiGenerated ? 'Intelligenza DoveVai' : 'DoveVai Guide'),
        guideAvatar: raw.guideAvatar || (raw.isAiGenerated ? '🤖' : '👋'),
        // City sempre presente
        city,
    };
}
