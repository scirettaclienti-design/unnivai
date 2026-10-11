/**
 * P3d-j — Il modello sceglie, il codice scrive.
 *
 * Ogni descrizione di tappa e' composta QUI, con le frasi approvate (elenco
 * qui sotto, parola per parola). Il modello non scrive testo per le tappe:
 * per ognuna sceglie solo fra opzioni chiuse —
 *   usaFatto   si'/no: aprire con il fatto (Wikipedia) invece della frase;
 *   gancio     tramonto | legame | distanza | prima | ultima | orario;
 *   interesse  uno degli interessi dell'utente, oppure null.
 * Ogni valore fuori elenco, o non vero per quella tappa, e' sostituito da una
 * scelta di riserva del codice (RISERVA_GANCI). La verita' sta nei dati: nome,
 * tipo dal nome del locale, fascia di prezzo, orari, tramonto, minuti.
 *
 * La stessa tappa ha sempre la stessa variante (seme sul place_id). Senza un
 * dato che la variante richiede (l'orario in "Per Te", i minuti sulla prima
 * tappa) si usa l'altra variante della stessa famiglia: mai "null" a schermo.
 *
 * I controlli esistenti (parole vietate, luce/ora, oggetti, giudizi, voce)
 * restano come rete di sicurezza sul testo composto (guardComposed): se
 * togliessero qualcosa, la tappa si ricompone senza fatto e con il gancio di
 * riserva. Il testo del fatto e' esente dalle parole vietate (Porta Garibaldi:
 * "storica" e' nel fatto di Wikipedia, non nella voce di Unnivai).
 */

