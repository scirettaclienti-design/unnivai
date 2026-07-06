// DVAI-058 — Palette categorie condivisa cross-app.
// Single source of truth per: MapMarker (pin mappa) + TourCover (copertine "Per Te").
// Estratta 1:1 da MapMarker.jsx per zero cambio comportamento sui pin mappa.

export const getCategoryStyles = (category, type) => {
    const typeStr = (type || '').toLowerCase();

    if (typeStr === 'waypoint' || typeStr === 'tour_step') {
        return { bg: '#1f2937', border: '#030712', icon: '📍', isStep: true };
    }
    if (typeStr === 'business_partner') {
        return { bg: '#eab308', border: '#a16207', icon: '⭐' };
    }

    const catLower = (category || '').toLowerCase();

    if (catLower.includes('food') || catLower.includes('cibo') || catLower.includes('ristorazione') || catLower.includes('restaurant')) {
        return { bg: '#f97316', border: '#c2410c', icon: '🍝' };
    }
    if (catLower.includes('shopping') || catLower.includes('negozio')) {
        return { bg: '#ec4899', border: '#be185d', icon: '🛍️' };
    }
    if (catLower.includes('coffee') || catLower.includes('bar') || catLower.includes('cafe')) {
        return { bg: '#8b5cf6', border: '#6d28d9', icon: '☕' };
    }
    if (catLower.includes('storia') || catLower.includes('history') || catLower.includes('museo') || catLower.includes('museum')) {
        return { bg: '#3b82f6', border: '#1d4ed8', icon: '🏛️' };
    }
    if (catLower.includes('art') || catLower.includes('arte')) {
        return { bg: '#10b981', border: '#047857', icon: '🎨' };
    }
    if (catLower.includes('natura') || catLower.includes('parco') || catLower.includes('park')) {
        return { bg: '#84cc16', border: '#4d7c0f', icon: '🌲' };
    }

    return { bg: '#ef4444', border: '#b91c1c', icon: '📌' };
};

// DVAI-058 — Palette dedicata alle copertine (ramo B TourCover).
// Wrappa getCategoryStyles + estende il match a categorie che nella lista tour
// "Per Te" appaiono ma non hanno corrispettivo diretto nei pin mappa
// (walking, romance, cultura, tramonto). Sui pin mappa quei valori non arrivano
// mai come `category`, quindi il match esteso vive solo qui.
const COVER_EXTRA = [
    { keys: ['walking', 'segret', 'vicoli', 'passeggia'], style: { bg: '#f59e0b', border: '#b45309', icon: '👣' } },
    { keys: ['romance', 'tramonto', 'sunset', 'magia'],   style: { bg: '#e11d48', border: '#9f1239', icon: '🌅' } },
    { keys: ['cultur', 'insider'],                        style: { bg: '#0ea5e9', border: '#0369a1', icon: '✨' } },
];

export const getCoverPalette = (category, type) => {
    const catLower = (category || '').toLowerCase();
    const extra = COVER_EXTRA.find(rule => rule.keys.some(k => catLower.includes(k)));
    const styles = extra ? extra.style : getCategoryStyles(category, type);
    return {
        bg: styles.bg,
        border: styles.border,
        icon: styles.icon,
        gradient: `linear-gradient(135deg, ${styles.bg} 0%, ${styles.border} 100%)`,
    };
};

// DVAI-058 — Rileva se un URL immagine è una foto Google Places verificata.
// Serve al TourCover per decidere il ramo (A foto reale vs B illustrato):
// - places-proxy (dev + prod)
// - googleusercontent (CDN Google)
// - maps.googleapis.com/maps/api/place/photo (endpoint diretto)
// Tutto il resto (Unsplash, hardcoded fallback, blob:) → ramo B.
const PLACES_URL_PATTERNS = [
    /\/places-proxy\??/i,
    /__dev\/places-proxy/i,
    /googleusercontent\.com/i,
    /maps\.googleapis\.com\/maps\/api\/place\/photo/i,
];

export const isPlacesPhoto = (url) => {
    if (!url || typeof url !== 'string') return false;
    return PLACES_URL_PATTERNS.some(p => p.test(url));
};
