/**
 * 📸 imageUtils.js — Centralised image fallback logic for UNNIVAI
 *
 * Rule: NEVER show a broken image or a Rome-specific landmark (Colosseum)
 * for a non-Rome context.  All exported helpers return a guaranteed valid URL.
 */

// ─── SAFE GENERIC IMAGES (topic-based, city-neutral) ─────────────────────────
export const GENERIC = {
    /** Italian piazza — warm, cobblestone, people */
    piazza: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    /** Church / cathedral */
    church: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800',
    /** Market / food hall */
    market: 'https://images.unsplash.com/photo-1555685812-4b943f3e99a9?w=800',
    /** Park / villa / garden */
    park: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800',
    /** Food / restaurant */
    food: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
    /** Museum / gallery */
    museum: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
    /** Seaside / coast / harbour */
    sea: 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
    /** Mountain / alpine */
    mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    /** Shopping / boutique */
    shopping: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
    /** Nightlife / aperitivo */
    nightlife: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800',
    /** Tour / travel generic */
    tour: 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=800',
    /** Business / activity */
    business: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
};

// ─── CITY COVER IMAGES ────────────────────────────────────────────────────────
export const CITY_IMAGES = {
    'Roma': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    'Milano': 'https://images.unsplash.com/photo-1476493279419-b785d41e38d8?w=800',
    'Firenze': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
    'Venezia': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800',
    'Napoli': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800',
    'Torino': 'https://images.unsplash.com/photo-1587982153163-e8e0d0a39e4b?w=800',
    'Palermo': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=800',
    'Bari': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
    'Bologna': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
    'Genova': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
    'Verona': 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=800',
    'Perugia': 'https://images.unsplash.com/photo-1626127117105-098555e094c9?w=800',
    'Catania': 'https://images.unsplash.com/photo-1669229875416-654db55dc03f?w=800',
    'Treviso': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Padova': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Vicenza': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Udine': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Trieste': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Trento': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    'Bolzano': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    'Bergamo': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Brescia': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Como': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
    'Mantova': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'Modena': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
    'Parma': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
    'Ravenna': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
    'Ferrara': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
    'Siena': 'https://images.unsplash.com/photo-1520635565-e7a2cedc8d4b?w=800',
    'Pisa': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
    'Lucca': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
    'Assisi': 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800',
    'Ancona': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
    'Arezzo': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
    'Lecce': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
    'Matera': 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=800',
    'Salerno': 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=800',
    'Cagliari': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
    'Agrigento': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=800',
    'Reggio Calabria': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800',
};

// ─── KNOWN-BAD IMAGE FINGERPRINTS ────────────────────────────────────────────
/** Photo IDs that represent Rome-specific landmarks (Colosseum, etc.)
 *  and should NOT be used as fallback for non-Rome contexts. */
const ROME_SPECIFIC_FINGERPRINTS = [
    '1552832230',  // Colosseum / Palatine Hill
    '1565618244030-h200', // broken EWKB URL
];

const isBadImage = (url) => {
    if (!url || typeof url !== 'string') return true;
    if (!url.startsWith('http')) return true;
    return ROME_SPECIFIC_FINGERPRINTS.some(fp => url.includes(fp));
};

// ─── KEYWORD-BASED IMAGE PICKER ───────────────────────────────────────────────
const keywordImage = (label = '') => {
    const l = label.toLowerCase();
    if (l.includes('duomo') || l.includes('cattedrale') || l.includes('basilica') || l.includes('chiesa') || l.includes('san '))
        return GENERIC.church;
    if (l.includes('mercato') || l.includes('pescheria') || l.includes('forno'))
        return GENERIC.market;
    if (l.includes('parco') || l.includes('villa') || l.includes('giardino') || l.includes('verde'))
        return GENERIC.park;
    if (l.includes('pizza') || l.includes('ristorante') || l.includes('trattoria') || l.includes('osteria') || l.includes('cibo') || l.includes('carbonara') || l.includes('food'))
        return GENERIC.food;
    if (l.includes('museo') || l.includes('galleria') || l.includes('arte'))
        return GENERIC.museum;
    if (l.includes('porto') || l.includes('mare') || l.includes('lungomare') || l.includes('spiaggia') || l.includes('costa'))
        return GENERIC.sea;
    if (l.includes('mont') || l.includes('alp') || l.includes('dolomit') || l.includes('rifugio'))
        return GENERIC.mountain;
    if (l.includes('shopping') || l.includes('boutique') || l.includes('corso') || l.includes('via '))
        return GENERIC.shopping;
    if (l.includes('nightlife') || l.includes('aperitivo') || l.includes('navigli') || l.includes('bar'))
        return GENERIC.nightlife;
    return null;
};

/**
 * Returns the best image URL for a given item.
 *
 * Priority:
 *  1. `item.imageUrl` (if valid)
 *  2. `item.image` (if valid)
 *  3. `item.images[0]` (if valid)
 *  4. Keyword match from item title/name/label/category
 *  5. City-specific cover image
 *  6. Generic piazza (guaranteed, never the Colosseum)
 *
 * @param {object} item   - Any data object with image fields
 * @param {string} city   - Active city name (e.g. 'Treviso')
 * @returns {string}      - Always a valid https URL
 */
export const getItemImage = (item = {}, city = '') => {
    const candidates = [
        item.imageUrl,
        item.image,
        item.img,
        Array.isArray(item.images) ? item.images[0] : undefined,
        Array.isArray(item.image_urls) ? item.image_urls[0] : undefined,
    ];

    for (const url of candidates) {
        if (url && !isBadImage(url)) return url;
    }

    // Keyword match
    const label = item.title || item.name || item.label || item.category || '';
    const byKeyword = keywordImage(label);
    if (byKeyword) return byKeyword;

    // City cover
    if (city && CITY_IMAGES[city]) return CITY_IMAGES[city];

    // Ultimate safe fallback — warm Italian piazza, never the Colosseum
    return GENERIC.piazza;
};

/**
 * Shortcut: get the city cover image with a guaranteed piazza fallback.
 * @param {string} city
 * @returns {string}
 */
export const getCityImage = (city = '') =>
    CITY_IMAGES[city] || GENERIC.piazza;

/**
 * onError handler for <img> tags — replaces broken images in real-time.
 * Usage: <img src={url} onError={imgOnError(city)} />
 * @param {string} [city]
 * @returns {function}
 */
export const imgOnError = (city = '') => (e) => {
    const fallback = getCityImage(city);
    if (e.target.src !== fallback) {
        e.target.src = fallback;
    }
};
