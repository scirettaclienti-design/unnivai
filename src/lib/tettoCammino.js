/**
 * BANCO-DIFETTI (T19, D1) — il tetto di cammino fra due tappe consecutive di un giro a piedi: 1,2 km (decisione di Ivano, 05/11/2026).
 *
 * Vale per Per Te e per tutti i giri a piedi (Crea, Veloce, Sorprendimi), salvo che il giro lo dichiari (un giro lungo a piedi chiesto
 * dall'utente: la tratta lunga si dice nel giro). Con il ritmo Intenso il giro usa qualche mezzo e il tetto non vale (banco: 5 km).
 *
 * In Crea il tetto entra nella scelta come minuti (`MAX_WALK_MINUTES` di momentSelection = 16 minuti a 4,5 km/h = 1,2 km).
 * In Per Te le tappe vengono dal selettore per tema senza distanza: qui le funzioni pure che le tengono dentro il tetto —
 * il gruppo piu' grande di tappe legate da tratti entro il tetto, e il taglio dei tratti che restano lunghi.
 *
 * Pure: niente rete, niente orologio.
 */
import { haversineKm, WALKING_KMH } from './tourTiming';

/** Il tetto a piedi fra due tappe consecutive, in km. */
export const TETTO_PIEDI_KM = 1.2;
/** Lo stesso tetto in minuti a piedi (4,5 km/h): 16. */
export const TETTO_PIEDI_MINUTI = Math.round((TETTO_PIEDI_KM / WALKING_KMH) * 60);

const latOf = (s) => Number(s?.latitude ?? s?.lat);
const lngOf = (s) => Number(s?.longitude ?? s?.lng);

/** La distanza in linea d'aria fra due tappe, in km; null senza coordinate. */
export function kmTratto(a, b) {
    const v = [latOf(a), lngOf(a), latOf(b), lngOf(b)];
    if (!v.every(Number.isFinite)) return null;
    return haversineKm(v[0], v[1], v[2], v[3]);
}

/** Un tratto sta nel tetto? Senza coordinate non si misura: si tiene. */
export const nelTetto = (a, b, capKm = TETTO_PIEDI_KM) => {
    const km = kmTratto(a, b);
    return km == null || km <= capKm;
};

/**
 * Il gruppo piu' grande di tappe legate da tratti entro il tetto (legame singolo: ogni tappa del gruppo ha almeno un'altra
 * tappa del gruppo entro il tetto). A parita' vince il gruppo che contiene la tappa che viene prima nella lista (l'ordine del
 * selettore). Le tappe senza coordinate restano nel gruppo scelto.
 * @param {Array} stops
 * @param {number} [capKm]
 * @returns {{ tenute: Array, tolte: Array }} nell'ordine di partenza
 */
export function gruppoNelTetto(stops, capKm = TETTO_PIEDI_KM) {
    const list = Array.isArray(stops) ? stops : [];
    const misurabili = list.map((s, i) => ({ s, i })).filter(({ s }) => Number.isFinite(latOf(s)) && Number.isFinite(lngOf(s)));
    if (misurabili.length <= 1) return { tenute: list.slice(), tolte: [] };
    const gruppo = new Array(list.length).fill(-1);
    let n = 0;
    for (const { i } of misurabili) {
        if (gruppo[i] !== -1) continue;
        gruppo[i] = n;
        const coda = [i];
        while (coda.length) {
            const k = coda.shift();
            for (const { s, i: j } of misurabili) {
                if (gruppo[j] !== -1) continue;
                const km = kmTratto(list[k], s);
                if (km != null && km <= capKm) { gruppo[j] = n; coda.push(j); }
            }
        }
        n++;
    }
    const conta = new Array(n).fill(0);
    for (const { i } of misurabili) conta[gruppo[i]]++;
    // il piu' numeroso; a parita' quello della tappa che viene prima
    let migliore = gruppo[misurabili[0].i];
    for (const { i } of misurabili) if (conta[gruppo[i]] > conta[migliore]) migliore = gruppo[i];
    const tenute = [], tolte = [];
    list.forEach((s, i) => ((gruppo[i] === -1 || gruppo[i] === migliore) ? tenute : tolte).push(s));
    return { tenute, tolte };
}

/**
 * I tratti oltre il tetto di una lista gia' in ordine di cammino.
 * @returns {Array<{ da: object, a: object, indice: number, km: number }>} indice = la tappa d'arrivo
 */
export function trattiLunghi(stops, capKm = TETTO_PIEDI_KM) {
    const out = [];
    const list = Array.isArray(stops) ? stops : [];
    for (let i = 1; i < list.length; i++) {
        const km = kmTratto(list[i - 1], list[i]);
        if (km != null && km > capKm) out.push({ da: list[i - 1], a: list[i], indice: i, km: Math.round(km * 100) / 100 });
    }
    return out;
}

/**
 * Toglie, in ordine di cammino, la tappa d'arrivo di ogni tratto oltre il tetto (la prima tappa resta: e' da li' che si parte),
 * rimettendo in ordine dopo ogni taglio con `riordina` (se c'e'). Finisce quando nessun tratto supera il tetto.
 * @param {Array} stops in ordine di cammino
 * @param {{ capKm?: number, riordina?: (list: Array) => Array }} [opts]
 * @returns {{ tenute: Array, tolte: Array<{ tappa: object, km: number, da: object }> }}
 */
export function tagliaTrattiLunghi(stops, { capKm = TETTO_PIEDI_KM, riordina = null } = {}) {
    let list = Array.isArray(stops) ? stops.slice() : [];
    const tolte = [];
    for (let giri = 0; giri < 50; giri++) {
        const [primo] = trattiLunghi(list, capKm);
        if (!primo) break;
        tolte.push({ tappa: primo.a, km: primo.km, da: primo.da });
        list = list.filter((_, i) => i !== primo.indice);
        if (riordina) list = riordina(list);
    }
    return { tenute: list, tolte };
}

/**
 * Da quale tappa partire perche' il giro stia nel tetto: prova ogni tappa come prima, mette in ordine con `ordina` (la prima resta
 * prima) e tiene l'ordine con meno tratti oltre il tetto; a parita' resta la partenza di prima (la prima della lista: per Per Te la
 * perla del selettore), cosi' un giro gia' nel tetto non cambia.
 * Serve al vicino-piu'-vicino di Per Te, che partendo dalla tappa sbagliata lascia un tratto lungo in fondo.
 * @param {Array} stops
 * @param {(list: Array) => Array} ordina mette in ordine di cammino tenendo la prima tappa
 * @param {number} [capKm]
 * @returns {Array}
 */
export function migliorePartenza(stops, ordina, capKm = TETTO_PIEDI_KM) {
    const list = Array.isArray(stops) ? stops : [];
    if (list.length <= 2) return ordina(list);
    let migliore = null;
    list.forEach((s, i) => {
        const ordine = ordina([s, ...list.filter((_, j) => j !== i)]);
        const lunghi = trattiLunghi(ordine, capKm).length;
        if (!migliore || lunghi < migliore.lunghi) migliore = { ordine, lunghi };
    });
    return migliore.ordine;
}
