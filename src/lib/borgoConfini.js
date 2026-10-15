// TROINA-FIX — i confini del borgo: la natura puo' uscire dal comune, i luoghi storici no.
//
// DISTANZA PER LA NATURA NEI BORGHI: 12 km dal centro (NATURA_BORGO_KM), perche'
//   1. e' gia' la distanza che il prodotto accetta per un borgo quando vicino non c'e' abbastanza (`widerRadiusKm(true)` in
//      tourShape.js: nata per le spiagge di Cabras, a 11–12 km); qui vale per la natura senza aspettare che manchi tutto;
//   2. e' il raggio con cui le ricerche gia' chiedono a Google (bias della textsearch = R_wider): nessuna ricerca in piu',
//      nessun costo in piu', e il test che lega bias e filtro resta vero;
//   3. a Troina prende Monte Muganà (1,5 km) e Ponte di Failla (3,2 km) e lascia fuori i Nebrodi (17,5 km): un monte o un
//      lago appena oltre il confine si', un parco che e' un'altra gita no.
// Vale solo quando la richiesta e' di natura (categoria `natura` del traduttore: Quiz Natura, Sorprendimi Natura, Crea con
// «parchi», «natura»…): negli altri giri il borgo resta quello di prima (5 km, e 12 solo se vicino manca tutto).
// Il tempo per arrivarci e' quello della tappa (minuti a piedi dalla tappa prima, la frase approvata «È a … minuti a piedi»).
//
// I LUOGHI STORICI RESTANO NEL COMUNE: nel borgo una chiesa, un museo, un monumento, un castello o dei ruderi entrano solo se
// l'indirizzo di Google e' nel comune (il nome del comune nell'indirizzo, come `nelComune` della lista sul server). Senza
// indirizzo non si giudica.
import { placeKind, COMMERCIAL_KINDS } from './placeKind';
import { candidateFamily } from '../services/momentSelection';
import { widerRadiusKm, haversineKm } from '../services/tourShape';

export const NATURA_BORGO_KM = widerRadiusKm(true);

const TIPI_NATURA = new Set(['natural_feature', 'park', 'national_park', 'state_park', 'nature_preserve', 'hiking_area', 'scenic_spot',
    'botanical_garden', 'garden', 'campground', 'beach', 'lake', 'mountain_peak', 'observation_deck']);
const NOME_NATURA = /^(monte|lago|riserva|bosco|sentiero|cascat\w*|gol[ae]|valle|parco|giardin\w*|belvedere|pineta|oasi|spiaggia|cala|grotta)\b/i;
const TIPI_STORICI = new Set(['historical_landmark', 'historical_place', 'monument', 'castle', 'archaeological_site', 'fortress', 'palace',
    'museum', 'church', 'place_of_worship', 'cultural_landmark', 'ruins']);

const tipiDi = (c) => [...(Array.isArray(c?.types) ? c.types : []), c?.primaryType ?? c?.primary_type].filter(Boolean);
const nomeDi = (c) => String(c?.name || c?.title || '').trim();

/** Un luogo di natura o un panorama (parco, monte, lago, belvedere, sentiero…). Mai un locale o un negozio («Cala Ristorante»). */
export function isNaturaOPanorama(c) {
    if (COMMERCIAL_KINDS.has(placeKind(c).kind)) return false;
    const fam = candidateFamily(c);
    if (fam === 'verde' || fam === 'panorama') return true;
    if (placeKind(c).kind === 'verde') return true;
    return tipiDi(c).some(t => TIPI_NATURA.has(t)) || NOME_NATURA.test(nomeDi(c));
}

