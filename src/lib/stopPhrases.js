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
import { placeKind } from './placeKind';
import { conPrep } from './preposizioni';
import { stayOf } from './tourTiming';
import { MOMENT_BY_KEY } from './dayMoments';
import { minutiTesto, minutiInParole, isDopocenaClock, ALBA_MINUTI } from './italianLabels';
import {
    filterBannedWords, filterTimeIncoherent, filterInventedObjects, filterVoice, localeTypeOfName,
} from './narrationLight';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
const seme = (s) => { let h = 2166136261; for (const ch of String(s || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

// ─── Le frasi approvate ─────────────────────────────────────────────────────
// {nome} {ora} {min} {tipo} {fascia} {tramonto} {delta} {interesse}
// TESTI-SCHEDE — le preposizioni articolate le mette il codice (`preposizioni.js`), mai a mano nella frase:
// {aNome} «al Parco…», {daNome} «dalla Passeggiata…», {nelNome} «nella Basilica…», {davantiNome} «davanti alla Galleria…»,
// {sottoNome} «sotto l'Arco…», {dentroNome} «dentro il Duomo», {ilNome} «il Colosseo», {intornoANome}, {finoANome}.
// {nome} resta il nome com'è, solo a inizio frase o dopo i due punti.
export const FRASI_LUOGO = {
    panorama: ['Ti fermi {aNome}: qui si guarda, non si corre.', '{nome} è il punto in cui la giornata rallenta.'],
    // {durata}: la sosta vera della tappa, in lettere (stessa durata della scheda).
    chiesa: ['{nome} è sulla tua strada: entri, guardi, riparti.', 'Ti prendi {durata} {dentroNome}.'],
    museo: ['Entri {nelNome} alle {ora}: il resto può aspettare.', '{nome} è la tappa da fare con calma.'],
    piazza: ['Attraversi {ilNome} piano, senza fretta.', 'Passi {daNome}: guardati intorno prima di ripartire.'],
    verde: ['{nome}: rallenti qui, prima della prossima tappa.', 'Ti prendi una pausa {aNome}.'],
    // "la guardi" e' detto di una porta; un arco e' maschile ("lo guardi").
    porta: ["Passi {sottoNome}, poi ti giri e la guardi dall'altra parte."],
    arco: ["Passi {sottoNome}, poi ti giri e lo guardi dall'altra parte."],
    monumento: ['Ti fermi {davantiNome} il tempo che serve.'],
    altro: ['Alle {ora} sei {aNome}: è qui che ti porta la giornata.', '{nome} è la prossima tappa del tuo giro.'],
};
export const FRASI_LOCALE = {
    colazione: ['Si parte {daNome}: un caffè e si comincia.'],
    pranzo: ['Pranzi {daNome}, {tipo} con {fascia}.', 'A {minuti} a piedi ti siedi {daNome}, {tipo} con {fascia}.'],
    aperitivo: ["L'aperitivo lo prendi {daNome}, {tipo} con {fascia}."],
    // Dalle 21:30 la sezione si chiama «Dopocena»: il drink non e' piu' un aperitivo.
    drinkTardi: ['Il drink lo prendi {daNome}, {tipo} con {fascia}.'],
    cena: ['La cena è {daNome}, {tipo} con {fascia}.', 'Chiudi la giornata a tavola {daNome}, {tipo} con {fascia}.'],
    dopocena: ['Dopo cena, due passi fino {finoANome}.'],
};
// TESTI-SCHEDE — varianti di scorta: una lista di Per Te ha 10–15 tappe e le frasi di una famiglia erano 1–2, quindi le stesse
// frasi tornavano su più schede. Le varianti stanno DOPO le frasi di sempre (la scelta della prima non cambia: il seme gira
// solo sulle frasi di sempre) e si usano quando quelle sono già dette nella lista. Voce Unnivai: dirette, brevi, senza giudizi.
export const FRASI_LUOGO_EXTRA = {
    panorama: ['Fai una sosta {aNome}: guardi, poi riparti.', '{nome}: fermati, guarda, poi riparti.'],
    chiesa: ['Entri {nelNome} e ti fermi {durata}.', 'Fermati {durata} {aNome}, poi si va avanti.'],
    museo: ['Dedichi {durata} {aNome}.', 'Ti prendi {durata} {dentroNome}, senza correre.'],
    piazza: ['Cammini {nelNome} senza fretta.', 'Rallenti {aNome} e guardi dove sei.'],
    verde: ["Ti siedi {aNome}, senza fare niente per un po'.", 'Cammini {nelNome} senza meta per {durata}.'],
    porta: ["Ti fermi {davantiNome}, poi passi dall'altra parte."],
    arco: ["Ti fermi {davantiNome}, poi passi dall'altra parte."],
    monumento: ['Guardi {ilNome} da vicino, poi riparti.', 'Ti avvicini {aNome}: {durata} e si riparte.', 'Giri {intornoANome} prima di andare avanti.'],
    altro: ['Poi tocca {aNome}.', 'Il giro passa {daNome}.', 'Ti fermi {aNome} per {durata}.'],
};
export const FRASI_LOCALE_EXTRA = {
    colazione: ['Cominci {daNome}, con un caffè.'],
    pranzo: ['Ti fermi a pranzo {daNome}: {tipo} con {fascia}.'],
    aperitivo: ['Aperitivo {daNome}: {tipo} con {fascia}.'],
    drinkTardi: ['Un drink {daNome}: {tipo} con {fascia}.'],
    cena: ['Ti siedi a cena {daNome}: {tipo} con {fascia}.'],
    dopocena: ['Dopo cena ti fermi ancora {aNome}.'],
};
const conExtra = (base, extra, k) => [...(base[k] || []), ...(extra[k] || [])];
export const FRASI_GANCIO = {
    tramonto: 'Il sole tramonta alle {tramonto}: sei qui {deltaTesto} prima.',
    legame: 'È qui perché cerchi {interesse}.',
    distanza: 'Sono {minuti} a piedi dalla tappa prima.',
    distanza1: 'È a un minuto a piedi dalla tappa prima.',
    prima: 'Si comincia da qui.',
    ultima: 'Qui la giornata si chiude.',
    orario: 'Ci arrivi alle {ora}.',
};
// «Si comincia da qui»: la prima tappa deve stare entro questa distanza dall'utente.
export const PRIMA_TAPPA_MAX_M = 150;
export const GANCI = Object.keys(FRASI_GANCIO).filter(g => g !== 'distanza1');

// TESTI (decisione di Ivano) — il tempo libero dice sempre la stessa cosa, vera per ogni vuoto: a schermo
// «Tempo libero», la fascia «HH:MM–HH:MM» (freeTimeRangeLabel) e questa frase. Le frasi per momento
// («per la mattina non c'è niente che valga il cammino») dicevano il falso quando il vuoto lo crea il motore.
export const TESTO_TEMPO_LIBERO = 'Niente in agenda: cammina dove ti porta la strada.';
export const FRASI_TEMPO_LIBERO = [TESTO_TEMPO_LIBERO];
/**
 * Il testo del tempo libero, composto dal codice: lo stesso per ogni momento.
 * @param {{ momento?: string, variante?: number }} [p] ignorati: il testo non dipende dal momento
 */
// eslint-disable-next-line no-unused-vars
export function composeFreeTime(p = {}) {
    return TESTO_TEMPO_LIBERO;
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
    { key: 'aperitivo', forma: "l'aperitivo", dice: /\baperitiv\w*/, vale: (s) => s.locale && s.momento === 'aperitivo' && s.bar && !s.tardi },
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
// TESTI (decisione di Ivano) — i livelli di prezzo di Google si dicono a parole: «prezzi bassi / medi / alti».
export const PREZZI = { 1: 'prezzi bassi', 2: 'prezzi medi', 3: 'prezzi alti', 4: 'prezzi alti' };
const fasciaDi = (pl) => (Number.isFinite(pl) && pl >= 1 && pl <= 4 ? PREZZI[pl] : null);
const nomeDi = (stop) => String(stop?.title || stop?.name || '').trim();
/** "18:00" → "18", "9:05" resta "9:05". */
export const oraParlata = (hhmm) => {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return m[2] === '00' ? String(Number(m[1])) : `${Number(m[1])}:${m[2]}`;
};
const toMinuti = ({ h, m }) => h * 60 + m;
const toMin = (hhmm) => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

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

/** Le abbreviazioni dopo cui il punto NON chiude la frase («tra piazza S. Francesco», «Sant. Agata», «p.za», «ecc.»). */
const ABBREVIAZIONI = new Set(['s', 'sant', 'sta', 'sto', 'ss', 'dott', 'dr', 'prof', 'ing', 'arch', 'avv', 'on', 'sig', 'mons', 'gen', 'card', 'fr', 'fratel', 'f.lli', 'pza', 'p.za', 'p.zza', 'pzza', 'v.le', 'c.so', 'l.go', 'v', 'cfr', 'ecc', 'es', 'ca', 'circa', 'n', 'nn', 'sec', 'secc', 'pag', 'pp', 'vol', 'a.c', 'd.c', 'a', 'd', 'b', 'c', 'e.v', 'st', 'mt', 'm.te', 'corso', 'cap', 'fig', 'tav', 'art']);
/**
 * La prima frase COMPLETA di un testo: finisce a un punto, «!» o «?» che chiude davvero, mai a un'abbreviazione (S., Sant., p.za, ecc.),
 * a un'iniziale o a un punto seguito da una minuscola. Senza una frase completa: null.
 */
export function primaFraseCompleta(testo) {
    const t = String(testo || '').replace(/\s+/g, ' ').trim();
    const re = /[.!?]+(?=\s|$)/g;
    let m;
    while ((m = re.exec(t))) {
        const fine = m.index + m[0].length;
        const prima = t.slice(0, m.index);
        const parola = (prima.match(/([\p{L}][\p{L}.]*)$/u) || [''])[0].toLowerCase();
        const dopo = t.slice(fine).trimStart();
        if (m[0] === '.') {
            if (ABBREVIAZIONI.has(parola) || ABBREVIAZIONI.has(parola.replace(/\./g, ''))) { if (dopo || !/^(ecc|a\.?c|d\.?c)$/.test(parola)) continue; }
            if (/^[\p{Lu}]$/u.test(prima.slice(-1)) && /(^|[\s.(])[\p{Lu}]$/u.test(prima)) { continue; }
            if (dopo && /^[\p{Ll}]/u.test(dopo)) continue;
            if (/\d$/.test(prima) && /^\d/.test(dopo)) continue;
        }
        return t.slice(0, fine).trim();
    }
    return null;
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
        const prima = primaFraseCompleta(testo);
        if (!prima || prima.length < 20 || prima.length > FATTO_MAX) return null;
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

export function stopData({ stop, momento = null, orario = null, tramonto = null, minutiDaPrima = null, locale = false, priceLevel = null, fatti = [], primo = false, ultimo = false, giornata = true, distanzaUtenteM = null }) {
    const nome = nomeDi(stop) || 'questa tappa';
    const types = Array.isArray(stop?.types) ? stop.types : [];
    const n = norm(nome);
    // C6a — il nome mostrato e' pulito dalle code commerciali ("… | Trattoria
    // Romana"): il tipo detto dal nome si legge anche dall'originale.
    const tipoNome = localeTypeOfName(nome) || localeTypeOfName(stop?.nameOriginal || '');
    const { kind } = placeKind(stop);
    const arrivo = toMin(orario);
    const sole = toMin(tramonto);
    const delta = arrivo !== null && sole !== null ? sole - arrivo : null;
    // La sosta vera della tappa (la stessa della scheda): le durate scritte nel testo sono questa.
    const sosta = Number.isFinite(stop?.stayMinutes) && stop.stayMinutes > 0 ? Math.round(stop.stayMinutes) : stayOf(stop);
    const minDaPrima = Number.isFinite(minutiDaPrima) && minutiDaPrima > 0 ? Math.round(minutiDaPrima) : null;
    return {
        id: stop?.place_id || stop?.googlePlaceId || nome,
        nome,
        momento: momento ? norm(momento) : null,
        ora: oraParlata(orario),
        min: minDaPrima,
        minuti: minDaPrima ? minutiTesto(minDaPrima) : null,
        sosta,
        durata: minutiInParole(sosta),
        tramonto: oraParlata(tramonto),
        // «sei qui 0 minuti prima» non e' un anticipo: il gancio vale da 1 minuto.
        delta: delta !== null && delta >= 1 && delta <= TRAMONTO_MAX_MINUTI ? delta : null,
        deltaTesto: delta !== null && delta >= 1 && delta <= TRAMONTO_MAX_MINUTI ? minutiTesto(delta) : null,
        // Dalle 21:30 la sezione si chiama «Dopocena», non «Aperitivo» (stopMoments).
        tardi: arrivo !== null && isDopocenaClock(arrivo),
        // «Qui la giornata si chiude» vale solo per un giro che finisce di sera (dalle 18:00).
        sera: arrivo !== null && (arrivo >= toMinuti(MOMENT_BY_KEY.aperitivo.start) || arrivo < ALBA_MINUTI),
        locale: !!locale,
        // C6a — pasto e bar seguono il tipo del posto (tipo principale di Google):
        // un bar marcato anche `restaurant` e' un bar, un ristorante con un
        // `cafe` tra i types e' un ristorante.
        pasto: !!locale && isMealPlace(stop) && tipoNome !== 'bar',
        bar: !!locale && !TIPI_DA_TAVOLA.includes(tipoNome)
            && (kind === 'bar' || kind === 'caffe' || LOCALE_TIPI_BAR.test(n) || ['bar', 'enoteca'].includes(tipoNome)),
        gelateria: tipoNome === 'gelateria' || types.includes('ice_cream_shop'),
        tipo: tipoNome,
        fascia: fasciaDi(priceLevel),
        famiglia: locale ? null : famigliaFrase(stop),
        shopping: kind === 'negozio',
        fatto: locale ? null : fattoDi(fatti),
        // «Si comincia da qui» e' vero solo se l'utente e' li': la prima tappa entro PRIMA_TAPPA_MAX_M dalla sua posizione.
        // Senza posizione nota non si dice.
        primo: !!primo && Number.isFinite(distanzaUtenteM) && distanzaUtenteM <= PRIMA_TAPPA_MAX_M,
        primaDelGiro: !!primo,
        ultimo: !!ultimo,
        // "Per Te" e' un giro suggerito adesso, non una giornata: niente
        // "Qui la giornata si chiude" (giornata: false).
        giornata: giornata !== false,
    };
}

// ─── Composizione ───────────────────────────────────────────────────────────
// "da Da Tonino" → "da Tonino": i locali romani si chiamano cosi' ("Da Enzo
// al 29"), e la preposizione della frase li assorbe.
const PREP_DEL_PLACEHOLDER = { aNome: 'a', daNome: 'da', nelNome: 'in', davantiNome: 'davanti a', sottoNome: 'sotto', dentroNome: 'dentro', ilNome: '', intornoANome: 'intorno a', finoANome: 'fino a' };
/**
 * TESTI-SCHEDE — i segnaposto con la preposizione articolata, ricavati dal nome della tappa: «al Parco del Gianicolo»,
 * «alla Galleria del Cardinale Colonna», «dalla Passeggiata del Gianicolo». Un locale che non si riconosce («Roscioli»)
 * resta senza articolo («da Roscioli»); il nome segnaposto «questa tappa» non si articola.
 */
export function conPreposizioni(d) {
    const nome = d?.nome;
    if (!nome) return d;
    const opz = d.locale ? { fallback: 'nessuno' } : {};
    const out = { ...d };
    for (const [k, prep] of Object.entries(PREP_DEL_PLACEHOLDER)) {
        out[k] = nome === 'questa tappa' ? [prep, nome].filter(Boolean).join(' ') : conPrep(prep, nome, opz);
    }
    return out;
}
const riempi = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k]).replace(/\b(da|Da) [Dd]a (?=\S)/g, '$1 ');
const servono = (tpl) => [...tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
const haTutto = (tpl, v) => servono(tpl).every(k => v[k] != null && String(v[k]).trim() !== '');

// Il locale senza tipo nel nome o senza fascia: la frase perde la coda
// ", {tipo} con {fascia}" (o solo " con {fascia}"), mai un buco.
const accorcia = (tpl, v) => {
    if (!tpl.includes('{tipo}')) return tpl;
    if (v.tipo && v.fascia) return tpl;
    if (v.tipo) return tpl.replace(' con {fascia}', '');
    return tpl.replace(', {tipo} con {fascia}', '');
};

/** La frase senza nome e senza numeri: due frasi uguali a meno di questo sono la stessa frase (come il controllo c7 del banco). */
export const maschera = (frase, nome) => {
    const n = norm(nome || '');
    // «Il Duomo» in frase diventa «al Duomo»: si maschera anche il nome senza l'articolo che porta
    const senzaArt = n.replace(/^(il|lo|la|i|gli|le)\s+/, '').replace(/^l'/, '');
    let t = norm(frase);
    if (n) t = t.split(n).join('<nome>');
    if (senzaArt && senzaArt !== n) t = t.split(senzaArt).join('<nome>');
    return t.replace(/\d+/g, '<n>');
};
const frasiDi = (testo) => String(testo || '').split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean);
/** Le frasi di un testo, mascherate, nel set delle frasi gia' usate nel tour. */
export function registraFrasi(usate, testo, nome) {
    if (!(usate instanceof Set)) return;
    for (const f of frasiDi(testo)) usate.add(maschera(f, nome));
}

/** Le frasi gia' dette in una lista di tour (mascherate col nome della loro tappa): il punto di partenza per comporre altri tour della stessa lista. */
export function frasiUsateDa(tours) {
    const usate = new Set();
    for (const t of tours || []) for (const st of t?.stops || []) registraFrasi(usate, st?.description, st?.title);
    return usate;
}

/** Le frasi d'apertura possibili per la tappa, nell'ordine fisso della tappa. */
function aperture(d) {
    let chiave, base, extra;
    if (d.locale) {
        const m = d.momento;
        if (m === 'mattina' && d.bar) chiave = 'colazione';
        else if (m === 'pranzo' && d.pasto) chiave = 'pranzo';
        else if (m === 'aperitivo' && d.bar) chiave = d.tardi ? 'drinkTardi' : 'aperitivo';
        else if (m === 'cena' && d.pasto) chiave = 'cena';
        else if (m === 'dopocena' && (d.bar || d.gelateria)) chiave = 'dopocena';
        if (chiave) { base = FRASI_LOCALE[chiave]; extra = FRASI_LOCALE_EXTRA[chiave] || []; }
        else { base = FRASI_LUOGO.altro; extra = FRASI_LUOGO_EXTRA.altro; }
    } else {
        const f = FRASI_LUOGO[d.famiglia] ? d.famiglia : 'altro';
        base = FRASI_LUOGO[f]; extra = FRASI_LUOGO_EXTRA[f] || [];
    }
    const start = seme(d.id) % base.length;
    return [...base.slice(start), ...base.slice(0, start), ...extra];
}

// TESTI — nello stesso tour nessuna frase uguale due volte: quando le frasi di una famiglia sono finite se ne usa una gia' approvata
// per un luogo simile (mai una frase nuova). Solo frasi senza genere ne' verbi di un'altra famiglia ("entri", "la guardi").
// VERITÀ-PRE-GIRO — tolti i prestiti che non stanno in piedi: a una piazza (o a una passeggiata, una via) non ci si ferma «davanti»,
// e un luogo qualunque («altro»: un mercato, una spa) non è un monumento. I verbi che vanno col luogo li controlla `frasePossibile`.
const SORELLE = {
    monumento: ['piazza'], porta: ['monumento', 'piazza'], arco: ['monumento', 'piazza'],
    chiesa: ['monumento'], altro: ['piazza'],
};
// VERITÀ-PRE-GIRO — «Attraversi…» solo dove si attraversa (una piazza, una passeggiata, una porta, un arco): mai una chiesa, una statua,
// un palazzo, un luogo qualunque. «Ti fermi davanti a…» solo davanti a qualcosa: un monumento, una porta, un arco, una chiesa.
const SI_ATTRAVERSA = new Set(['piazza', 'porta', 'arco', 'verde']);
const CI_SI_FERMA_DAVANTI = new Set(['monumento', 'porta', 'arco', 'chiesa']);

// Una frase che dice il falso su QUESTA tappa non si usa: «Si parte da…» solo se e' la prima,
// «Chiudi la giornata…» solo se e' l'ultima di un giro che finisce di sera.
const frasePossibile = (tpl, d) => {
    if (/\bsi parte\b/i.test(tpl) && !d.primaDelGiro) return false;
    if (/\bchiudi la giornata\b/i.test(tpl) && !(d.ultimo && d.giornata && d.sera)) return false;
    // «prima della prossima tappa» non si dice sull'ultima.
    if (d.ultimo && /prossima tappa/.test(tpl) && /prima della/.test(tpl)) return false;
    if (/^(Attraversi|Cammini)\b/.test(tpl) && !SI_ATTRAVERSA.has(d.famiglia)) return false;
    if (/\{davantiNome\}/.test(tpl) && !CI_SI_FERMA_DAVANTI.has(d.famiglia)) return false;
    return true;
};

/**
 * L'apertura della tappa: la variante fissa, o l'altra se mancano i dati. Con `evita` (le frasi gia'
 * usate nel tour, mascherate) sceglie fra le frasi approvate una non ancora usata: prima quelle della
 * famiglia, poi le generiche; se sono tutte usate tiene la prima valida.
 */
export function apertura(d, { evita = null } = {}) {
    const v = conPreposizioni(d);
    // Dopo le frasi della famiglia: quelle delle famiglie sorelle (stesse frasi approvate, valide anche per luoghi simili), poi le generiche.
    const propri = aperture(d);
    const sorelle = d.locale ? [] : (SORELLE[d.famiglia] || []).flatMap(f => conExtra(FRASI_LUOGO, FRASI_LUOGO_EXTRA, f));
    const candidate = [...new Set([...propri, ...sorelle, ...conExtra(FRASI_LUOGO, FRASI_LUOGO_EXTRA, 'altro')])];
    const valide = [];
    for (const tpl of candidate) {
        if (!frasePossibile(tpl, d)) continue;
        const t = accorcia(tpl, v);
        if (haTutto(t, v)) valide.push(riempi(t, v));
    }
    if (valide.length === 0) {
        // Ultima rete: la variante senza dati della famiglia "altro".
        return riempi('{nome} è la prossima tappa del tuo giro.', v);
    }
    // Le frasi della famiglia prima delle generiche: la prima valida, o la prima non ancora usata.
    if (evita instanceof Set) {
        const nuova = valide.find(f => !evita.has(maschera(f, d.nome)));
        if (nuova) return nuova;
    }
    return valide[0];
}

/**
 * I ganci veri per questa tappa, dato cosa dice gia' l'apertura.
 * @returns {Map<string, string>} gancio → frase
 */
export function ganciValidi(d, { aperturaTesto = '', interesse = null } = {}) {
    const out = new Map();
    const ap = norm(aperturaTesto);
    const v = { ...conPreposizioni(d), interesse: interesse ? INTERESSE_BY_KEY.get(interesse)?.forma : null };
    if (d.delta !== null && d.ora && d.tramonto) out.set('tramonto', riempi(FRASI_GANCIO.tramonto, v));
    if (v.interesse) out.set('legame', riempi(FRASI_GANCIO.legame, v));
    // (4) niente doppioni: minuti gia' detti → niente "distanza"; orario gia'
    // detto → niente "orario". Stesso senso gia' detto → niente "prima"/"ultima".
    if (d.min && !/\bminut[oi] a piedi\b/.test(ap)) out.set('distanza', riempi(d.min === 1 ? FRASI_GANCIO.distanza1 : FRASI_GANCIO.distanza, v));
    if (d.primo && !/\bsi parte\b/.test(ap)) out.set('prima', FRASI_GANCIO.prima);
    // TESTI — «Qui la giornata si chiude» solo sull'ultima tappa di un giro che finisce di sera.
    if (d.ultimo && d.giornata && d.sera && !/\bchiudi la giornata\b/.test(ap)) out.set('ultima', FRASI_GANCIO.ultima);
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
export function composeStop(d, scelta = {}, interessi = [], { evita = null } = {}) {
    const riserva = [];
    let usaFatto = typeof scelta?.usaFatto === 'boolean' ? scelta.usaFatto : null;
    if (usaFatto === null) { riserva.push('usaFatto'); usaFatto = !!d.fatto; }
    if (usaFatto && !d.fatto) { riserva.push('usaFatto'); usaFatto = false; }
    const prima = usaFatto ? d.fatto : apertura(d, { evita });

    let interesse = typeof scelta?.interesse === 'string' ? scelta.interesse : null;
    if (interesse !== null && !interesseValido(interesse, d, interessi)) { riserva.push('interesse'); interesse = null; }
    // Senza un interesse del modello, la riserva prende il primo vero.
    const interesseRiserva = interesse || interessiPerTappa(d, interessi)[0] || null;

    const validi = ganciValidi(d, { aperturaTesto: prima, interesse: interesseRiserva });
    // TESTI — nello stesso tour nessuna frase uguale due volte: un gancio gia' detto non e' piu' una scelta.
    const veri = new Set(validi.keys());
    if (evita instanceof Set) for (const [g, frase] of [...validi]) if (evita.has(maschera(frase, d.nome))) validi.delete(g);
    let gancio = GANCI.includes(scelta?.gancio) ? scelta.gancio : null;
    if (!gancio || !validi.has(gancio)) {
        // Un gancio vero ma gia' detto nel tour non e' un errore del modello: la riserva non lo conta.
        if (scelta?.gancio !== undefined && !veri.has(scelta.gancio)) riserva.push('gancio');
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
    const { interessi = [], arrival = null, sunrise = null, sunset = null, fatti = [], fattiSu = null, voce = {}, evita = null } = ctx;
    const check = (c) => {
        const exempt = [c.usaFatto ? d.fatto : null, d.nome].filter(Boolean); // il fatto per primo: contiene il nome
        const parole = filterBannedWords(c.text, { exempt });
        const ora = filterTimeIncoherent(parole.text, { arrival, sunrise, sunset });
        const vero = filterInventedObjects(ora.text, { fatti, nomi: [d.nome], fattiSu });
        const voci = filterVoice(vero.text, voce);
        return [...parole.removed, ...ora.removed, ...vero.removed, ...voci.removed];
    };
    let c = composeStop(d, scelta, interessi, { evita });
    let rete = check(c);
    if (rete.length === 0) return { text: c.text, composta: c, rete };
    const prima = rete;
    c = composeStop(d, { usaFatto: false }, interessi, { evita });
    rete = check(c);
    if (rete.length === 0) return { text: c.text, composta: { ...c, riserva: [...c.riserva, 'rete'] }, rete: prima };
    const sola = apertura(d, { evita });
    return { text: sola, composta: { usaFatto: false, gancio: null, interesse: null, riserva: ['rete', 'rete-2'] }, rete: [...prima, ...rete] };
}

/** Nessun valore vuoto o "null"/"undefined" arriva a schermo. */
export const testoPulito = (t) => typeof t === 'string' && t.trim() !== '' && !/\b(null|undefined|NaN)\b/.test(t) && !/\{\w+\}/.test(t);
