/**
 * GIRO-EDIT — «Cambia»: UNA ricerca mirata vicino alla tappa, guidata dal testo dell'utente e dal DNA.
 *
 * Stessa via della ricerca della sosta (DNA-3c): il proxy dei posti di sempre (`discoverRealPOIs`: stessi filtri di verifica),
 * la soglia di qualita' di sempre, aperto all'ora d'arrivo per tutta la sosta, entro `RAGGIO_CAMBIO_M` dalla tappa che si cambia.
 * Il testo non si salva da nessuna parte; non c'e' nessuna chiamata a OpenAI: il testo si legge con una tabella di parole.
 * Se non trova niente lo dice in una riga e la tappa resta.
 *
 * Costo per cambio: UNA ricerca di testo, 0,032 $ al listino del banco (`place/textsearch`); 0 $ se la stessa ricerca e' nella cache
 * (24 ore, ricerca e punto arrotondato a 3 decimali, sul telefono e sul proxy).
 */

import { canonicalizeStopsFromCandidates } from '@/services/aiRecommendationService';
import { passesQualityThreshold, computeAffinityScore, mapCandidateToCoreCategories } from '@/services/candidateScoring';
import { haversineKm } from '@/lib/tourTiming';
import { openStatus, OPEN, UNKNOWN, romeMinutes } from '@/lib/openingHours';
import { placeKind } from '@/lib/placeKind';
import { momentAdmits, mealFitsClock, dolceProblem } from '@/lib/mealRules';
import { chiaveTappa } from '@/lib/giroEdit';

export const RAGGIO_CAMBIO_M = 500;
export const COSTO_CAMBIO_USD = 0.032;
export const MESSAGGIO_NIENTE_DI_ADATTO = 'Non ho trovato niente di adatto qui vicino: la tappa resta.';
export const MESSAGGIO_RICERCA_FALLITA = 'Non sono riuscito a cercare adesso: la tappa resta.';

/**
 * Le parole dell'utente → una ricerca. La prima riga che riconosce vince. `esplicita`: l'utente ha chiesto un TIPO di locale,
 * che vince sulle fasce dei pasti (uno street food nel pomeriggio, un gelato dopo cena) ma non sull'orario di apertura.
 */
