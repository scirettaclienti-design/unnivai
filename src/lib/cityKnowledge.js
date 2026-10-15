/**
 * C10 — la lista della città nel motore: l'AI propone (una volta per città e giorno, sul server), Google verifica
 * (sul server), le regole compongono (qui e in momentSelection).
 *
 *   - I posti verificati entrano nel pool come i risultati di una ricerca (stessa forma, `buildPOIFromCandidate`) e
 *     passano per gli stessi filtri: zone, raggio, categoria, dieta e budget, cucine estere col tema tipico.
 *   - Decisione di Ivano su P7a: entrano con PRIORITA' e non contano nel limite dei 20 ne' nel tetto delle icone. Gli
 *     ESSENZIALI sono ancore: al massimo 3 in una giornata intera, 1 in mezza giornata; gli altri essenziali tornano al
 *     merito anti-ovvio come tutto il resto.
 *   - Un'ancora si propone al riparatore come se l'avesse scelta il modello, in testa al suo momento: vale solo se
 *     nessuna alternativa del momento costa meno per le regole (cammino, varieta', orari, percorso).
 *   - Del posto arrivano a schermo solo i dati di Google: il «perche'» dell'AI resta sul server (decisione M).
 */
import { openStatus } from './openingHours';
import { placeKind, COMMERCIAL_KINDS } from './placeKind';
import { romeParts, romeDate } from './tourWindow';
import { MOMENT_BY_KEY } from './dayMoments';
import { candidateFamily, MAX_WALK_METERS } from '../services/momentSelection';

export const ANCORE_GIORNATA_INTERA = 3;
/** Gli essenziali candidati ad ancora (tutti quelli della lista, al massimo 4): le ancore vere si scelgono alla semina. */
export const ANCORE_CANDIDATE_MAX = 4;
export const ANCORE_MEZZA_GIORNATA = 1;
/** Una finestra da 6 ore o piu' e' una giornata intera (la stessa soglia dei minimi, C8b). */
export const GIORNATA_INTERA_MINUTI = 360;

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;
const minutiDi = (w) => (w?.start instanceof Date && w?.end instanceof Date ? (w.end.getTime() - w.start.getTime()) / 60000 : 0);

/** Quante ancore per giorno: 3 in una giornata intera, 1 in mezza giornata (o meno). */
export const ancorePerGiorno = (tourWindow) => (Array.isArray(tourWindow?.windows) && tourWindow.windows.length
    ? tourWindow.windows.map(w => (minutiDi(w) >= GIORNATA_INTERA_MINUTI ? ANCORE_GIORNATA_INTERA : ANCORE_MEZZA_GIORNATA))
    : [ANCORE_MEZZA_GIORNATA]);

/**
 * I posti verificati come candidati del motore: il risultato di Google (stessa forma della ricerca) passa per
 * `buildPOI` (buildPOIFromCandidate) e porta con se' `_citta` = { tipo, momento }. Mai il «perche'».
 */
export function poiDallaLista(verificati, city, buildPOI) {
    return (Array.isArray(verificati) ? verificati : []).filter(v => v && v.place_id).map(v => {
        const { _citta, ...google } = v;
        const poi = buildPOI(google, city);
        const ess = _citta?.tipo === 'essenziale';
        return {
            ...poi,
            _citta: {
                tipo: ess ? 'essenziale' : 'da locale', momento: _citta?.momento || null,
                // C10b — il quartiere camminabile (solo metropoli) e il simbolo (sempre un essenziale)
                ...(_citta?.quartiere ? { quartiere: String(_citta.quartiere) } : {}),
                ...(ess && _citta?.simbolo ? { simbolo: true } : {}),
                ...(ess && _citta?.simboloDedotto ? { simboloDedotto: true } : {}),
                // C10b3 — la categoria detta dall'AI, la via principale del borgo (vale come passeggiata), le aggiunte del completamento
                ...(_citta?.categoria ? { categoria: String(_citta.categoria) } : {}),
                ...(_citta?.passeggiata ? { passeggiata: true } : {}),
                ...(_citta?.completamento ? { completamento: true } : {}),
            },
        };
    });
}

// ─── C10b — tre scale di luogo (decisione di Ivano): borgo, città, metropoli ─────────────────────────────────────────
//
// L'AI propone la scala nella lista; il motore la CONFERMA con i dati: il DIAMETRO della lista, cioe' la distanza massima
// fra due essenziali verificati (con meno di due essenziali, fra tutti i verificati).
//   · metropoli: confermata se il diametro supera SOGLIA_METROPOLI_KM (2 km, 27 minuti a piedi: piu' del tetto di cammino
//     C5c, 20 minuti = 1,5 km). Le ancore non stanno in un solo giro a piedi: la giornata si fa in un quartiere.
//   · borgo: confermato se il diametro non supera la stessa soglia (un borgo si gira tutto a piedi).
//   · altrimenti (o senza proposta, o senza dati): città, come C10.
export const SOGLIA_METROPOLI_KM = 2;
/** Un borgo con meno di 4 posti verificati si gira in mezza giornata. */
export const BORGO_MIN_VERIFICATI = 4;
/** Il raggio del borgo nel client: lo stesso della verifica della lista sul server (`RAGGIO_BORGO_KM` del proxy) e del filtro
 * del raggio per i borghi (`applyRadiusFilter`, 5 km). */
