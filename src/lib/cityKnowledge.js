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
export const MEZZA_GIORNATA_MINUTI = 240;
/** La riga a schermo (testo approvato da Ivano nel task C10b). */
export const rigaBorgo = (citta) => `${citta} si gira in mezza giornata.`;
/** Il raggio del quartiere: il tetto di cammino (20 min = 1,5 km); al massimo 2,5 km se i posti del quartiere stanno piu' lontani. */
export const RAGGIO_QUARTIERE_KM = MAX_WALK_METERS / 1000;
export const RAGGIO_QUARTIERE_MAX_KM = 2.5;

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

/** I quartieri della lista (solo metropoli): nome, centro (media dei posti), posti, essenziali, raggio. */
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
        const lontano = Math.max(0, ...essenziali.map(p => kmTra(centro, p)));
        const raggioKm = Math.round(Math.min(RAGGIO_QUARTIERE_MAX_KM, Math.max(RAGGIO_QUARTIERE_KM, lontano)) * 100) / 100;
        return { nome: q.nome, chiave: q.chiave, centro, raggioKm, posti: q.posti, essenziali };
    });
}

/**
 * Il quartiere della giornata in una metropoli: quello NOMINATO nella richiesta («Trastevere»); se non c'e', quello con piu'
 * ancore (essenziali) aperte nella finestra, e a parita' il piu' vicino alla partenza.
 * @returns {{ quartiere: object|null, motivo: string|null, classifica: Array }}
 */
export function scegliQuartiere({ poi = [], testo = '', partenza = null, finestre = [] } = {}) {
    const quartieri = quartieriDallaLista(poi);
    if (quartieri.length === 0) return { quartiere: null, motivo: null, classifica: [] };
    const t = normTesto(testo);
    const nominato = quartieri
        .filter(q => q.chiave.length >= 3 && t.includes(` ${q.chiave} `))
        .sort((a, b) => b.chiave.length - a.chiave.length)[0];
    const classifica = quartieri.map(q => ({
        nome: q.nome,
        ancoreAperte: q.essenziali.filter(e => !finestre.length || finestre.some(w => apertoNellaFinestra(e, w))).length,
        kmDallaPartenza: partenza && conCoordinate(partenza) ? Math.round(kmTra(partenza, q.centro) * 100) / 100 : null,
    }));
    if (nominato) return { quartiere: nominato, motivo: 'nominato nella richiesta', classifica };
    const ordine = [...quartieri].sort((a, b) => {
        const ca = classifica.find(x => x.nome === a.nome), cb = classifica.find(x => x.nome === b.nome);
        return (cb.ancoreAperte - ca.ancoreAperte) || ((ca.kmDallaPartenza ?? 0) - (cb.kmDallaPartenza ?? 0));
    });
    return { quartiere: ordine[0], motivo: 'il quartiere con piu\' ancore aperte, il piu\' vicino alla partenza a parita\'', classifica };
}

/** Il posto e' di quel quartiere? (nome confrontato senza maiuscole, accenti e punteggiatura) */
export const delQuartiere = (c, q) => !!q && normTesto(c?._citta?.quartiere).trim() === q.chiave;

/** Un posto dentro l'area del quartiere (cerchio attorno al suo centro). Senza coordinate: non si giudica, resta. */
export const dentroArea = (c, area) => !area || !conCoordinate(c) || kmTra(area.centro, c) <= area.raggioKm;

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
export function poolConLista(candidates, { seleziona, tourWindow = null } = {}) {
    const lista = (candidates || []).filter(c => c?._citta);
    if (lista.length === 0) return { candidates: seleziona(candidates || []), ancore: [], daLocale: [], essenzialiAlMerito: [] };
    // un essenziale che e' un locale (bar, caffe', ristorante, negozio) non e' un'ancora: resta un posto «da locale»
    const locale = (c) => COMMERCIAL_KINDS.has(placeKind(c).kind);
    for (const c of lista) if (c._citta.tipo === 'essenziale' && locale(c)) c._citta = { ...c._citta, tipo: 'da locale', eraEssenziale: true };
    // C10b — il SIMBOLO per primo: e' la prima ancora (una famiglia gia' presa non lo scavalca)
    const essenziali = lista.filter(c => c._citta.tipo === 'essenziale').sort((x, y) => (y._citta.simbolo ? 1 : 0) - (x._citta.simbolo ? 1 : 0));
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
