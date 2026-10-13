/**
 * C7 — NIENTE ZONE: un'area generica non e' mai una tappa.
 *
 * Caso reale (Veloce Catania, 13/10): una tappa "Centro Storico Catania". Non e' un
 * posto da visitare, e' dove sei. Una zona puo' ORIENTARE la ricerca (e' nella
 * query), non diventare una tappa.
 *
 * Una zona e':
 *   · un posto con tipo PRINCIPALE geografico (locality, sublocality, neighborhood,
 *     political, route…);
 *   · un posto con un type geografico fra i types (locality, sublocality*,
 *     neighborhood, political, administrative_area*, postal_code*…);
 *   · un posto il cui NOME e' solo il nome di un'area ("Centro Storico Catania",
 *     "Centro Storico di Catania", "Zona Centro", "Quartiere", "Citta' vecchia"):
 *     Google registra il centro storico come tourist_attraction, quindi i types
 *     non lo tradiscono.
 *
 * Una VIA (`route`) come tipo principale e' una zona; un `route` fra i types di
 * un posto che ha anche un tipo di luogo vero (una piazza, un monumento) no.
 * "Quartiere Coppede'" non e' una zona per nome (nome proprio), lo e' per tipo.
 *
 * Puro: niente rete.
 */

const GEO_PRIMARY = new Set([
    'locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'sublocality_level_3', 'sublocality_level_4',
    'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'administrative_area_level_4',
    'administrative_area_level_5', 'political', 'neighborhood', 'route', 'postal_code', 'postal_code_prefix', 'postal_code_suffix',
    'country', 'continent', 'archipelago', 'geocode',
]);
// Nei types: tutti quelli geografici tranne `route`/`geocode` (compaiono anche su posti veri).
const GEO_TYPES = new Set([...GEO_PRIMARY].filter(t => t !== 'route' && t !== 'geocode'));

const norm = (s) => String(s ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Il nome, tolti la citta' e le parole di collegamento, e' una di queste: un'area, non un posto.
const AREA_NAMES = new Set([
    'centro storico', 'centro', 'centro citta', 'centro urbano', 'centro antico', 'citta vecchia', 'citta antica',
    'quartiere', 'zona', 'rione', 'zona centro', 'zona centrale', 'quartiere storico', 'old town', 'historic center',
    'historic centre', 'downtown', 'city center', 'city centre', 'the old town',
]);
const GLUE = new Set(['di', 'del', 'della', 'dello', 'de', 'il', 'lo', 'la', 'l', 'a', 'in', 'e']);

/** Il nome e' solo il nome di un'area (con o senza la citta')? */
export function isAreaName(name, cityName) {
    const n = norm(name);
    if (!n) return false;
    const c = norm(cityName);
    let rest = c ? n.split(c).join(' ') : n;
    rest = rest.split(' ').filter(w => w && !GLUE.has(w.replace(/'/g, ''))).join(' ').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
    return AREA_NAMES.has(rest);
}

/**
 * @returns {string|null} il motivo per cui e' una zona, o null se e' un posto
 */
export function zoneReason(place, cityName = null) {
    const primary = place?.primaryType ?? place?.primary_type ?? null;
    const types = Array.isArray(place?.types) ? place.types : [];
    if (primary && GEO_PRIMARY.has(primary)) return `tipo principale ${primary}`;
    const hit = types.find(t => GEO_TYPES.has(t));
    if (hit) return `tipo da zona ${hit}`;
    if (!primary && types.includes('route') && !types.some(t => t !== 'route' && t !== 'geocode' && t !== 'point_of_interest' && t !== 'establishment')) {
        return 'via (route) senza altro tipo di luogo';
    }
    const name = place?.name ?? place?.title ?? '';
    if (isAreaName(name, cityName ?? place?.city ?? null)) return `nome da area ("${name}")`;
    return null;
}

export const isZone = (place, cityName = null) => zoneReason(place, cityName) !== null;