export const RAGGIO_BORGO_KM = 5;
export const MEZZA_GIORNATA_MINUTI = 240;
/**
 * C10b2 — il giro corto di un borgo con meno di 4 posti: la durata segue le tappe che ci sono (decisione di Ivano), niente
 * tempo libero aggiunto per riempire la mezza giornata. 45 minuti per luogo da visitare (sosta media 30 + cammino 15), da 2
 * a 4 luoghi: 90–180 minuti dalla partenza. La finestra non si allunga mai.
 */
export const MINUTI_PER_TAPPA_BORGO = 45;
export const durataBorgoCorto = (visitabili) => MINUTI_PER_TAPPA_BORGO * Math.min(4, Math.max(2, Number(visitabili) || 0));
/**
 * C10b3 — il giro corto di un borgo nella FASCIA APERTA (decisione di Ivano): fra l'inizio e la fine della finestra, a passi di
 * 30 minuti, la fascia in cui sono aperti piu' posti della lista (poi piu' luoghi da visitare in tutto); a parita' la prima.
 * La durata segue i luoghi aperti in quella fascia (durataBorgoCorto: 45 min ciascuno, 2–4). La finestra non si allunga mai.
 * Un posto conta se e' aperto per una sosta intera (45 min) dentro la fascia; senza orari conta come aperto.
 *
 * TROINA-FIX — `visite`: le ore in cui una visita sta nel giro (la mattina e il pomeriggio della tabella dei momenti; pranzo,
 * aperitivo e cena prendono locali, non luoghi). Con `visite` un posto conta solo se la sua sosta intera cade in quelle ore, e
 * una fascia senza il tempo di una visita (45 min) non si sceglie: alle 12:06 la fascia 12:06–15:06 era tutta pranzo, e un
 * Quiz Natura usciva vuoto. Se nessuna fascia ha il tempo di una visita (una finestra di sera), vale la regola di prima.
 * La durata non cambia: 45 minuti per luogo aperto, da 2 a 4.
 * @param {{ candidati?: object[], lista?: object[], finestra?: { start: Date, end: Date }, passoMinuti?: number,
 *   visite?: Array<{ start: Date, end: Date }>|null }} p
 * @returns {{ start: Date, end: Date, minuti: number, listaAperti: number, aperti: number }|null}
 */
export function fasciaApertaBorgo({ candidati = [], lista = [], finestra = null, passoMinuti = 30, visite = null } = {}) {
    if (!(finestra?.start instanceof Date) || !(finestra?.end instanceof Date)) return null;
    if (Array.isArray(visite) && visite.length > 0) {
        const conVisite = fasciaPer({ candidati, lista, finestra, passoMinuti, visite });
        if (conVisite) return conVisite;
    }
    return fasciaPer({ candidati, lista, finestra, passoMinuti, visite: null });
}

const SOSTA_MS = MINUTI_PER_TAPPA_BORGO * 60000;
// i minuti di [da, a] che cadono nelle ore di visita
const minutiDiVisita = (da, a, visite) => visite.reduce((n, v) => n + Math.max(0, Math.min(a, v.end.getTime()) - Math.max(da, v.start.getTime())), 0) / 60000;
// una sosta intera [u, u + 45 min] dentro le ore di visita (senza `visite`, sempre)
const sostaInVisita = (u, visite) => !visite || visite.some(v => u >= v.start.getTime() && u + SOSTA_MS <= v.end.getTime());

function fasciaPer({ candidati, lista, finestra, passoMinuti, visite }) {
    const s0 = finestra.start.getTime(), e0 = finestra.end.getTime();
    const idLista = new Set(lista.map(idOf));
    const minimo = durataBorgoCorto(0);
    let meglio = null;
    for (let t = s0; t + minimo * 60000 <= e0; t += passoMinuti * 60000) {
        // aperto per una sosta intera (45 min) dentro la fascia, come vuole ORARI; senza orari conta come aperto
        const apertiIn = (min) => {
            const fine = Math.min(e0, t + min * 60000);
            return candidati.filter(c => {
                let ignoto = false;
                for (let u = t; u + SOSTA_MS <= fine; u += 15 * 60000) {
                    if (!sostaInVisita(u, visite)) continue;
                    const st = openStatus(c, new Date(u), MINUTI_PER_TAPPA_BORGO).stato;
                    if (st === 'aperto') return true;
                    if (st === 'sconosciuto') ignoto = true;
                }
                return ignoto;
            });
        };
        const minuti = Math.min((e0 - t) / 60000, durataBorgoCorto(apertiIn(MINUTI_PER_TAPPA_BORGO * 4).length));
        // TROINA-FIX — una fascia senza il tempo di una visita non e' un giro: si passa alla prossima
        if (visite && minutiDiVisita(t, t + minuti * 60000, visite) < MINUTI_PER_TAPPA_BORGO) continue;
        const aperti = apertiIn(minuti);
        if (visite && aperti.length === 0) continue;
        const listaAperti = aperti.filter(c => idLista.has(idOf(c))).length;
        // a parita', la fascia in cui i posti della lista sono gia' aperti all'inizio (niente attesa davanti alle porte chiuse)
        const subito = aperti.filter(c => idLista.has(idOf(c)) && openStatus(c, new Date(t), MINUTI_PER_TAPPA_BORGO).stato === 'aperto').length;
        const punti = listaAperti * 10 + aperti.length + subito * 0.5;
        if (!meglio || punti > meglio.punti) meglio = { punti, start: new Date(t), end: new Date(t + minuti * 60000), minuti, listaAperti, aperti: aperti.length };
    }
    if (!meglio) return null;
    const { punti: _p, ...fascia } = meglio;
    return fascia;
}

