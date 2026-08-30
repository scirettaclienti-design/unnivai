/**
 * Gate RAGGIO — DIFF 1a (27/08). Durata di un tour: sosta + spostamento.
 *
 * ─── PERCHE' ESISTE ──────────────────────────────────────────────────────────
 * Prima di questo modulo la durata di ogni tappa era `suggestedMinutes`, un
 * numero CHIESTO AL MODELLO nello schema JSON dei prompt e accettato senza
 * validazione (`s.suggestedMinutes || 30`). Sei punti del codice lo leggevano.
 * Era un dato inventato, indistinguibile da uno misurato, ed era la stessa
 * classe del campo `time` (F57: orari 19:30 e 21:00 mostrati alle 23:10).
 *
 * ─── COSA E' QUESTO NUMERO, DETTO CHIARO ─────────────────────────────────────
 * NON e' una durata vera. E' una STIMA DEL PRODOTTO, e la differenza con
 * l'invenzione del modello e' triplice:
 *   1. e' UGUALE PER TUTTI — lo stesso tipo di posto dura lo stesso ovunque;
 *   2. e' ISPEZIONABILE — sta qui sotto, in chiaro, non dentro un'allucinazione;
 *   3. e' TESTABILE — un museo fa 60, e un test lo asserisce.
 * Google Places non fornisce durate di visita: non e' un dato che si possa
 * comprare. Questa tabella e' il meglio che si puo' dire onestamente.
 *
 * Corollario VINCOLANTE sulla UI: essendo una stima, va presentata come tale
 * ("~30 min", "circa 1h"). Un numero secco afferma una precisione che non
 * abbiamo, ed e' esattamente il difetto che questo modulo esiste per chiudere.
 */

// ─── Velocita' di camminata ───────────────────────────────────────────────────
// 4.5 km/h. Numero SCELTO, non misurato, e dichiarato tale: sta sotto i 5 km/h
// del profilo pedonale OSRM per tenere conto di semafori, attraversamenti e
// centri storici affollati. Se un giorno si misurera' sul campo (la telemetria
// nav esiste, `nav_events`), questa costante e' il posto dove cambiarlo.
export const WALKING_KMH = 4.5;

// Sosta di default quando i types non dicono niente di utile.
export const DEFAULT_STAY_MINUTES = 30;

/**
 * ─── TABELLA DI SOSTA ────────────────────────────────────────────────────────
 *
 * Deriva dai `types` GOOGLE, non da `type` (la categoria UI collassata da
 * `mapGoogleTypeToOurType`). I types arrivano interi da entrambi i path —
 * textsearch (`placesDiscoveryService`, `types: place.types || []`) e
 * place/details (`fetchPlaceDetailsForTour`, idem) — mentre `type` e' gia' una
 * riduzione a sei valori che perde l'informazione che serve qui: `church` e
 * `museum` collassano entrambi su 'cultura' ma durano 20 e 60.
 *
 * ─── PRECEDENZA, ED E' LA PARTE CHE CONTA ────────────────────────────────────
 * Un POI ha quasi sempre PIU' types: Google appiccica `point_of_interest` e
 * `establishment` quasi ovunque, e spesso `tourist_attraction` sopra a un type
 * specifico (una chiesa famosa e' `church` + `place_of_worship` +
 * `tourist_attraction` + `point_of_interest`).
 *
 * REGOLA: si scorre QUESTA lista in ordine e vince la PRIMA voce che matcha uno
 * dei types del POI. Non l'ordine dell'array di Google, che non e' garantito.
 *
 * L'ordine e' per SPECIFICITA' DELL'ESPERIENZA DOMINANTE, non per durata:
 * i types generici stanno in fondo perche' dicono "e' un posto", non "e' questo
 * posto". Quindi una chiesa turistica dura 20 (chiesa), non 30 (attrazione):
 * il motivo per cui ci entri e' che e' una chiesa.
 */