/** Un luogo storico (chiesa, museo, monumento, castello, ruderi, palazzo storico), che non sia natura. */
export function isLuogoStorico(c) {
    if (isNaturaOPanorama(c)) return false;
    const fam = candidateFamily(c);
    if (fam === 'chiesa' || fam === 'museo') return true;
    const k = placeKind(c).kind;
    if (k === 'chiesa' || k === 'museo') return true;
    return tipiDi(c).some(t => TIPI_STORICI.has(t));
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ─── BORGO-FIX (decisioni di Ivano, task BORGO-COMPLETO) ─────────────────────────────────────────────────────────────

// Decisione 6 — un posto di tipo parco o natura, o con SOLI tipi generici, che ha un NOME DA ORGANIZZAZIONE (azienda, agenzia,
// ente, consorzio, ufficio, associazione, cooperativa, escursioni, guide…) non e' una tappa e non entra nel conto del borgo:
// «Azienda Speciale Silvo Pastorale» e' un ente pubblico con sede in paese, «Cammina con Turi – Escursioni Nebrodi» un'agenzia.
// Regola generale, nessun elenco di nomi. Lettura dichiarata: i «soli tipi generici» contano INSIEME al nome (un rudere o una
// chiesa che Google tipizza solo come point_of_interest resta una tappa; un'agenzia con soli tipi generici no).
const NOME_ORGANIZZAZIONE = /\b(azienda|agenzia|ente|consorzio|uffici[oi]|associazione|cooperativa|coop|societ[aà]|s\.?r\.?l\.?|s\.?p\.?a\.?|onlus|pro loco|escursion\w*|guid[ae]\s+(?:turistic\w*|ambiental\w*|escursionistic\w*|naturalistic\w*|alpin\w*)|trekking|tour operator|noleggio)\b/i;
const TIPI_GENERICI = new Set(['point_of_interest', 'establishment']);
export function isOrganizzazione(c) {
    const tipi = tipiDi(c);
    const specifici = tipi.filter(t => !TIPI_GENERICI.has(t));
    const naturaOParco = tipi.some(t => TIPI_NATURA.has(t));
    if (!naturaOParco && specifici.length > 0) return false;
    return NOME_ORGANIZZAZIONE.test(nomeDi(c));
}

// Decisione 3 — la natura «DA FUORI» (monti, riserve, sentieri, boschi, parchi fuori dall'abitato) dopo il tramonto non e' una
// tappa, in nessun flusso; belvedere e piazze dentro il paese restano, e cosi' un lungomare o una spiaggia (C8a li ammette alla
// passeggiata). Da fuori = un tipo selvatico (sentiero, riserva, parco nazionale, cima), un nome da monte/riserva/sentiero/bosco,
// oppure un PARCO (tipo park/garden o nome da parco) a piu' di NATURA_DENTRO_KM dal centro: 1 km in un borgo, 3 in una citta'.
export const NATURA_DENTRO_KM = { borgo: 1, citta: 3 };
const TIPI_DA_FUORI = new Set(['hiking_area', 'nature_preserve', 'national_park', 'state_park', 'mountain_peak', 'campground']);
const NOME_DA_FUORI = /^(monte|montagna|riserva|bosco|sentiero|cascat\w*|gol[ae]|valle|vallone|pineta|oasi|grotta|cima|rifugio|pizzo|serra|rocca di)\b/i;
const TIPI_PARCO = new Set(['park', 'garden', 'botanical_garden']);
const NOME_PARCO = /^(parco|giardin[oi]|villa comunale|orto botanico)\b/i;
const isParco = (c) => tipiDi(c).some(t => TIPI_PARCO.has(t)) || NOME_PARCO.test(nomeDi(c));
export function isNaturaDaFuori(c, centro = null) {
    if (!isNaturaOPanorama(c)) return false;
    if (tipiDi(c).some(t => TIPI_DA_FUORI.has(t)) || NOME_DA_FUORI.test(nomeDi(c))) return true;
    if (!isParco(c)) return false;
    const lat = c?.latitude ?? c?.lat, lng = c?.longitude ?? c?.lng;
    if (centro && Number.isFinite(centro.latitude) && Number.isFinite(centro.longitude) && Number.isFinite(lat) && Number.isFinite(lng)) {
        const borgo = !!centro.isSmallTown || (Number.isFinite(centro.radiusKm) && centro.radiusKm <= 5);
        return haversineKm(centro.latitude, centro.longitude, lat, lng) > (borgo ? NATURA_DENTRO_KM.borgo : NATURA_DENTRO_KM.citta);
    }
    return false;
}

/** Decisione 3 — la nota di Ivano, alla lettera; la seconda frase solo con un posto di natura verificato per il giorno dopo. */
export const NOTA_NATURA_NOTTE = (luogo = null) => (luogo
    ? `La natura di notte non si vede. Stasera ti porto qui; domattina alle 9 si sale a ${luogo}.`
    : 'La natura di notte non si vede. Stasera ti porto qui.');

/** Decisione 1 — «giornata» o «domani» nel testo: il borgo non scende sotto mattina e pomeriggio. */
export const chiedeGiornata = (testo) => /\b(giornata|domani)\b/i.test(String(testo || ''));

/** L'indirizzo di Google e' nel comune? null = senza indirizzo (non si giudica). */
export function nelComuneIndirizzo(c, comune) {
    const ind = c?.address ?? c?.formatted_address ?? c?.vicinity ?? null;
    if (!ind || !comune) return null;
    return new RegExp(`(^|[^a-z])${norm(comune).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(norm(ind));
}