/**
 * TROINA-FIX — le ore di visita di un giorno (la mattina e il pomeriggio della tabella dei momenti: «una visita e' una tappa
 * di mattina o pomeriggio», C8e), per `fasciaApertaBorgo`.
 * @param {Date} giorno un istante del giorno (ora di Roma)
 * @returns {Array<{ start: Date, end: Date }>}
 */
export const oreDiVisita = (giorno) => {
    const p = romeParts(giorno);
    const day = { y: p.y, m: p.m, d: p.d };
    return ['mattina', 'pomeriggio'].map(k => MOMENT_BY_KEY[k]).map(m => ({ start: romeDate(day, m.start), end: romeDate(day, m.end) }));
};

/** La riga a schermo (testo approvato da Ivano nel task C10b). */
export const rigaBorgo = (citta) => `${citta} si gira in mezza giornata.`;
/** C10b2 — il raggio del quartiere: 2 km dal suo centro (decisione di Ivano). */
export const RAGGIO_QUARTIERE_KM = 2;
/**
 * C10b2 — due quartieri sono VICINI se i loro centri stanno entro 3 km: i due cerchi da 2 km si sovrappongono per almeno 1 km,
 * e nella parte comune c'e' un passaggio dalla mattina al pomeriggio dentro il tetto di cammino C5c (20 min = 1,5 km), che
 * poi il riparatore controlla tappa per tappa come sempre.
 */
export const QUARTIERI_VICINI_KM = 3;
/** Un quartiere chiesto con meno di questi luoghi da visitare (non locali) in lista riceve la sua lista dedicata. */
export const LUOGHI_QUARTIERE_MIN = 3;
/** Il tetto di cammino in km (lo stesso di C5c): serve solo a dichiarare la regola dei quartieri vicini. */
export const TETTO_CAMMINO_KM = MAX_WALK_METERS / 1000;

const latOf = (c) => c?.latitude ?? c?.lat ?? c?.geometry?.location?.lat;
const lngOf = (c) => c?.longitude ?? c?.lng ?? c?.geometry?.location?.lng;
const conCoordinate = (c) => Number.isFinite(latOf(c)) && Number.isFinite(lngOf(c));
export const kmTra = (a, b) => {
    const r = (x) => (x * Math.PI) / 180;
    const dLat = r(latOf(b) - latOf(a)), dLng = r(lngOf(b) - lngOf(a));
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(latOf(a))) * Math.cos(r(latOf(b))) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Il diametro della lista: la distanza massima fra due essenziali verificati (con meno di due, fra tutti). */
export function diametroLista(poi) {
    const tutti = (poi || []).filter(conCoordinate);
    const ess = tutti.filter(p => p._citta?.tipo === 'essenziale');
    const base = ess.length >= 2 ? ess : tutti;
    let km = 0;
    for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) km = Math.max(km, kmTra(base[i], base[j]));
    return { km: Math.round(km * 100) / 100, su: ess.length >= 2 ? 'essenziali' : 'tutti i verificati', posti: base.length };
}

/**
 * La scala confermata dal motore: { scala, proposta, diametroKm, su, motivo }.
 * @param {{ proposta: 'borgo'|'città'|'metropoli'|null, poi: Array }} o
 */
export function scalaConfermata({ proposta = null, poi = [] } = {}) {
    const d = diametroLista(poi);
    const base = { proposta, diametroKm: d.km, su: d.su };
    if (d.posti < 2) return { ...base, scala: proposta === 'borgo' ? 'borgo' : 'città', motivo: 'meno di due posti verificati: resta la proposta (un borgo) o la città' };
    if (proposta === 'metropoli') {
        return d.km > SOGLIA_METROPOLI_KM
            ? { ...base, scala: 'metropoli', motivo: `essenziali a ${d.km} km fra loro (oltre ${SOGLIA_METROPOLI_KM}): non stanno in un giro a piedi` }
            : { ...base, scala: 'città', motivo: `proposta metropoli, ma gli essenziali stanno in ${d.km} km: si gira come una città` };
    }
    if (proposta === 'borgo') {
        return d.km <= SOGLIA_METROPOLI_KM
            ? { ...base, scala: 'borgo', motivo: `i posti stanno in ${d.km} km: si gira tutto a piedi` }
            : { ...base, scala: 'città', motivo: `proposto borgo, ma i posti stanno in ${d.km} km: lo tratto come una città` };
    }
    return { ...base, scala: 'città', motivo: proposta === 'città' ? 'proposta città' : 'nessuna proposta: città' };
}

