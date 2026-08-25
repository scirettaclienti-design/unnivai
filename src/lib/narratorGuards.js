/**
 * Gate NARRATORE ANCORATO — DIFF 4: gli invarianti sull'output del narratore.
 *
 * Il problema: DIFF 1, DIFF 3, F55 e F56 hanno corretto cinque difetti in tre
 * prompt, e nessuno di quei difetti sarebbe stato visto da un test. Le regole
 * anti-fake scansionano il SORGENTE; il testo del narratore nasce a RUNTIME.
 * Sono stati tutti trovati su iPhone, dopo il deploy.
 *
 * Il vincolo: l'output di un modello NON è deterministico. "La description è
 * buona" non è un'asserzione verificabile. Qui vivono solo gli invarianti che
 * valgono per QUALSIASI output valido.
 *
 * Due candidati SCARTATI in fase di progetto, e restano fuori di proposito:
 *   · lessico food su POI non-food — è una BLOCKLIST (lezione #19): basta un
 *     termine non in lista per passare, e un museo con caffetteria produce un
 *     falso positivo su testo vero;
 *   · description quasi-uguali — richiede una soglia di similarità da tarare,
 *     cioè un test che fallisce a caso, cioè la prossima `skip: true`.
 *
 * COSA QUESTI GUARD NON VEDONO — leggere prima di fidarsi:
 * coprono i difetti di FORMA (orari, temporalità). NON vedono i contenuti
 * inventati: "Non perderti la sezione dedicata agli artisti emergenti" su una
 * basilica non viola nessun invariante — nessun orario, nessun presente,
 * nessun duplicato. È il difetto F55, il più grave dei cinque, e resta
 * invisibile. Verificarlo richiederebbe sapere cosa contiene la basilica.
 *
 * Funzione PURA: nessuna I/O, nessun log, nessun throw. Ritorna le violazioni,
 * il chiamante decide cosa farne (Fase B: solo log). Stesso pattern di
 * poiPhoto.js, mapCenter.js e ci-gate-parser.mjs.
 */

/** I campi di testo prodotti dal narratore. `title` NON è suo: viene da Google. */
const CAMPI = ['description', 'insiderTip', 'bestTime', 'transition'];

/**
 * Un orario AFFERMATO: cifra introdotta da una preposizione temporale, oppure
 * associata a un verbo di apertura/chiusura.
 * La preposizione è obbligatoria: "Tre navate e 12 colonne" non è un orario, e
 * un POI che si chiama "Caffè 19" non deve far scattare nulla.
 */
const ORARIO = [
    /\b(?:alle|dalle|fino alle|entro le)\s*\d{1,2}(?:[:.]\d{2})?\b/i,
    /\b(?:apre|aprono|chiude|chiudono|apertura|chiusura)\b[^.!?]{0,24}?\b\d{1,2}(?:[:.]\d{2})?\b/i,
];

/**
 * Un riferimento al presente. Il narratore non sa cosa stia accadendo adesso in
 * un posto: non ha orari, non ha affluenza, non ha nulla di istantaneo.
 *
 * WORD-BOUNDARY OBBLIGATORIO. Misurato in fase di progetto: `'ora' in testo`
 * dà 3 falsi positivi su 6 frasi legittime — "ancora", "sonora", "lavora" —
 * perché in tutte e tre "ora" è preceduto da un carattere di parola e quindi
 * `\bora\b` NON matcha. È l'unica ragione per cui questo invariante è
 * utilizzabile: la versione naive sarebbe stata disattivata in due settimane.
 */
const PRESENTE = [
    /\b(?:ora|adesso)\b/i,
    /\bin questo momento\b/i,
];

const normalizza = (t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ');

const primaCorrispondenza = (testo, regexes) => {
    for (const re of regexes) {
        const m = re.exec(testo);
        if (m) return m[0];
    }
    return null;
};

/**
 * Violazioni di UNO stop, sui suoi campi di testo.
 *
 * NOTA sulla firma: il progetto prevedeva `findViolations(stop, candidate)`.
 * `candidate` serviva all'invariante sul lessico food, che è stato scartato:
 * nessuno dei tre invarianti superstiti guarda i dati Google. Un parametro non
 * usato è peso morto, quindi non c'è.
 *
 * @param {object|null} stop
 * @returns {Array<{campo: string, invariante: string, estratto: string}>}
 */
export function findViolations(stop) {
    if (!stop || typeof stop !== 'object') return [];
    const violazioni = [];

    for (const campo of CAMPI) {
        const valore = stop[campo];
        // null/undefined non sono violazioni: sono l'uscita onesta che i prompt
        // ammettono esplicitamente per insiderTip e bestTime.
        if (typeof valore !== 'string' || !valore.trim()) continue;

        const orario = primaCorrispondenza(valore, ORARIO);
        if (orario) violazioni.push({ campo, invariante: 'no-orario-affermato', estratto: orario });

        const presente = primaCorrispondenza(valore, PRESENTE);
        if (presente) violazioni.push({ campo, invariante: 'no-presente-affermato', estratto: presente });
    }

    return violazioni;
}

/**
 * Violazioni di un TOUR: quelle che si vedono solo confrontando gli stop fra
 * loro. Funzione separata da `findViolations` perché il soggetto è diverso —
 * una lista, non uno stop — e passare `(stop, indice, lista)` avrebbe reso la
 * firma del caso semplice ostaggio del caso complesso.
 *
 * Include anche le violazioni per-stop, così il chiamante fa una chiamata sola.
 * Il confronto sulle description è ESATTO su testo normalizzato: due POI diversi
 * non producono la stessa frase per caso, quindi falsi positivi zero. Il rischio
 * vero introdotto da F55 sono le description SIMILI, e quello non è verificabile
 * deterministicamente: resta device-only, dichiarato.
 *
 * @param {Array|null} stops
 * @returns {Array<{campo: string, invariante: string, estratto: string, indice: number}>}
 */
export function findTourViolations(stops) {
    if (!Array.isArray(stops)) return [];
    const violazioni = [];
    const vistePrima = new Map();

    stops.forEach((stop, indice) => {
        for (const v of findViolations(stop)) violazioni.push({ ...v, indice });

        const desc = stop?.description;
        if (typeof desc !== 'string' || !desc.trim()) return;
        const chiave = normalizza(desc);
        if (vistePrima.has(chiave)) {
            violazioni.push({
                campo: 'description',
                invariante: 'no-description-duplicata',
                estratto: desc.slice(0, 60),
                indice,
                indiceOriginale: vistePrima.get(chiave),
            });
        } else {
            vistePrima.set(chiave, indice);
        }
    });

    return violazioni;
}
