// PER-TE-TRE (T27) — le proposte di Per Te seguono le passioni del DNA.
//
// Il modello sceglie le tappe senza coordinate (Gate PER TE): a Roma i parchi stanno lontani fra loro e il tetto di 1,2 km ne lascia
// meno di 3, a pranzo una seconda trattoria non e' una tappa (un pasto seduto per tour). Cosi' i temi del DNA restavano fuori.
// Qui due funzioni pure: l'ORDINE dei temi secondo il DNA, e il GRUPPO di tappe di un tema dentro il tetto, aperte all'arrivo, con
// tutte le regole del chiamante (`valido`). Il tetto, gli orari e i pasti non si allentano: se il gruppo non c'e', il tema non si serve.
import { kmTratto, TETTO_PIEDI_KM } from './tettoCammino';
import { stayOf, travelMinutes } from './tourTiming';
import { openStatus, CLOSED } from './openingHours';

/** Quante passioni del DNA devono avere la loro proposta. */
export const PASSIONI_MINIME = 3;
/** Le tappe di un giro composto dal codice: quante se ne cercano, sotto quante non e' un giro (regola di sempre). */
export const TAPPE_GRUPPO = { volute: 4, minime: 3 };

/** Dalla categoria del DNA al tema di Per Te. Chi non ha un tema suo (nightlife, shopping) non ne porta uno. */
export const TEMA_DELLA_PASSIONE = { natura: 'nature', avventura: 'nature', food: 'food', cultura: 'cultura', arte: 'cultura', relax: 'romance' };
/** A parita' di DNA, o senza DNA. */
export const TEMI_DI_DIFETTO = ['cultura', 'food', 'nature', 'romance'];
/**
 * Quante tappe del tema servono perche' il giro sia davvero di quel tema. Il cibo ne chiede una: un pasto seduto per tour sotto le 3 ore
 * (C8b), attorno al pasto stanno le visite vicine. Gli altri temi ne chiedono due.
 */
const TAPPE_DEL_TEMA = { food: 1 };
export const tappeDelTemaMinime = (tema) => TAPPE_DEL_TEMA[tema] ?? 2;

/**
 * I temi di Per Te in ordine di DNA: prima quelli delle passioni piu' forti, poi gli altri. Senza fiducia, l'ordine di difetto.
 * @returns {string[]}
 */
export function ordineTemi(dnaWeights) {
    const ordine = [];
    const aggiungi = (t) => { if (t && !ordine.includes(t)) ordine.push(t); };
    if (Number(dnaWeights?._share) > 0) {
        Object.entries(dnaWeights)
            .filter(([k, v]) => !k.startsWith('_') && Number(v) > 0 && TEMA_DELLA_PASSIONE[k])
            .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
            .forEach(([k]) => aggiungi(TEMA_DELLA_PASSIONE[k]));
    }
    TEMI_DI_DIFETTO.forEach(aggiungi);
    return ordine;
}

/** I temi che mancano perche' ogni passione abbia la sua proposta; gli altri temi seguono («piu' altre, se ci sono»). */
export function temiDaComporre(temiServiti, ordine) {
    const serviti = new Set(temiServiti || []);
    return (ordine || []).filter(t => !serviti.has(t));
}

const idDi = (c) => c?.place_id || c?.googlePlaceId || null;
const nomeDi = (c) => String(c?.title || c?.name || '');

// Le parole che non distinguono un posto da un altro: quello che resta e' il nome vero.
const PAROLE_GENERICHE = new Set(['ingresso', 'entrata', 'terrazza', 'panoramica', 'panoramico', 'belvedere', 'passeggiata', 'giardino', 'giardini', 'villa', 'parco', 'casa', 'natale', 'museo', 'musei', 'galleria', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dal', 'dalla', 'gli', 'con']);
const paroleDelNome = (nome) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !PAROLE_GENERICHE.has(w));

/**
 * Due schede dello stesso posto? «Ingresso di Villa Pamphili» e «Villa Doria Pamphili», «Galleria Colonna» e «Galleria del Cardinale
 * Colonna», «Casa Natale di Vincenzo Bellini» e «Museo Vincenzo Bellini»: tolte le parole generiche, un nome sta tutto dentro l'altro.
 */
export function stessoPosto(a, b) {
    const pa = paroleDelNome(nomeDi(a));
    const pb = paroleDelNome(nomeDi(b));
    if (pa.length === 0 || pb.length === 0) return false;
    const [corto, lungo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)];
    return corto.every(w => lungo.has(w));
}