const normTesto = (s) => ` ${String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’`']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * I quartieri della lista (solo metropoli): nome, centro, posti, essenziali, raggio (2 km). Il CENTRO e' il baricentro dei
 * posti VERIFICATI del quartiere (lista della citta' e, se c'e', lista dedicata del quartiere), mai il punto geografico del
 * nome: e' dove stanno davvero le cose da fare.
 */
export function quartieriDallaLista(poi) {
    const per = new Map();
    for (const p of poi || []) {
        const q = p._citta?.quartiere;
        if (!q || !conCoordinate(p)) continue;
        const k = normTesto(q).trim();
        if (!per.has(k)) per.set(k, { nome: q, chiave: k, posti: [] });
        per.get(k).posti.push(p);
    }
    return [...per.values()].map(q => {
        const centro = { latitude: q.posti.reduce((a, p) => a + latOf(p), 0) / q.posti.length, longitude: q.posti.reduce((a, p) => a + lngOf(p), 0) / q.posti.length };
        const essenziali = q.posti.filter(p => p._citta?.tipo === 'essenziale');
        const daVisitare = q.posti.filter(p => !COMMERCIAL_KINDS.has(placeKind(p).kind));
        return { nome: q.nome, chiave: q.chiave, centro, raggioKm: RAGGIO_QUARTIERE_KM, posti: q.posti, essenziali, daVisitare };
    });
}

/**
 * Il quartiere (o i due quartieri) della giornata in una metropoli (C10b2, decisioni di Ivano):
 *   - nominato nella richiesta («Trastevere»): vale da solo, anche senza essenziali in lista;
 *   - altrimenti si sceglie SOLO fra i quartieri con almeno 1 essenziale verificato: quello con piu' ancore aperte nella
 *     finestra, a parita' il piu' vicino alla partenza;
 *   - `dueQuartieri` (giornata intera, nessun quartiere nominato): la mattina nel primo, il pomeriggio nel quartiere con
 *     almeno 1 essenziale piu' vicino al primo, se i centri stanno entro QUARTIERI_VICINI_KM.
 * @returns {{ quartiere, secondo, motivo, motivoSecondo, classifica }}
 */
export function scegliQuartiere({ poi = [], testo = '', partenza = null, finestre = [], dueQuartieri = false } = {}) {
    const quartieri = quartieriDallaLista(poi);
    if (quartieri.length === 0) return { quartiere: null, secondo: null, motivo: null, motivoSecondo: null, classifica: [] };
    const t = normTesto(testo);
    const nominato = quartieri
        .filter(q => q.chiave.length >= 3 && t.includes(` ${q.chiave} `))
        .sort((a, b) => b.chiave.length - a.chiave.length)[0];
    const aperte = (q) => q.essenziali.filter(e => !finestre.length || finestre.some(w => apertoNellaFinestra(e, w))).length;
    const classifica = quartieri.map(q => ({
        nome: q.nome, essenziali: q.essenziali.length, ancoreAperte: aperte(q), luoghiDaVisitare: q.daVisitare.length,
        kmDallaPartenza: partenza && conCoordinate(partenza) ? Math.round(kmTra(partenza, q.centro) * 100) / 100 : null,
    }));
    if (nominato) return { quartiere: nominato, secondo: null, motivo: 'nominato nella richiesta', motivoSecondo: null, classifica };
    const conEssenziali = quartieri.filter(q => q.essenziali.length >= 1);
    if (conEssenziali.length === 0) return { quartiere: null, secondo: null, motivo: 'nessun quartiere con un essenziale verificato', motivoSecondo: null, classifica };
    const km = (q) => (partenza && conCoordinate(partenza) ? kmTra(partenza, q.centro) : 0);
    // C10c — il simbolo dichiarato dall'AI entra sempre (decisione di Ivano): senza un quartiere chiesto, la giornata parte dal suo
    const sAI = simboloAI(poi);
    const delSimbolo = sAI ? conEssenziali.find(q => delQuartiere(sAI, q) && (!finestre.length || finestre.some(w => apertoNellaFinestra(sAI, w)))) : null;
    const primo = delSimbolo || [...conEssenziali].sort((a, b) => (aperte(b) - aperte(a)) || (km(a) - km(b)))[0];
    const motivo = delSimbolo ? `il quartiere del simbolo (${sAI.name || sAI.title})` : 'il quartiere con piu\' ancore aperte, il piu\' vicino alla partenza a parita\'';
    if (!dueQuartieri) return { quartiere: primo, secondo: null, motivo, motivoSecondo: null, classifica };
    const vicini = conEssenziali.filter(q => q !== primo).map(q => ({ q, d: kmTra(primo.centro, q.centro) })).filter(x => x.d <= QUARTIERI_VICINI_KM)
        .sort((a, b) => a.d - b.d);
    if (!vicini.length) return { quartiere: primo, secondo: null, motivo, motivoSecondo: `nessun quartiere con un essenziale entro ${QUARTIERI_VICINI_KM} km: tutta la giornata a ${primo.nome}`, classifica };
    return { quartiere: primo, secondo: vicini[0].q, motivo, motivoSecondo: `il quartiere con un essenziale piu' vicino a ${primo.nome} (${Math.round(vicini[0].d * 100) / 100} km fra i centri)`, classifica };
}

/** L'area della giornata: un quartiere, o due (mattina nel primo, pomeriggio nel secondo). `centro`/`raggioKm` per le ricerche. */
export function areaDeiQuartieri(q1, q2 = null) {
    const area = (q) => ({ nome: q.nome, chiave: q.chiave, centro: q.centro, raggioKm: q.raggioKm });
    if (!q2) return { ...area(q1), aree: [area(q1)] };
    const centro = { latitude: (q1.centro.latitude + q2.centro.latitude) / 2, longitude: (q1.centro.longitude + q2.centro.longitude) / 2 };
    // le ricerche senza una tappa da cui partire guardano tutto lo spazio dei due quartieri
    const raggioKm = Math.round((kmTra(q1.centro, q2.centro) / 2 + Math.max(q1.raggioKm, q2.raggioKm)) * 100) / 100;
    return { nome: `${q1.nome} + ${q2.nome}`, chiave: `${q1.chiave}+${q2.chiave}`, centro, raggioKm, aree: [area(q1), area(q2)] };
}

// I momenti della MATTINA stanno nel primo quartiere, quelli dal pomeriggio in poi nel secondo, il pranzo in uno dei due.
const MOMENTI_MATTINA = new Set(['colazione', 'mattina']);
const MOMENTI_PONTE = new Set(['pranzo']);

/** I bucket dei momenti dentro la loro area: con due quartieri, mattina nel primo, pranzo in uno dei due, il resto nel secondo. */
export function bucketsNelleAree(moments, buckets, area) {
    if (!buckets || !area?.aree || area.aree.length < 2) return buckets;
    const [a1, a2] = area.aree;
    const out = new Map();
    for (const m of moments || []) {
        const b = buckets.get(m.id) || [];
        const dentro = MOMENTI_MATTINA.has(m.key) ? (c) => dentroUna(c, a1)
            : MOMENTI_PONTE.has(m.key) ? (c) => dentroUna(c, a1) || dentroUna(c, a2)
                : (c) => dentroUna(c, a2);
        out.set(m.id, b.filter(dentro));
    }
    for (const [k, v] of buckets) if (!out.has(k)) out.set(k, v);
    return out;
}

/** Il posto e' di quel quartiere? (nome confrontato senza maiuscole, accenti e punteggiatura) */
export const delQuartiere = (c, q) => !!q && normTesto(c?._citta?.quartiere).trim() === q.chiave;

const dentroUna = (c, a) => !conCoordinate(c) || kmTra(a.centro, c) <= a.raggioKm;
/** Un posto dentro l'area della giornata (un quartiere, o uno dei due). Senza coordinate: non si giudica, resta. */
export const dentroArea = (c, area) => !area || (Array.isArray(area.aree) && area.aree.length ? area.aree.some(a => dentroUna(c, a)) : dentroUna(c, area));

/** I candidati delle ricerche con quelli della lista: un posto gia' trovato dalla ricerca resta quello, e prende `_citta`. */
export function uniscialPool(candidates, poiCitta) {
    const lista = new Map((poiCitta || []).map(p => [idOf(p), p]));
    const out = (candidates || []).map(c => (lista.has(idOf(c)) ? { ...lista.get(idOf(c)), ...c, _citta: lista.get(idOf(c))._citta } : c));
    const gia = new Set(out.map(idOf));
    for (const p of poiCitta || []) if (!gia.has(idOf(p))) out.push(p);
    return out;
}

/** Aperto almeno per una sosta da 30 minuti dentro una finestra (passi di 30 minuti); senza orari conta come aperto. */
export function apertoNellaFinestra(c, w) {
    if (!(w?.start instanceof Date) || !(w?.end instanceof Date)) return true;
    let ignoto = false;
    for (let t = w.start.getTime(); t + 30 * 60000 <= w.end.getTime(); t += 30 * 60000) {
        const st = openStatus(c, new Date(t), 30).stato;
        if (st === 'aperto') return true;
        if (st === 'sconosciuto') ignoto = true;
    }
    return ignoto;
}

/**
 * Le ancore della giornata: gli essenziali della lista, nell'ordine dell'AI, aperti nella finestra, una per famiglia
 * (due chiese non sono due ancore: la regola di varieta' ne terrebbe una sola), al massimo `cap`.
 */
export function scegliAncore(essenziali, { cap, finestre = [] } = {}) {
    const out = [];
    const famiglie = new Set();
    for (const c of essenziali || []) {
        if (out.length >= cap) break;
        if (finestre.length && !finestre.some(w => apertoNellaFinestra(c, w))) continue;
        const f = candidateFamily(c);
        if (f && famiglie.has(f)) continue;
        if (f) famiglie.add(f);
        out.push(c);
    }
    return out;
}

/**
 * Il pool dopo il merito, con la lista della città (decisione di Ivano su P7a):
 *   - gli essenziali aperti nella finestra (una famiglia ciascuno, al massimo 4) sono candidati ad ANCORA e i posti
 *     «da locale» passano DAVANTI e fuori dal merito: non contano nel limite dei 20 ne' nel tetto delle icone;
 *   - le ancore vere (al massimo 3 per giornata intera, 1 per mezza) si scelgono alla semina, fra quelle che stanno
 *     davvero in un momento (aperte, della categoria giusta): le altre perdono la priorita' (vedi `declassa`);
 *   - gli essenziali chiusi o di una famiglia gia' presa tornano al merito anti-ovvio con tutti gli altri (`seleziona`).
 * @param {Array} candidates il pool dopo raggio, categoria, dieta e budget, tipico
 * @param {{ seleziona: (altri: Array) => Array, tourWindow?: object }} o
 * @returns {{ candidates: Array, ancore: Array, daLocale: Array, essenzialiAlMerito: Array }}
 */
/** C10c — 2 il simbolo dichiarato dall'AI, 1 un simbolo dedotto dal codice, 0 gli altri. */
export const rangoSimbolo = (c) => (c?._citta?.simbolo ? (c._citta.simboloDedotto ? 1 : 2) : 0);
/** C10c — il simbolo della citta' dichiarato dall'AI (il primo non dedotto), o null. */
export const simboloAI = (poi) => (poi || []).find(p => p?._citta?.tipo === 'essenziale' && rangoSimbolo(p) === 2) || null;

export function poolConLista(candidates, { seleziona, tourWindow = null } = {}) {
    const lista = (candidates || []).filter(c => c?._citta);
    if (lista.length === 0) return { candidates: seleziona(candidates || []), ancore: [], daLocale: [], essenzialiAlMerito: [] };
    // un essenziale che e' un locale (bar, caffe', ristorante, negozio) non e' un'ancora: resta un posto «da locale»
    const locale = (c) => COMMERCIAL_KINDS.has(placeKind(c).kind);
    for (const c of lista) if (c._citta.tipo === 'essenziale' && locale(c)) c._citta = { ...c._citta, tipo: 'da locale', eraEssenziale: true };
    // C10b — il SIMBOLO per primo: e' la prima ancora (una famiglia gia' presa non lo scavalca).
    // C10c — il simbolo DICHIARATO dall'AI vince su uno dedotto dal codice (decisione di Ivano): prima lui, poi i dedotti.
    const essenziali = lista.filter(c => c._citta.tipo === 'essenziale').sort((x, y) => rangoSimbolo(y) - rangoSimbolo(x));
    const ancore = scegliAncore(essenziali, { cap: ANCORE_CANDIDATE_MAX, finestre: tourWindow?.windows || [] })
        .map(c => ({ ...c, _citta: { ...c._citta, ancora: true } }));
    const idAncore = new Set(ancore.map(idOf));
    const daLocale = lista.filter(c => c._citta.tipo !== 'essenziale');
    // gli essenziali non scelti come ancore: candidati come gli altri, senza priorita'
    const essenzialiAlMerito = essenziali.filter(c => !idAncore.has(idOf(c))).map(({ _citta, ...c }) => ({ ...c, _cittaEssenziale: true }));
    const altri = (candidates || []).filter(c => !c?._citta);
    const scelti = seleziona([...altri, ...essenzialiAlMerito]);
    return { candidates: [...ancore, ...daLocale, ...scelti], ancore, daLocale, essenzialiAlMerito };
}

// Il momento della lista → la chiave del momento dello scheletro dove si prova per primo.
const MOMENTO_SCHELETRO = { colazione: 'mattina', mattina: 'mattina', pranzo: 'pranzo', pomeriggio: 'pomeriggio', aperitivo: 'aperitivo', cena: 'cena', dopocena: 'dopocena' };
const VISITE = ['mattina', 'pomeriggio'];

/**
 * Le ancore proposte al riparatore come scelte del modello, in testa al loro momento: prima il momento detto dalla
 * lista, poi le visite (mattina, pomeriggio), poi gli altri momenti dove il bucket (aperto, categoria giusta) le ammette;
 * al massimo `ancorePerGiorno` per giorno (3 in una giornata intera, 1 in mezza). Le regole restano tutte: il riparatore
 * la tiene solo se nessuna alternativa costa meno (vedi momentSelection.modelWins). Le candidate che non entrano
 * (nessun momento le ammette, o il giorno ha gia' le sue ancore) tornano in `nonSeminate`: si declassano.
 * @returns {{ aiStops: Array, seminate: Array<{ place_id, nome, momento }>, nonSeminate: Array }}
 */
export function seminaAncore(aiStops, ancore, moments, buckets, tourWindow = null) {
    const capGiorno = ancorePerGiorno(tourWindow);
    const perGiorno = new Map();
    // C10b — mai piu' ancore delle tappe del momento: l'ultima cadrebbe «oltre il numero di tappe».
    const perMomento = new Map();
    const davanti = [];
    const seminate = [];
    const nonSeminate = [];
    for (const a of ancore || []) {
        const id = idOf(a);
        const ordine = [...moments].sort((x, y) => {
            const pref = (m) => (m.key === MOMENTO_SCHELETRO[a._citta?.momento] ? 0 : VISITE.includes(m.key) ? 1 : 2);
            return (x.dayIndex - y.dayIndex) || (pref(x) - pref(y));
        });
        const m = ordine.find(mm => (perGiorno.get(mm.dayIndex) || 0) < (capGiorno[mm.dayIndex] ?? ANCORE_MEZZA_GIORNATA)
            && (perMomento.get(mm.id) || 0) < (Number.isFinite(mm.stops) ? mm.stops : Infinity)
            && (buckets?.get(mm.id) || []).some(c => idOf(c) === id));
        if (!m) { nonSeminate.push(a); continue; }
        perGiorno.set(m.dayIndex, (perGiorno.get(m.dayIndex) || 0) + 1);
        perMomento.set(m.id, (perMomento.get(m.id) || 0) + 1);
        davanti.push({ place_id: id, moment: m.id });
        seminate.push({ place_id: id, nome: a.name || a.title || null, momento: m.id });
    }
    // la scelta del modello sullo stesso posto (magari in un altro momento) lascia il posto all'ancora
    const ids = new Set(davanti.map(s => s.place_id));
    const resto = (aiStops || []).filter(s => !ids.has(s?.place_id));
    return { aiStops: [...davanti, ...resto], seminate, nonSeminate };
}

/**
 * Un'ancora candidata che non e' stata seminata perde la priorita': resta nel pool come un posto qualunque (merito
 * anti-ovvio, nessun bonus), cosi' le ancore del giorno restano al massimo 3 (1 in mezza giornata). Il candidato e' lo
 * stesso oggetto nel pool e nei bucket: basta togliergli l'etichetta.
 */
export function declassa(nonSeminate) {
    for (const c of nonSeminate || []) if (c && c._citta) { delete c._citta; c._cittaEssenziale = true; }
}

// ─── C10c — un quartiere chiesto che non e' nella lista (decisione di Ivano) ──────────────────────────────────────────
//
// Se la richiesta nomina un quartiere che la lista del giorno non ha («una giornata a Trastevere» con una lista Monti /
// Centro / Prati), il motore lo riconosce comunque: il nome si verifica su Google dentro la citta' (un quartiere, non una
// via), parte la lista dedicata del quartiere (C10b2) e la giornata parte da li'. Regola: almeno meta' delle tappe nel
// quartiere (il NUCLEO: 1 km dal punto di Google, dentro il suo riquadro), le altre nei quartieri vicini a piedi (l'AREA: 2 km).

const PREPOSIZIONI = 'a|in|nel|nella|nello|al|allo|alla|ai|agli|alle|per|da|dal|dalla|dai|tra|fra|verso|sul|sulla|dentro';
const PAROLE_NON_LUOGO = new Set(['domani', 'oggi', 'dopodomani', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica', 'italia']);

/**
 * I nomi propri dopo una preposizione («a Trastevere», «nel Rione Monti», «a Campo de' Fiori»), tolto il nome della citta':
 * i candidati a quartiere, da verificare su Google. Al massimo 2.
 */
export function nomiDiLuogoNelTesto(testo, citta = '') {
    const t = String(testo || '');
    const re = new RegExp(`(?:^|\\s)(?:${PREPOSIZIONI})\\s+((?:[A-ZÀ-Ý][\\p{L}'’]*)(?:\\s+(?:(?:de'|de’|di|del|dei|della|delle|degli|dello|e)\\s+)?[A-ZÀ-Ý][\\p{L}'’]*)*)`, 'gu');
    const cittaN = normTesto(citta).trim();
    const out = [];
    for (const m of t.matchAll(re)) {
        const nome = m[1].trim();
        const k = normTesto(nome).trim();
        if (!k || k === cittaN || PAROLE_NON_LUOGO.has(k) || out.some(x => normTesto(x).trim() === k)) continue;
        out.push(nome);
        if (out.length >= 2) break;
    }
    return out;
}

/** I tipi Google di un quartiere (mai una via, mai una citta'). */
export const TIPI_QUARTIERE = new Set(['neighborhood', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'sublocality_level_3',
    'sublocality_level_4', 'sublocality_level_5', 'colloquial_area', 'administrative_area_level_4', 'administrative_area_level_5']);
/** Il nucleo di un quartiere senza riquadro di Google: 1 km dal suo punto. */
export const NUCLEO_QUARTIERE_KM = 1;
/** Il margine sul riquadro di Google: un posto sul bordo del rione (una piazza, un ponte) e' ancora del rione. */
export const MARGINE_NUCLEO_KM = 0.15;

/**
 * Il risultato di Google per «nome, citta'» e' davvero quel quartiere? Un tipo da quartiere, il nome compatibile, dentro la
 * citta' (entro `raggioCittaKm` dal centro).
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function quartiereConfermato(candidato, nome, centroCitta, raggioCittaKm = 20) {
    if (!candidato) return { ok: false, motivo: 'nessun risultato' };
    const tipi = Array.isArray(candidato.types) ? candidato.types : [];
    if (!tipi.some(x => TIPI_QUARTIERE.has(x))) return { ok: false, motivo: `non e' un quartiere (${tipi.join(', ') || 'senza tipi'})` };
    const a = normTesto(candidato.name).trim(), b = normTesto(nome).trim();
    if (!a || !b || !(a.includes(b) || b.includes(a))) return { ok: false, motivo: `nome diverso («${candidato.name}»)` };
    const loc = candidato.geometry?.location;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return { ok: false, motivo: 'senza coordinate' };
    if (centroCitta && conCoordinate(centroCitta) && kmTra(centroCitta, { latitude: loc.lat, longitude: loc.lng }) > raggioCittaKm) {
        return { ok: false, motivo: 'fuori dalla citta\'' };
    }
    return { ok: true };
}

/**
 * Il quartiere chiesto fuori lista, nella forma di `quartieriDallaLista`: centro = il punto di Google, raggio dell'area 2 km,
 * gli essenziali e i luoghi da visitare dalla sua lista dedicata; `nucleo` = 1 km dal punto di Google, dentro il suo riquadro.
 */
export function quartiereFuoriLista({ nome, candidato, poiQuartiere = [] }) {
    const loc = candidato.geometry.location;
    const centro = { latitude: loc.lat, longitude: loc.lng };
    const posti = poiQuartiere.filter(conCoordinate);
    return {
        nome, chiave: normTesto(nome).trim(), centro, raggioKm: RAGGIO_QUARTIERE_KM, posti,
        essenziali: posti.filter(p => p._citta?.tipo === 'essenziale'), daVisitare: posti.filter(p => !COMMERCIAL_KINDS.has(placeKind(p).kind)),
        nucleo: nucleoDellaLista(posti) || { tipo: 'cerchio', centro, raggioKm: NUCLEO_QUARTIERE_KM, fonte: 'google' }, fuoriLista: true,
    };
}

// C10c-piena-2 — IL NUCLEO VERO del quartiere chiesto (decisione di Ivano): il baricentro dei luoghi verificati della sua lista,
// non il punto ne' il riquadro di Google. Il raggio arriva fin dove stanno i suoi luoghi (il piu' lontano + 150 m), mai oltre
// 1 km e mai sotto 500 m: con 1 km pieno dal baricentro di Trastevere il Giardino degli Aranci (0,98 km, oltre il Tevere)
// conterebbe come Trastevere.
export const NUCLEO_MIN_KM = 0.5;
export function nucleoDellaLista(posti) {
    const p = (posti || []).filter(conCoordinate);
    if (p.length < 2) return null;
    const centro = { latitude: p.reduce((a, x) => a + latOf(x), 0) / p.length, longitude: p.reduce((a, x) => a + lngOf(x), 0) / p.length };
    const lontano = Math.max(...p.map(x => kmTra(centro, x)));
    const raggioKm = Math.round(Math.min(NUCLEO_QUARTIERE_KM, Math.max(NUCLEO_MIN_KM, lontano + MARGINE_NUCLEO_KM)) * 100) / 100;
    return { tipo: 'cerchio', centro, raggioKm, fonte: 'lista', luoghi: p.length };
}

/** Il nucleo di un quartiere della lista (chiesto per nome): 1 km dal suo centro. */
export const nucleoDi = (q) => q?.nucleo || (q?.centro ? { tipo: 'cerchio', centro: q.centro, raggioKm: NUCLEO_QUARTIERE_KM } : null);

/** Un posto nel nucleo del quartiere chiesto (senza coordinate: non si giudica, resta). */
export function dentroNucleo(c, nucleo) {
    if (!nucleo || !conCoordinate(c)) return true;
    if (kmTra(nucleo.centro, c) > nucleo.raggioKm) return false;
    const r = nucleo.riquadro;
    if (!r) return true;
    const mLat = (r.margineKm || 0) / 111;
    const mLng = (r.margineKm || 0) / (111 * Math.cos((latOf(c) * Math.PI) / 180));
    return latOf(c) <= r.nord + mLat && latOf(c) >= r.sud - mLat && lngOf(c) <= r.est + mLng && lngOf(c) >= r.ovest - mLng;
}

// Le visite e il pranzo stanno nel nucleo del quartiere chiesto; aperitivo, passeggiata, cena e dopocena nell'area (a piedi).
const MOMENTI_NEL_NUCLEO = new Set(['colazione', 'mattina', 'pranzo', 'pomeriggio']);

/**
 * C10c — i bucket con un quartiere chiesto: mattina, pranzo e pomeriggio nel suo nucleo (cosi' il giro parte da li' e la
 * maggior parte delle tappe ci sta), la sera nell'area a piedi. Un momento che nel nucleo resterebbe vuoto tiene l'area.
 */
export function bucketsNelNucleo(moments, buckets, nucleo) {
    if (!buckets || !nucleo) return buckets;
    const out = new Map(buckets);
    for (const m of moments || []) {
        if (!MOMENTI_NEL_NUCLEO.has(m.key)) continue;
        const b = buckets.get(m.id) || [];
        const dentro = b.filter(c => dentroNucleo(c, nucleo));
        if (dentro.length > 0) out.set(m.id, dentro);
    }
    return out;
}

/**
 * C10c — ORARI: un'ancora vietata nel suo momento (chiusa quando ci si arriva) puo' andare in un altro momento dello stesso
 * giorno in cui e' aperta (il bucket, gia' filtrato per orari e divieti, la contiene) e c'e' posto per un'ancora (mai piu'
 * ancore delle tappe del momento). Prima le visite (mattina, pomeriggio).
 * @returns {{ aiStops: Array, spostate: Array<{ place_id, da, a }> }}
 */
export function spostaAncoreVietate(aiStops, idAncore, moments, buckets, veto) {
    if (!veto?.size || !idAncore?.size) return { aiStops, spostate: [] };
    const spostate = [];
    const out = [...(aiStops || [])];
    const byId = new Map((moments || []).map(m => [m.id, m]));
    const ancoreIn = (mid) => out.filter(s => idAncore.has(s?.place_id) && s.moment === mid).length;
    for (let i = 0; i < out.length; i++) {
        const s = out[i];
        if (!idAncore.has(s?.place_id) || !veto.get(s.moment)?.has(s.place_id)) continue;
        const da = byId.get(s.moment);
        if (!da) continue;
        const altro = [...moments]
            .filter(m => m.dayIndex === da.dayIndex && m.id !== da.id && !veto.get(m.id)?.has(s.place_id)
                && (buckets?.get(m.id) || []).some(c => idOf(c) === s.place_id)
                && ancoreIn(m.id) < (Number.isFinite(m.stops) ? m.stops : Infinity))
            .sort((x, y) => (VISITE.includes(y.key) ? 1 : 0) - (VISITE.includes(x.key) ? 1 : 0))[0];
        if (!altro) continue;
        out[i] = { ...s, moment: altro.id };
        spostate.push({ place_id: s.place_id, da: da.id, a: altro.id });
    }
    return { aiStops: out, spostate };
}

/**
 * C10c — BORGO (decisione di Ivano): la regola «la durata segue le tappe» conta solo i luoghi da visitare (e, per la durata,
 * le passeggiate): non i ristoranti, i bar, i negozi, ne' i posti che per Google non hanno un tipo.
 */
const TIPI_GENERICI = new Set(['point_of_interest', 'establishment']);
export const luogoDaVisitareBorgo = (p) => {
    // «point_of_interest» ed «establishment» li ha ogni posto: da soli non dicono cosa sia (San Silvestro a Troina)
    const tipi = (Array.isArray(p?.types) ? p.types : []).filter(t => !TIPI_GENERICI.has(t));
    if (tipi.length === 0 && !p?.primaryType) return false;
    return !COMMERCIAL_KINDS.has(placeKind(p).kind);
};