export const STAY_RULES = [
    // Musei e gallerie: la visita e' il motivo del viaggio.
    { minutes: 60, types: ['museum', 'art_gallery'] },
    // Ristoranti: un pasto seduto. Prima di bar/cafe, che sono una sosta breve:
    // un posto con entrambi i types e' un locale dove ci si siede.
    { minutes: 75, types: ['restaurant'] },
    // Luoghi di culto: si entra, si guarda, si esce. Vale anche quando sono
    // anche tourist_attraction — ed e' il caso che motiva l'ordine.
    { minutes: 20, types: ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'] },
    // Caffe' e bar: una consumazione.
    { minutes: 20, types: ['cafe', 'bar', 'bakery'] },
    // Verde e natura: una passeggiata dentro.
    { minutes: 30, types: ['park', 'natural_feature', 'zoo', 'aquarium', 'botanical_garden'] },
    // Generici: Google li mette quasi ovunque. Ultimi di proposito — se un POI
    // arriva qui, di specifico non sapevamo niente.
    { minutes: 30, types: ['tourist_attraction', 'point_of_interest'] },
];

/**
 * Sosta stimata per un POI, dai suoi types Google.
 * @param {string[]} types
 * @returns {number} minuti (mai null: la sosta ha sempre un default onesto)
 */
export function resolveStayMinutes(types) {
    if (!Array.isArray(types) || types.length === 0) return DEFAULT_STAY_MINUTES;
    const set = new Set(types);
    for (const rule of STAY_RULES) {
        if (rule.types.some(t => set.has(t))) return rule.minutes;
    }
    return DEFAULT_STAY_MINUTES;
}

/**
 * Distanza in km fra due punti (Haversine).
 * Duplicato locale e non import da `tourShape.js` di proposito: questo modulo
 * deve restare puro e senza dipendenze, come `narratorGuards.js`. La formula e'
 * la stessa e i due sono asseriti coerenti dal test.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Minuti di cammino fra due tappe.
 * Ritorna null — NON zero — se una delle due coordinate manca: zero direbbe
 * "sono nello stesso posto", che e' un'affermazione. null dice "non lo so", che
 * e' la verita', e i chiamanti lo trattano come assente.
 * @returns {number|null}
 */
export function travelMinutes(from, to) {
    if (!from || !to) return null;
    const lat1 = from.latitude ?? from.lat;
    const lon1 = from.longitude ?? from.lng;
    const lat2 = to.latitude ?? to.lat;
    const lon2 = to.longitude ?? to.lng;
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const km = haversineKm(lat1, lon1, lat2, lon2);
    return Math.round((km / WALKING_KMH) * 60);
}

/**
 * Arricchisce una lista di tappe GIA' ORDINATA con le stime di durata.
 *
 * ─── DEVE GIRARE DOPO L'ORDINAMENTO DEFINITIVO ───────────────────────────────
 * Lo spostamento e' una proprieta' della COPPIA di tappe consecutive, non della
 * singola tappa: riordinare dopo aver calcolato produrrebbe numeri attaccati
 * alla coppia sbagliata. E' lo stesso difetto che il campo `time` aveva
 * (il modello ordinava e assegnava, poi `sortByProximity` riordinava senza
 * ricalcolare) — qui e' strutturalmente impossibile solo se si rispetta questo
 * ordine di chiamata. Da qui il nome del parametro nei call site.
 *
 * PRIMA TAPPA: `travelMinutesFromPrev = null`, mai un numero.
 * Scelta dichiarata: NON si usa la posizione GPS dell'utente. Un tour si guarda
 * ora e si cammina dopo, spesso da un altro punto: un tempo di avvicinamento
 * calcolato sul GPS attuale sarebbe preciso e falso. Meglio non dire nulla.
 *
 * @param {Array} stops tappe ordinate, con latitude/longitude e types
 * @returns {{ stops: Array, totalMinutes: number }}
 */
export function computeStopTimings(stops) {
    if (!Array.isArray(stops) || stops.length === 0) {
        return { stops: [], totalMinutes: 0 };
    }
    const out = stops.map((s, i) => {
        const stayMinutes = resolveStayMinutes(s?.types);
        const travelMinutesFromPrev = i === 0 ? null : travelMinutes(stops[i - 1], s);
        return { ...s, stayMinutes, travelMinutesFromPrev };
    });
    const totalMinutes = out.reduce(
        (acc, s) => acc + s.stayMinutes + (s.travelMinutesFromPrev ?? 0),
        0,
    );
    return { stops: out, totalMinutes };
}

/**
 * Totale di un tour gia' arricchito: soste + spostamenti.
 * Esiste perche' i consumatori NON devono ri-sommare a mano — prima lo facevano
 * in quattro punti diversi con la stessa riga copiata, che e' un motore in
 * quattro copie (regola locked #8).
 */
export function totalTourMinutes(stops) {
    if (!Array.isArray(stops) || stops.length === 0) return 0;
    return stops.reduce((acc, s) => {
        const stay = Number.isFinite(s?.stayMinutes) ? s.stayMinutes : DEFAULT_STAY_MINUTES;
        const travel = Number.isFinite(s?.travelMinutesFromPrev) ? s.travelMinutesFromPrev : 0;
        return acc + stay + travel;
    }, 0);
}

/**
 * Formatta una stima per la UI. Il tilde NON e' decorativo: e' la dichiarazione
 * che il numero e' una stima. Chi mostra durate deve passare da qui.
 * @returns {string|null} null se non c'e' niente di onesto da dire
 */
export function formatEstimate(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `circa ${h}h`;
    return `circa ${h}h ${m}min`;
}

/**
 * ─── OFFSET CUMULATIVO — DIFF 1b ─────────────────────────────────────────────
 *
 * Quanto tempo e' passato DALL'INIZIO DEL PERCORSO quando arrivi alla tappa i.
 * NON e' un orario: e' una distanza temporale dal punto di partenza. La
 * differenza non e' formale, e' la stessa che ha ucciso il campo `time` (F57,
 * orari 19:30 e 21:00 mostrati alle 23:10): un orario afferma QUANDO, e per
 * saperlo servirebbe sapere a che ora l'utente parte — cosa che non sappiamo.
 * Un offset afferma DOPO QUANTO, ed e' vero a qualunque ora si parta.
 *
 * FORMULA: offset[0] = 0; offset[i] = offset[i-1] + stay[i-1] + travel[i].
 * Ci arrivi dopo aver sostato in tutte le tappe precedenti e aver camminato
 * fino a qui.
 *
 * ─── NULL ASSORBENTE, ED E' LA REGOLA CHE CONTA ──────────────────────────────
 * Se un addendo manca, l'offset di quella tappa E DI TUTTE LE SUCCESSIVE e'
 * null. Non si somma zero: zero e' un'affermazione ("da qui a li' non ci si
 * sposta"), null e' la verita' ("non lo so"). Ed e' contagioso per costruzione:
 * un cumulativo con un buco in mezzo non e' approssimato, e' falso — tutto
 * quello che viene dopo erediterebbe l'errore senza dirlo.
 *
 * LA PRIMA TAPPA NON E' UN BUCO. Il suo `travelMinutesFromPrev` e' null per
 * scelta dichiarata (vedi computeStopTimings: non usiamo il GPS dell'utente),
 * ma quel null non assorbe: la prima tappa E' l'origine della misura, offset 0.
 * Se assorbisse, ogni tour avrebbe la timeline vuota.
 *
 * @param {Array} stops tappe gia' passate da computeStopTimings
 * @returns {Array<number|null>} un offset in minuti per tappa, allineato per indice
 */
export function computeCumulativeOffsets(stops) {
    if (!Array.isArray(stops) || stops.length === 0) return [];
    const out = [];
    let acc = 0;
    let broken = false;
    for (let i = 0; i < stops.length; i++) {
        // La prima tappa e' l'origine: 0, e il suo travel null non entra nel giro.
        if (i === 0) { out.push(0); continue; }
        if (broken) { out.push(null); continue; }
        const prevStay = stops[i - 1]?.stayMinutes;
        const travel = stops[i]?.travelMinutesFromPrev;
        // `?? 0` qui sarebbe il difetto: direbbe "sosta zero" / "spostamento
        // zero" dove il dato manca, e propagherebbe l'affermazione a valle.
        if (!Number.isFinite(prevStay) || !Number.isFinite(travel)) {
            broken = true;
            out.push(null);
            continue;
        }
        acc += prevStay + travel;
        out.push(acc);
    }
    return out;
}

/**
 * Etichetta di un offset per la UI. Unico punto in cui un offset diventa testo:
 * nessun numero secco raggiunge il render.
 *
 * Il `+` dice che e' una distanza dall'inizio, non un orario — la stessa
 * funzione che il tilde ha in formatEstimate, che dichiara la stima.
 * La prima tappa legge "Inizio", mai "+0 min": scrivere "+0 min" affermerebbe
 * di aver misurato un tempo di avvicinamento e averlo trovato nullo.
 *
 * @returns {string|null} null se non c'e' niente di onesto da dire
 */
export function formatOffsetLabel(minutes) {
    if (minutes === 0) return 'Inizio';
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `+${m} min`;
    if (m === 0) return `+${h}h`;
    return `+${h}h ${m}`;
}