export const RICERCHE_DAL_TESTO = [
    { id: 'street-food', re: /\b(street ?food|rosticcer\w*|arancin\w*|panell\w*|paninotec\w*|friggitor\w*|tavola calda|da asporto|veloce)\b/, query: 'street food rosticceria arancine', kind: 'FOOD', esplicita: true },
    { id: 'colazione', re: /\b(colazion\w*|cornett\w*|brioche|cappuccin\w*|caff[eè]\w*|caffetter\w*|bar storic\w*)\b/, query: 'caffè storico pasticceria bar', kind: 'FOOD', esplicita: true },
    { id: 'dolce', re: /\b(gelat\w*|dolc\w*|pasticcer\w*|granit\w*|cannol\w*|cioccolat\w*)\b/, query: 'gelateria pasticceria', kind: 'FOOD', esplicita: true },
    { id: 'pasto', re: /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|pranz\w*|cen[ae]\b)\b/, query: 'trattoria ristorante osteria', kind: 'FOOD', esplicita: true },
    { id: 'aperitivo', re: /\b(aperitiv\w*|cocktail|enotec\w*|vino|bere|drink|wine bar|pub|bar)\b/, query: 'bar enoteca aperitivo', kind: 'FOOD', esplicita: true },
    { id: 'museo', re: /\b(muse[io]|galleri\w*|mostr\w*|arte|pinacotec\w*)\b/, query: 'museo galleria d\'arte', kind: 'CULTURA', esplicita: true },
    { id: 'chiesa', re: /\b(chies\w*|duom\w*|cattedral\w*|basilic\w*|chiostr\w*)\b/, query: 'chiesa cattedrale chiostro', kind: 'CULTURA', esplicita: true },
    { id: 'storia', re: /\b(stori\w*|monument\w*|castell\w*|palazz\w*|archeolog\w*|antic\w*)\b/, query: 'monumento palazzo storico castello', kind: 'CULTURA', esplicita: true },
    { id: 'panorama', re: /\b(panoram\w*|belveder\w*|vista|terrazz\w*)\b/, query: 'belvedere punto panoramico terrazza', kind: 'CULTURA', esplicita: true },
    { id: 'verde', re: /\b(parc[oh]\w*|giardin\w*|verde|natura|villa comunale|passeggiata|all'aperto|aperto)\b/, query: 'parco giardino villa comunale', kind: 'NATURA', esplicita: true },
    { id: 'tranquillo', re: /\b(tranquill\w*|calm\w*|silenzios\w*|rilassant\w*|quiet|meno (?:caos|gente|turisti\w*|affollat\w*)|riposar\w*|relax)\b/, query: 'giardino chiostro parco villa tranquillo', kind: 'NATURA', esplicita: false },
    { id: 'negozi', re: /\b(negoz\w*|shopping|botteghe|bottega|artigian\w*|mercat\w*|libreri\w*|boutique)\b/, query: 'bottega artigianato mercato libreria', kind: 'CULTURA', esplicita: true },
    { id: 'locale', re: /\b(local[ei]|autentic\w*|tipic\w*|nascost\w*|meno turistic\w*|insolit\w*)\b/, query: 'bottega storica trattoria tipica mercato', kind: 'CULTURA', esplicita: false },
];

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Il testo di «Cambia» → la ricerca. Un testo che la tabella non riconosce va a Google com'e' (una frase naturale, una sola ricerca);
 * un testo vuoto cerca «un altro posto come questo»: la stessa famiglia della tappa che si cambia.
 * @returns {{ query: string, kind: string, esplicita: boolean, id: string }}
 */
export function leggiTestoDelCambio(testo, tappa = null) {
    const t = norm(testo);
    if (t) {
        const r = RICERCHE_DAL_TESTO.find(x => x.re.test(t));
        if (r) return { id: r.id, query: r.query, kind: r.kind, esplicita: r.esplicita };
        return { id: 'testo', query: String(testo).trim().slice(0, 80), kind: 'CULTURA', esplicita: false };
    }
    const { kind } = placeKind({ types: tappa?.types, primaryType: tappa?.primaryType });
    if (kind === 'verde') return { id: 'verde', query: 'parco giardino villa comunale', kind: 'NATURA', esplicita: false };
    if (['pasto', 'spuntino'].includes(kind)) return { id: 'pasto', query: 'trattoria ristorante osteria', kind: 'FOOD', esplicita: false };
    if (['caffe', 'forno', 'dolce', 'bar'].includes(kind)) return { id: 'colazione', query: 'caffè storico pasticceria bar', kind: 'FOOD', esplicita: false };
    if (kind === 'chiesa') return { id: 'chiesa', query: 'chiesa cattedrale chiostro', kind: 'CULTURA', esplicita: false };
    return { id: 'storia', query: 'monumento palazzo storico museo', kind: 'CULTURA', esplicita: false };
}

const puntoDi = (x) => [x?.latitude ?? x?.lat, x?.longitude ?? x?.lng];
const nomeNorm = (c) => norm(c?.name || c?.title).replace(/[^a-z0-9]+/g, ' ').trim();
const idDi = (c) => c?.place_id || c?.googlePlaceId || null;

/**
 * Sceglie, fra i candidati della ricerca, il posto che sostituisce la tappa. Pura (niente rete): la usano il servizio e i test.
 * @returns {{ scelto: object|null, scartati: Record<string, number> }}
 */
export function scegliSostituta({ candidati, tappa, giorno = [], lettura, dnaWeights = {}, city = null, raggioM = RAGGIO_CAMBIO_M }) {
    const scartati = {};
    const no = (m) => { scartati[m] = (scartati[m] || 0) + 1; };
    const [lat, lng] = puntoDi(tappa);
    const arrivo = tappa?.scheduledTime ? new Date(tappa.scheduledTime) : null;
    const sosta = Number.isFinite(tappa?.stayMinutes) && tappa.stayMinutes > 0 ? tappa.stayMinutes : 30;
    const usati = new Set((giorno || []).flatMap(s => [idDi(s), nomeNorm(s)]).filter(Boolean));
    const altre = (giorno || []).filter(s => !s?.tempoLibero && chiaveTappa(s) !== chiaveTappa(tappa)).map(s => ({ c: s }));
    const minuti = arrivo ? romeMinutes(arrivo) : null;
    const buoni = [];
    for (const c of candidati || []) {
        const id = idDi(c);
        if (!id) { no('senza identificativo'); continue; }
        if (usati.has(id) || usati.has(nomeNorm(c))) { no('gia\' nel giro'); continue; }
        const [clat, clng] = puntoDi(c);
        if (![lat, lng, clat, clng].every(Number.isFinite)) { no('senza coordinate'); continue; }
        const distM = haversineKm(lat, lng, clat, clng) * 1000;
        if (distM > raggioM) { no('oltre i 500 m'); continue; }
        if (!passesQualityThreshold(c, city)) { no('sotto la soglia di qualita\''); continue; }
        // aperto per tutta la sosta all'ora d'arrivo; senza orario Google si accetta solo un posto all'aperto, di giorno
        if (arrivo) {
            const stato = openStatus(c, arrivo, sosta).stato;
            const { kind } = placeKind({ types: c.types, primaryType: c.primaryType });
            const apertoAlloStesso = kind === 'verde' && minuti !== null && minuti >= 7 * 60 && minuti <= 19 * 60;
            if (!(stato === OPEN || (stato === UNKNOWN && apertoAlloStesso))) { no('chiuso o senza orario a quell\'ora'); continue; }
        }
        // le fasce dei pasti valgono se l'utente non ha chiesto un tipo di locale: lo street food nel pomeriggio, se lo chiede, si fa
        if (!lettura?.esplicita && tappa?.moment) {
            if (!momentAdmits(c, { key: tappa.moment })) { no('non adatto al momento'); continue; }
            if (minuti !== null && !mealFitsClock(c, minuti)) { no('pasto fuori fascia'); continue; }
        }
        if (minuti !== null && dolceProblem(c, minuti, altre)) { no('secondo dolce o dolce prima del pasto'); continue; }
        const voto = Number(c.rating) || 0;
        const dna = computeAffinityScore(c, dnaWeights);
        // il voto guida (0..5), il DNA spinge fino a un punto, la vicinanza decide a parita'
        buoni.push({ c, punti: voto + dna - distM / 5000, distM });
    }
    buoni.sort((a, b) => b.punti - a.punti);
    return { scelto: buoni[0]?.c ?? null, distanzaM: buoni[0] ? Math.round(buoni[0].distM) : null, scartati };
}

/**
 * «Cambia» una tappa: una ricerca, la scelta, la tappa nuova nella forma delle schede.
 * @param {object} p
 * @param {object} p.tappa      la tappa da cambiare (con coordinate, `scheduledTime`, `stayMinutes`, `moment`)
 * @param {Array}  p.giorno     le tappe del giorno (per non ripetere un posto)
 * @param {string} p.testo      cosa vuole l'utente (puo' essere vuoto)
 * @param {string} p.city
 * @param {object} [p.dnaWeights]
 * @param {Function} [p.cerca]  `(query, kind, lat, lng, raggioM) => Promise<Array>`; per i test (default: il proxy dei posti)
 * @returns {Promise<{ ok: boolean, stop?: object, messaggio?: string, report: object }>}
 */
export async function cambiaTappa({ tappa, giorno = [], testo = '', city, dnaWeights = {}, cerca = null }) {
    const lettura = leggiTestoDelCambio(testo, tappa);
    const [lat, lng] = puntoDi(tappa);
    const report = { lettura: { id: lettura.id, query: lettura.query, kind: lettura.kind, esplicita: lettura.esplicita }, raggioM: RAGGIO_CAMBIO_M, ricerche: 1, costoMassimoUsd: COSTO_CAMBIO_USD, trovati: 0, scartati: {}, scelto: null };
    if (![lat, lng].every(Number.isFinite)) return { ok: false, messaggio: MESSAGGIO_NIENTE_DI_ADATTO, report: { ...report, ricerche: 0, costoMassimoUsd: 0, motivo: 'la tappa non ha coordinate' } };
    let lista;
    try {
        if (cerca) lista = await cerca(lettura.query, lettura.kind, lat, lng, RAGGIO_CAMBIO_M);
        else {
            const { placesDiscoveryService } = await import('@/services/placesDiscoveryService');
            lista = await placesDiscoveryService.discoverRealPOIs(city, lat, lng, null, { customQuery: lettura.query, customKind: lettura.kind, radiusMeters: RAGGIO_CAMBIO_M, maxResults: 20 });
        }
    } catch (err) {
        return { ok: false, messaggio: MESSAGGIO_RICERCA_FALLITA, report: { ...report, errore: String(err?.message || err).slice(0, 120) } };
    }
    const candidati = Array.isArray(lista) ? lista : [];
    report.trovati = candidati.length;
    const { scelto, distanzaM, scartati } = scegliSostituta({ candidati, tappa, giorno, lettura, dnaWeights, city });
    report.scartati = scartati;
    if (!scelto) return { ok: false, messaggio: MESSAGGIO_NIENTE_DI_ADATTO, report };
    const [stop] = canonicalizeStopsFromCandidates([{ place_id: idDi(scelto) }], [scelto], { guard: false });
    if (!stop) return { ok: false, messaggio: MESSAGGIO_NIENTE_DI_ADATTO, report: { ...report, motivo: 'posto non canonizzabile' } };
    // la categoria della tappa nuova (per il DNA): la prima delle categorie di base del posto
    const categoria = [...mapCandidateToCoreCategories(scelto)][0] || null;
    report.scelto = { nome: stop.title, place_id: idDi(scelto), distanzaM, categoria };
    return { ok: true, stop: { ...stop, description: null, scelta: 'cambiata' }, categoria, report };
}