import { candidateFamily, isMealPlace } from '../services/momentSelection';
import {
    filterBannedWords, filterTimeIncoherent, filterInventedObjects, filterVoice, localeTypeOfName,
} from './narrationLight';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
const seme = (s) => { let h = 2166136261; for (const ch of String(s || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

// ─── Le frasi approvate ─────────────────────────────────────────────────────
// {nome} {ora} {min} {tipo} {fascia} {tramonto} {delta} {interesse}
export const FRASI_LUOGO = {
    panorama: ['Ti fermi a {nome}: qui si guarda, non si corre.', '{nome} è il punto in cui la giornata rallenta.'],
    chiesa: ['{nome} è sulla tua strada: entri, guardi, riparti.', 'Ti prendi cinque minuti dentro {nome}.'],
    museo: ['Entri a {nome} alle {ora}: il resto può aspettare.', '{nome} è la tappa da fare con calma.'],
    piazza: ['Attraversi {nome} piano, senza fretta.', 'Passi da {nome}: guardati intorno prima di ripartire.'],
    verde: ['{nome}: rallenti qui, prima della prossima tappa.', 'Ti prendi una pausa a {nome}.'],
    // "la guardi" e' detto di una porta; un arco e' maschile ("lo guardi").
    porta: ["Passi sotto {nome}, poi ti giri e la guardi dall'altra parte."],
    arco: ["Passi sotto {nome}, poi ti giri e lo guardi dall'altra parte."],
    monumento: ['Ti fermi davanti a {nome} il tempo che serve.'],
    altro: ['Alle {ora} sei a {nome}: è qui che ti porta la giornata.', '{nome} è la prossima tappa del tuo giro.'],
};
export const FRASI_LOCALE = {
    colazione: ['Si parte da {nome}: un caffè e si comincia.'],
    pranzo: ['Pranzi da {nome}, {tipo} in fascia {fascia}.', 'A {min} minuti a piedi ti siedi da {nome}, {tipo} in fascia {fascia}.'],
    aperitivo: ["L'aperitivo lo prendi da {nome}, {tipo} in fascia {fascia}."],
    cena: ['La cena è da {nome}, {tipo} in fascia {fascia}.', 'Chiudi la giornata a tavola da {nome}, {tipo} in fascia {fascia}.'],
    dopocena: ['Dopo cena, due passi fino a {nome}.'],
};
export const FRASI_GANCIO = {
    tramonto: 'Il sole tramonta alle {tramonto}: sei qui {delta} minuti prima.',
    legame: 'È qui perché cerchi {interesse}.',
    distanza: 'Sono {min} minuti a piedi dalla tappa prima.',
    prima: 'Si comincia da qui.',
    ultima: 'Qui la giornata si chiude.',
    orario: 'Ci arrivi alle {ora}.',
};
export const GANCI = Object.keys(FRASI_GANCIO);

// C5e (O) — "tempo libero": la voce del giro quando, fuori dai pasti, non c'e'
// niente di valido a portata di piedi. Due proposte, DA APPROVARE (Ivano): il
// codice usa la prima. {momento} con l'articolo ("il pomeriggio", "l'aperitivo").
export const FRASI_TEMPO_LIBERO = [
    'Tempo libero: per {momento} non c\'è niente che valga il cammino. Il resto lo scegli tu.',
    '{Momento} è {tuo}: nessuna tappa da raggiungere, giri la zona come vuoi.',
];
const MOMENTO_CON_ARTICOLO = { mattina: 'la mattina', pomeriggio: 'il pomeriggio', aperitivo: "l'aperitivo", dopocena: 'il dopocena' };
const MOMENTO_FEMMINILE = new Set(['mattina']);
/**
 * Il testo del tempo libero, composto dal codice.
 * @param {{ momento: string, variante?: number }} p chiave del momento (non un pasto)
 */
export function composeFreeTime({ momento, variante = 0 }) {
    const m = MOMENTO_CON_ARTICOLO[norm(momento)] || 'questo momento';
    const tpl = FRASI_TEMPO_LIBERO[variante] || FRASI_TEMPO_LIBERO[0];
    const tuo = MOMENTO_FEMMINILE.has(norm(momento)) ? 'tua' : 'tuo';
    return tpl.replace('{momento}', m).replace('{Momento}', m.charAt(0).toUpperCase() + m.slice(1)).replace('{tuo}', tuo);
}
// La scelta di riserva del codice: il primo gancio vero, in quest'ordine.
export const RISERVA_GANCI = ['tramonto', 'prima', 'ultima', 'legame', 'distanza', 'orario'];
// Il tramonto si aggancia solo se cade fra 0 e 60 minuti dopo l'arrivo.
export const TRAMONTO_MAX_MINUTI = 60;

// ─── Interessi: elenco chiuso, forma breve con articolo ─────────────────────
// `dice`: come l'interesse si riconosce nelle etichette del wizard e nel testo
// dell'utente. `dna`: la categoria del DNA che lo porta. `vale`: per quali
// tappe "È qui perché cerchi …" e' vero.
const LOCALE_TIPI_BAR = /\b(bar|caffe|caffetteria|cocktail|pub|enoteca|wine)\b/;
export const INTERESSI = [
    { key: 'panorami', forma: 'i panorami', dice: /\b(belveder\w*|panoram\w*|tramont\w*|terrazz\w*|romantic\w*)/, vale: (s) => s.famiglia === 'panorama' },
    { key: 'chiese', forma: 'le chiese', dice: /\b(chies[ae]|basilic\w*|barocc\w*|cupol\w*)/, vale: (s) => s.famiglia === 'chiesa' },
    { key: 'piazze', forma: 'le piazze', dice: /\bpiazz[ae]\b/, vale: (s) => s.famiglia === 'piazza' },
    { key: 'arte', forma: "l'arte", dice: /\b(arte|art|muse[oi]|pinacotec\w*|rinasciment\w*)\b/, dna: 'arte', vale: (s) => s.famiglia === 'museo' },
    { key: 'storia', forma: 'la storia', dice: /\b(storia|storic\w*|cultura|imperial\w*)\b/, dna: 'cultura', vale: (s) => ['chiesa', 'museo', 'porta', 'arco', 'monumento'].includes(s.famiglia) },
    { key: 'verde', forma: 'il verde', dice: /\b(natura|nature|parc[oh]i?|ville|villa|giardin\w*|verde|outdoor)\b/, dna: 'natura', vale: (s) => s.famiglia === 'verde' },
    // P3d-j (chiusura) — "il cibo" tolto su decisione di Ivano: il legame dei
    // pasti non si dice. Cibo resta un interesse per la scelta dei luoghi.
    { key: 'aperitivo', forma: "l'aperitivo", dice: /\baperitiv\w*/, vale: (s) => s.locale && s.momento === 'aperitivo' && s.bar },
    { key: 'sera', forma: 'la vita di sera', dice: /\b(vita notturna|nightlife|discotec\w*|movida)\b/, dna: 'nightlife', vale: (s) => s.locale && s.bar && ['aperitivo', 'cena', 'dopocena'].includes(s.momento) },
    { key: 'shopping', forma: 'lo shopping', dice: /\b(shopping|negoz\w*|botteg\w*|boutique)\b/, dna: 'shopping', vale: (s) => s.shopping },
];
const INTERESSE_BY_KEY = new Map(INTERESSI.map(i => [i.key, i]));
// La soglia di fiducia del DNA e' quella che esiste gia' (placeReasons):
// fiducia (_share) > 0 e peso della categoria >= 0.5.
export const DNA_SOGLIA = 0.5;

/**
 * Gli interessi dell'utente (chiavi di INTERESSI): wizard, testo, DNA sopra
 * la soglia di fiducia.
 */
export function userInterests({ wizard = [], text = '', dnaWeights = null } = {}) {
    const out = new Set();
    const fonti = [...(Array.isArray(wizard) ? wizard : [wizard]).map(w => (typeof w === 'string' ? w : w?.title || w?.label || w?.name || '')), text]
        .map(norm).filter(Boolean);
    for (const i of INTERESSI) if (fonti.some(f => i.dice.test(f))) out.add(i.key);
    const share = Number(dnaWeights?._share);
    if (Number.isFinite(share) && share > 0) {
        for (const i of INTERESSI) if (i.dna && Number(dnaWeights[i.dna]) >= DNA_SOGLIA) out.add(i.key);
    }
    return [...out];
}

// ─── La tappa vista dal compositore ─────────────────────────────────────────
const fasciaDi = (pl) => (Number.isFinite(pl) && pl >= 1 && pl <= 4 ? '€'.repeat(pl) : null);
const nomeDi = (stop) => String(stop?.title || stop?.name || '').trim();
/** "18:00" → "18", "9:05" resta "9:05". */
export const oraParlata = (hhmm) => {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return m[2] === '00' ? String(Number(m[1])) : `${Number(m[1])}:${m[2]}`;
};
const toMin = (hhmm) => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

const SHOP_TYPES = ['store', 'clothing_store', 'shoe_store', 'jewelry_store', 'book_store', 'shopping_mall', 'department_store'];
const MONUMENT_TYPES = ['tourist_attraction', 'historical_landmark', 'monument', 'castle', 'city_hall'];

/** La famiglia della frase: quella del tracciato C1, poi porta/arco, monumento, altro. */
export function famigliaFrase(stop) {
    const n = norm(nomeDi(stop));
    // Prova reale P3d-j: "Ti fermi davanti a Passeggiata del Gianicolo".
    // Una passeggiata, una via, un lungofiume si attraversano: frasi della piazza.
    if (/^(passeggiata|lungotevere|lungomare|lungarno|via|viale|vicolo|scalinata)\b/.test(n)) return 'piazza';
    const c1 = stop?._tracciato?.famiglia ?? candidateFamily(stop);
    if (c1) return c1;
    if (/^porta\b/.test(n)) return 'porta';
    if (/^arco\b/.test(n)) return 'arco';
    const types = Array.isArray(stop?.types) ? stop.types : [];
    if (types.some(t => MONUMENT_TYPES.includes(t)) || /^(fontana|colonna|obelisco|palazzo|castello|torre|teatro|monumento|statua|mausoleo)\b/.test(n)) return 'monumento';
    return 'altro';
}

/** Il primo fatto usabile: una frase intera da Wikipedia, al massimo 180 caratteri. */
export const FATTO_MAX = 180;
export function fattoDi(fatti = []) {
    for (const f of Array.isArray(fatti) ? fatti : []) {
        const testo = String(typeof f === 'string' ? f : f?.testo || '').trim();
        const fonte = typeof f === 'string' ? 'wikipedia' : f?.fonte;
        if (fonte !== 'wikipedia' || !testo) continue;
        // "Nome: descrizione." e' un'etichetta, non una frase.
        if (/^[^.!?]{1,80}:\s/.test(testo)) continue;
        const prima = (testo.match(/^.+?[.!?](?=\s|$)/) || [testo])[0].trim();
        if (prima.length < 20 || prima.length > FATTO_MAX || !/[.!?]$/.test(prima)) return null;
        return prima;
    }
    return null;
}

/**
 * I dati che il compositore usa, da una tappa e dal suo contesto.
 * @param {object} p
 * @param {object} p.stop place_id, title, types, _tracciato?
 * @param {string|null} p.momento chiave del momento ('pranzo', …)
 * @param {string|null} p.orario 'HH:MM' di arrivo (null in "Per Te")
 * @param {string|null} p.tramonto 'HH:MM' del tramonto di quel giorno
 * @param {number|null} p.minutiDaPrima
 * @param {boolean} p.locale
 * @param {number|null} p.priceLevel
 * @param {Array} p.fatti [{ testo, fonte }]
 * @param {boolean} p.primo / p.ultimo  posizione nella giornata (nel tour)
 */
// Il tipo detto dal nome che esclude il bar: "Osteria Pizzeria Come Va?" ha
// anche il type Google `bar`, ma non e' un bar da colazione.
const TIPI_DA_TAVOLA = ['trattoria', 'osteria', 'pizzeria', 'ristorante', 'taverna', 'bistrot'];

export function stopData({ stop, momento = null, orario = null, tramonto = null, minutiDaPrima = null, locale = false, priceLevel = null, fatti = [], primo = false, ultimo = false, giornata = true }) {
    const nome = nomeDi(stop) || 'questa tappa';
    const types = Array.isArray(stop?.types) ? stop.types : [];
    const n = norm(nome);
    const tipoNome = localeTypeOfName(nome);
    const arrivo = toMin(orario);
    const sole = toMin(tramonto);
    const delta = arrivo !== null && sole !== null ? sole - arrivo : null;
    return {
        id: stop?.place_id || stop?.googlePlaceId || nome,
        nome,
        momento: momento ? norm(momento) : null,
        ora: oraParlata(orario),
        min: Number.isFinite(minutiDaPrima) && minutiDaPrima > 0 ? Math.round(minutiDaPrima) : null,
        tramonto: oraParlata(tramonto),
        delta: delta !== null && delta >= 0 && delta <= TRAMONTO_MAX_MINUTI ? delta : null,
        locale: !!locale,
        pasto: !!locale && isMealPlace(stop) && !types.includes('cafe') && tipoNome !== 'bar',
        bar: !!locale && !TIPI_DA_TAVOLA.includes(tipoNome)
            && (types.includes('bar') || types.includes('cafe') || LOCALE_TIPI_BAR.test(n) || ['bar', 'enoteca'].includes(tipoNome)),
        gelateria: tipoNome === 'gelateria' || types.includes('ice_cream_shop'),
        tipo: tipoNome,
        fascia: fasciaDi(priceLevel),
        famiglia: locale ? null : famigliaFrase(stop),
        shopping: types.some(t => SHOP_TYPES.includes(t)),
        fatto: locale ? null : fattoDi(fatti),
        primo: !!primo,
        ultimo: !!ultimo,
        // "Per Te" e' un giro suggerito adesso, non una giornata: niente
        // "Qui la giornata si chiude" (giornata: false).
        giornata: giornata !== false,
    };
}

// ─── Composizione ───────────────────────────────────────────────────────────
// "da Da Tonino" → "da Tonino": i locali romani si chiamano cosi' ("Da Enzo
// al 29"), e la preposizione della frase li assorbe.
const riempi = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k]).replace(/\b(da|Da) [Dd]a (?=\S)/g, '$1 ');
const servono = (tpl) => [...tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
const haTutto = (tpl, v) => servono(tpl).every(k => v[k] != null && String(v[k]).trim() !== '');

// Il locale senza tipo nel nome o senza fascia: la frase perde la coda
// ", {tipo} in fascia {fascia}" (o solo " in fascia {fascia}"), mai un buco.
const accorcia = (tpl, v) => {
    if (!tpl.includes('{tipo}')) return tpl;
    if (v.tipo && v.fascia) return tpl;
    if (v.tipo) return tpl.replace(' in fascia {fascia}', '');
    return tpl.replace(', {tipo} in fascia {fascia}', '');
};

/** Le frasi d'apertura possibili per la tappa, nell'ordine fisso della tappa. */
function aperture(d) {
    let lista;
    if (d.locale) {
        const m = d.momento;
        if (m === 'mattina' && d.bar) lista = FRASI_LOCALE.colazione;
        else if (m === 'pranzo' && d.pasto) lista = FRASI_LOCALE.pranzo;
        else if (m === 'aperitivo' && d.bar) lista = FRASI_LOCALE.aperitivo;
        else if (m === 'cena' && d.pasto) lista = FRASI_LOCALE.cena;
        else if (m === 'dopocena' && (d.bar || d.gelateria)) lista = FRASI_LOCALE.dopocena;
        else lista = FRASI_LUOGO.altro;
    } else {
        lista = FRASI_LUOGO[d.famiglia] || FRASI_LUOGO.altro;
    }
    const start = seme(d.id) % lista.length;
    return [...lista.slice(start), ...lista.slice(0, start)];
}

/** L'apertura della tappa: la variante fissa, o l'altra se mancano i dati. */
export function apertura(d) {
    const v = { ...d };
    for (const tpl of aperture(d)) {
        // "prima della prossima tappa" non si dice sull'ultima.
        if (d.ultimo && /prossima tappa/.test(tpl) && /prima della/.test(tpl)) continue;
        const t = accorcia(tpl, v);
        if (haTutto(t, v)) return riempi(t, v);
    }
    // Ultima rete: la variante senza dati della famiglia "altro".
    return riempi('{nome} è la prossima tappa del tuo giro.', v);
}

/**
 * I ganci veri per questa tappa, dato cosa dice gia' l'apertura.
 * @returns {Map<string, string>} gancio → frase
 */
export function ganciValidi(d, { aperturaTesto = '', interesse = null } = {}) {
    const out = new Map();
    const ap = norm(aperturaTesto);
    const v = { ...d, interesse: interesse ? INTERESSE_BY_KEY.get(interesse)?.forma : null };
    if (d.delta !== null && d.ora && d.tramonto) out.set('tramonto', riempi(FRASI_GANCIO.tramonto, v));
    if (v.interesse) out.set('legame', riempi(FRASI_GANCIO.legame, v));
    // (4) niente doppioni: minuti gia' detti → niente "distanza"; orario gia'
    // detto → niente "orario". Stesso senso gia' detto → niente "prima"/"ultima".
    if (d.min && !/\bminuti a piedi\b/.test(ap)) out.set('distanza', riempi(FRASI_GANCIO.distanza, v));
    if (d.primo && !/\bsi parte\b/.test(ap)) out.set('prima', FRASI_GANCIO.prima);
    if (d.ultimo && d.giornata && !/\bchiudi la giornata\b/.test(ap)) out.set('ultima', FRASI_GANCIO.ultima);
    if (d.ora && !ap.includes(`alle ${norm(d.ora)}`)) out.set('orario', riempi(FRASI_GANCIO.orario, v));
    return out;
}

/** L'interesse vale per la tappa solo se e' dell'utente e se e' vero per QUEL posto. */
export const interesseValido = (key, d, interessi = []) => {
    const i = INTERESSE_BY_KEY.get(key);
    return !!i && interessi.includes(key) && i.vale(d);
};
/** Gli interessi dell'utente veri per questa tappa (le opzioni per il modello). */
export const interessiPerTappa = (d, interessi = []) => interessi.filter(k => interesseValido(k, d, interessi));

/**
 * Compone la descrizione. Le scelte del modello si controllano: fuori elenco
 * o non vere → riserva del codice.
 * @param {object} d da stopData
 * @param {{ usaFatto?: any, gancio?: any, interesse?: any }} [scelta]
 * @param {string[]} [interessi] gli interessi dell'utente (chiavi)
 * @returns {{ text: string, usaFatto: boolean, gancio: string|null, interesse: string|null, riserva: string[] }}
 */
export function composeStop(d, scelta = {}, interessi = []) {
    const riserva = [];
    let usaFatto = typeof scelta?.usaFatto === 'boolean' ? scelta.usaFatto : null;
    if (usaFatto === null) { riserva.push('usaFatto'); usaFatto = !!d.fatto; }
    if (usaFatto && !d.fatto) { riserva.push('usaFatto'); usaFatto = false; }
    const prima = usaFatto ? d.fatto : apertura(d);

    let interesse = typeof scelta?.interesse === 'string' ? scelta.interesse : null;
    if (interesse !== null && !interesseValido(interesse, d, interessi)) { riserva.push('interesse'); interesse = null; }
    // Senza un interesse del modello, la riserva prende il primo vero.
    const interesseRiserva = interesse || interessiPerTappa(d, interessi)[0] || null;

    const validi = ganciValidi(d, { aperturaTesto: prima, interesse: interesseRiserva });
    let gancio = GANCI.includes(scelta?.gancio) ? scelta.gancio : null;
    if (!gancio || !validi.has(gancio)) {
        if (scelta?.gancio !== undefined) riserva.push('gancio');
        gancio = RISERVA_GANCI.find(g => validi.has(g)) || null;
    }
    if (gancio === 'legame') interesse = interesse || interesseRiserva;
    else interesse = null;
    const seconda = gancio ? validi.get(gancio) : null;
    return { text: [prima, seconda].filter(Boolean).join(' '), usaFatto, gancio, interesse, riserva };
}

// ─── Rete di sicurezza ──────────────────────────────────────────────────────
/**
 * I controlli esistenti sul testo composto. Se uno toglie qualcosa, la tappa
 * si ricompone senza fatto e col gancio di riserva; se anche cosi' scatta, si
 * tiene la sola apertura. Mai vuoto, mai null.
 * @param {object} d da stopData
 * @param {object} scelta
 * @param {object} ctx { interessi, arrival: Date|null, sunrise, sunset, fatti, fattiSu, voce }
 * @returns {{ text: string, composta: object, rete: Array }}
 */
export function guardComposed(d, scelta, ctx = {}) {
    const { interessi = [], arrival = null, sunrise = null, sunset = null, fatti = [], fattiSu = null, voce = {} } = ctx;
    const check = (c) => {
        const exempt = [c.usaFatto ? d.fatto : null, d.nome].filter(Boolean); // il fatto per primo: contiene il nome
        const parole = filterBannedWords(c.text, { exempt });
        const ora = filterTimeIncoherent(parole.text, { arrival, sunrise, sunset });
        const vero = filterInventedObjects(ora.text, { fatti, nomi: [d.nome], fattiSu });
        const voci = filterVoice(vero.text, voce);
        return [...parole.removed, ...ora.removed, ...vero.removed, ...voci.removed];
    };
    let c = composeStop(d, scelta, interessi);
    let rete = check(c);
    if (rete.length === 0) return { text: c.text, composta: c, rete };
    const prima = rete;
    c = composeStop(d, { usaFatto: false }, interessi);
    rete = check(c);
    if (rete.length === 0) return { text: c.text, composta: { ...c, riserva: [...c.riserva, 'rete'] }, rete: prima };
    const sola = apertura(d);
    return { text: sola, composta: { usaFatto: false, gancio: null, interesse: null, riserva: ['rete', 'rete-2'] }, rete: [...prima, ...rete] };
}

/** Nessun valore vuoto o "null"/"undefined" arriva a schermo. */
export const testoPulito = (t) => typeof t === 'string' && t.trim() !== '' && !/\b(null|undefined|NaN)\b/.test(t) && !/\{\w+\}/.test(t);
