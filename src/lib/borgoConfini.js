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
import { widerRadiusKm } from '../services/tourShape';

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

/** L'indirizzo di Google e' nel comune? null = senza indirizzo (non si giudica). */
export function nelComuneIndirizzo(c, comune) {
    const ind = c?.address ?? c?.formatted_address ?? c?.vicinity ?? null;
    if (!ind || !comune) return null;
    return new RegExp(`(^|[^a-z])${norm(comune).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(norm(ind));
}