/**
 * Il gruppo di tappe di un tema. Da ogni posto del tema (in ordine di merito) si cammina verso il posto del tema piu' vicino entro il
 * tetto, poi, se non ce n'e', verso il piu' vicino degli altri temi. Una tappa entra solo se e' aperta per tutta la sosta all'ora in cui
 * ci si arriva e se `valido` non ha niente da dire (pasti, dolci, buio: le regole del chiamante). Vince il primo gruppo completo;
 * altrimenti quello con piu' tappe del tema, poi con piu' tappe. Sotto `minime`, o sotto `minTema`, nessun gruppo.
 * @param {object} p
 * @param {Array} p.tema i posti del tema, in ordine di merito
 * @param {Array} [p.altri] i posti degli altri temi, per riempire attorno
 * @param {Date} p.start l'ora di partenza
 * @param {(c: object, arrivo: Date, accettate: Array<{c: object, arrivo: Date}>) => (string|null)} [p.valido]
 * @returns {Array|null} i posti, in ordine di cammino
 */
export function gruppoDelTema({ tema = [], altri = [], start, volute = TAPPE_GRUPPO.volute, minime = TAPPE_GRUPPO.minime, minTema = 2, capKm = TETTO_PIEDI_KM, escludi = null, valido = null }) {
    const libero = (c) => !!idDi(c) && !escludi?.has(idDi(c));
    const propri = tema.filter(libero);
    const idPropri = new Set(propri.map(idDi));
    const vicini = altri.filter(c => libero(c) && !idPropri.has(idDi(c)));
    const entra = (c, arrivo, accettate) => openStatus(c, arrivo, stayOf(c)).stato !== CLOSED && !(valido && valido(c, arrivo, accettate));
    const piuVicino = (lista, ultimo, fine, accettate) => {
        const usati = new Set(accettate.map(x => idDi(x.c)));
        return lista
            .filter(c => !usati.has(idDi(c)) && !accettate.some(x => stessoPosto(x.c, c)))
            .map(c => ({ c, km: kmTratto(ultimo, c) }))
            .filter(x => x.km != null && x.km <= capKm)
            .sort((a, b) => a.km - b.km)
            .map(x => ({ c: x.c, arrivo: new Date(fine.getTime() + (travelMinutes(ultimo, x.c) ?? 0) * 60000) }))
            .find(x => entra(x.c, x.arrivo, accettate)) || null;
    };
    let migliore = null;
    const quantiDelTema = (g) => g.filter(x => idPropri.has(idDi(x.c))).length;
    for (const seme of propri) {
        if (!entra(seme, start, [])) continue;
        const g = [{ c: seme, arrivo: start }];
        while (g.length < volute) {
            const ultimo = g.at(-1);
            const fine = new Date(ultimo.arrivo.getTime() + stayOf(ultimo.c) * 60000);
            const prossimo = piuVicino(propri, ultimo.c, fine, g) || piuVicino(vicini, ultimo.c, fine, g);
            if (!prossimo) break;
            g.push(prossimo);
        }
        if (g.length < minime || quantiDelTema(g) < minTema) continue;
        if (g.length >= volute) return g.map(x => x.c);
        if (!migliore || quantiDelTema(g) > quantiDelTema(migliore) || (quantiDelTema(g) === quantiDelTema(migliore) && g.length > migliore.length)) migliore = g;
    }
    return migliore ? migliore.map(x => x.c) : null;
}
