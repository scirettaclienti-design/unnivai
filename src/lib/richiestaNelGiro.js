/**
 * BANCO-DIFETTI-2 (T23, D6) — LA RICHIESTA PRECISA SI RISPETTA, O IL GIRO DICE PERCHE' NO.
 *
 * Quando l'utente chiede una cosa precisa — un luogo per nome («tra Colosseo e Fori Imperiali», «il Mercato del Capo»), un tipo di
 * posto («cioccolato», «spa», «mercati»), un tema per tutto il giro («natura e panorami»), un pasto («pranzo»), un'ora («alle 15») —
 * il giro la contiene. Se non puo', una riga sul giorno dice quale cosa manca e il fatto che lo impedisce (chiuso a quell'ora,
 * oltre 1,2 km a piedi, non trovato), con i testi di `testiGiro.js`.
 *
 * ─── DA DOVE VIENE LA RICHIESTA ────────────────────────────────────────────────────────────────────────────────────────
 *  · Crea il tuo Percorso: la frase dell'utente (nomi propri, parole di tipo, pasti, ore).
 *  · Percorso Veloce (Quiz): la frase la scrive il wizard; contano solo i tipi PRECISI della frase «cerco: …» (spa, mercato,
 *    cioccolato), perche' la categoria scelta restringe gia' il pool (Gate RAGGIO-CATEGORIA, DNA-3b).
 *  · Sorprendimi e Per Te: nessuna richiesta precisa.
 *
 * ─── COME SI RISPETTA (rispettaRichiesta, dopo le soste del DNA, prima dell'ordine del percorso) ───────────────────────────
 *  1. un luogo o un tipo che manca: il posto giusto (dai risultati delle ricerche, anche quelli che i filtri del pool avevano tolto:
 *     quartiere, categoria, «fuori strada», merito) entra in un'attesa del giro o al posto di una visita qualunque, con le regole di
 *     `inserisciTappa.js` (tetto di 1,2 km a piedi per tratto, aperto per tutta la sosta, la tappa dopo resta in orario);
 *  2. un tema per tutto il giro (natura): ogni visita che non e' del tema si cambia con una del tema, se ce n'e' una che ci sta;
 *  3. quello che resta fuori si dice, con il motivo misurato.
 * Funzioni PURE.
 */
import { placeKind, COMMERCIAL_KINDS } from './placeKind';
import { isNaturaOPanorama } from './borgoConfini';
import { candidateFamily, isMealPlace } from '../services/momentSelection';
import { isBreakfastPlace } from './mealRules';
import { provaInserire, provaSostituire, inserisci, sostituisci, usatiNelGiro, giaUsato, kmFra, idDi, nomeNorm, fineDi as fineVoce } from './inserisciTappa';
import { travelMinutes } from './tourTiming';
import { TESTI_GIRO } from './testiGiro';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tipiDi = (c) => [...(Array.isArray(c?.types) ? c.types : []), c?.primaryType ?? c?.primary_type].filter(Boolean).map(t => String(t).toLowerCase());
const nomeDi = (c) => norm(c?.name || c?.title);
const ha = (c, set) => tipiDi(c).some(t => set.has(t));

const TIPI_TRANSITO = new Set(['subway_station', 'transit_station', 'train_station', 'bus_station', 'light_rail_station', 'tram_stop', 'bus_stop']);
/** Una fermata dei mezzi: tipo principale (o tutti i tipi non generici) da stazione. «Colosseo» la fermata non e' il Colosseo. */
export function isTransito(c) {
    const p = String(c?.primaryType ?? c?.primary_type ?? '').toLowerCase();
    if (TIPI_TRANSITO.has(p)) return true;
    const t = tipiDi(c).filter(x => !['point_of_interest', 'establishment', 'transportation_service'].includes(x));
    return t.length > 0 && t.every(x => TIPI_TRANSITO.has(x));
}

const PANORAMA = new Set(['scenic_spot', 'observation_deck', 'viewpoint']);
/**
 * Le parole di tipo che la richiesta puo' nominare. `quiz`: vale anche nella frase del Percorso Veloce (tipi precisi).
 * `tutte`: il tema vale per ogni visita del giro (non solo per una tappa).
 */
export const VOCI_TIPO = [
    { id: 'natura', re: /\b(natura|naturalistic\w*|parchi|parco|giardini|verde)\b/, etichetta: 'natura', tema: 'natura', altri: 'parchi, giardini o belvedere',
        tutte: true, ammette: (c) => isNaturaOPanorama(c) },
    { id: 'panorami', re: /\b(panoram\w*|belvedere)\b/, etichetta: 'panorami',
        ammette: (c) => !COMMERCIAL_KINDS.has(placeKind(c).kind) && (ha(c, PANORAMA) || candidateFamily(c) === 'panorama' || /\b(belvedere|panoram\w*|terrazza|punto panoramico)\b/.test(nomeDi(c))) },
    { id: 'cioccolato', re: /\bcioccolat\w*/, etichetta: 'cioccolato', quiz: true,
        ammette: (c) => ha(c, new Set(['chocolate_shop', 'chocolate_factory'])) || /\bcioccolat\w*/.test(nomeDi(c)) },
    { id: 'mercati', re: /\bmercat[oi]\b/, etichetta: 'mercati', quiz: true,
        ammette: (c) => ha(c, new Set(['market', 'farmers_market'])) || /\bmercat[oi]\b/.test(nomeDi(c)) },
    { id: 'spa', re: /\b(spa|terme|termal\w*|hammam|benessere)\b/, etichetta: 'spa e centri benessere', quiz: true,
        ammette: (c) => ha(c, new Set(['spa', 'wellness_center', 'sauna', 'public_bath', 'massage_spa', 'day_spa'])) },
    { id: 'musei', re: /\bmuse[oi]\b/, etichetta: 'musei', ammette: (c) => placeKind(c).kind === 'museo' || ha(c, new Set(['museum', 'art_museum', 'history_museum', 'art_gallery'])) },
    { id: 'chiese', re: /\b(chies[ae]|basilic[ah]e?|cattedral[ei])\b/, etichetta: 'chiese', ammette: (c) => placeKind(c).kind === 'chiesa' || ha(c, new Set(['church', 'place_of_worship'])) },
    { id: 'cucina', re: /\b(cucina|ristorant[ei]|trattori[ae]|osteri[ae]|pizzeri[ae]|street ?food)\b/, etichetta: 'cucina', ammette: (c) => isMealPlace(c) },
];
const VOCI_MOMENTO = [
    { id: 'pranzo', re: /\bpranz[oi]\b/, etichetta: 'pranzo' },
    { id: 'cena', re: /\bcen[ae]\b/, etichetta: 'cena' },
    { id: 'colazione', re: /\b(colazion[ei]|brunch)\b/, etichetta: 'colazione' },
];

// ─── I luoghi per nome ─────────────────────────────────────────────────────────────────────────────────────────────────────
const NON_LUOGO = new Set(['domani', 'oggi', 'stasera', 'stamattina', 'dopodomani', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
    'italia', 'unnivai', 'un', 'una', 'uno', 'il', 'lo', 'la', 'le', 'gli', 'i', 'giornata', 'giro', 'pomeriggio', 'mattina', 'serata', 'sera', 'pranzo', 'cena',
    'colazione', 'passeggiata', 'tour', 'voglio', 'vorrei', 'portami', 'cerco', 'escludi', 'natura', 'cioccolato', 'cucina', 'mercati', 'mercato', 'panorami', 'arte', 'storia']);
const CONNETTORI = /^(de'|de’|di|del|dei|della|delle|dello|degli|d'|d’)$/i;
const MAIUSCOLA = /^[A-ZÀ-Ý]/;

/** Le radici di una parola per il confronto («Vaticano» e «Vaticani», «Ballarò» e «Ballaro»): senza accenti e senza l'ultima vocale. */
export const radice = (w) => { const n = norm(w); return n.length > 4 ? n.replace(/[aeiou]$/, '') : n; };

/**
 * I nomi propri della frase («Pranzo e giro ai mercati di Ballarò e del Capo a Palermo» → Ballarò, Capo): sequenze di parole con la
 * maiuscola (unite da di/del/de'…), tolta la citta', i giorni e le parole comuni a inizio frase. Al massimo 4.
 */
export function nomiPropri(testo, citta = '') {
    const parole = String(testo || '').replace(/[.,;:!?()«»"]/g, ' $& ').split(/\s+/).filter(Boolean);
    const cittaN = norm(citta);
    const out = [];
    let cur = [];
    const chiudi = () => {
        while (cur.length && CONNETTORI.test(cur[cur.length - 1])) cur.pop();
        const nome = cur.join(' ');
        cur = [];
        const k = norm(nome);
        // «Polignano a Mare»: le parole della citta' non sono luoghi a parte
        const delleCitta = new Set(cittaN.split(' '));
        if (!k || k === cittaN || k.split(' ').every(w => delleCitta.has(w)) || NON_LUOGO.has(k) || out.some(x => norm(x) === k)) return;
        out.push(nome);
    };
    parole.forEach((w, i) => {
        if (MAIUSCOLA.test(w) && !NON_LUOGO.has(norm(w))) { cur.push(w); return; }
        if (cur.length && CONNETTORI.test(w) && MAIUSCOLA.test(parole[i + 1] || '')) { cur.push(w); return; }
        if (cur.length) chiudi();
    });
    if (cur.length) chiudi();
    return out.slice(0, 4);
}

/** Il posto `c` e' il luogo nominato? Ogni parola del nome chiesto (tolti i connettori) e' una parola del nome del posto. */
export function luogoCorrisponde(c, nome) {
    const chieste = norm(nome).split(' ').filter(w => w.length >= 3 && !CONNETTORI.test(w)).map(radice);
    if (!chieste.length) return false;
    const delPosto = new Set(nomeDi(c).split(' ').map(radice));
    return chieste.every(w => delPosto.has(w));
}

/** L'ora scritta («alle 15», «dalle 10:30») in minuti dalla mezzanotte, o null. */
export function oraChiesta(testo) {
    const m = norm(testo).match(/\b(?:alle|dalle|verso le|per le)\s+(\d{1,2})(?:\s+(\d{2}))?\b/);
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2] || 0);
    return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/**
 * Le cose precise chieste.
 * @param {{ testo: string, pathType?: string, citta?: string }} p
 * @returns {Array<{ tipo: 'luogo'|'tipo'|'momento'|'ora', id: string, cosa: string, voce?: object, tutte?: boolean, minuti?: number }>}
 */
export function vociDellaRichiesta({ testo = '', pathType = undefined, citta = '' } = {}) {
    const out = [];
    if (pathType === 'custom') {
        const t = norm(testo);
        // la parte negata («niente chiese») non e' una richiesta: la toglie DNA-3b, qui non conta
        const positivo = t.replace(/\b(niente|senza|tranne|eccetto|escludi|evita\w*|no)\s+[a-z ]{0,40}/g, ' ');
        for (const nome of nomiPropri(testo, citta)) out.push({ tipo: 'luogo', id: `luogo:${norm(nome)}`, cosa: nome });
        for (const v of VOCI_TIPO) if (v.re.test(positivo)) out.push({ tipo: 'tipo', id: v.id, cosa: v.etichetta, voce: v, tutte: !!v.tutte });
        for (const v of VOCI_MOMENTO) if (v.re.test(positivo)) out.push({ tipo: 'momento', id: v.id, cosa: v.etichetta });
        const ora = oraChiesta(testo);
        if (ora != null) out.push({ tipo: 'ora', id: 'ora', cosa: 'ora', minuti: ora });
    } else if (pathType === 'quick') {
        // il wizard: solo la frase «cerco: …» (prima di «Escludi») e solo i tipi precisi
        const cerco = norm(String(testo || '').split(/escludi/i)[0]);
        for (const v of VOCI_TIPO) if (v.quiz && v.re.test(cerco)) out.push({ tipo: 'tipo', id: v.id, cosa: v.etichetta, voce: v, tutte: false });
    }
    // «Natura e panorami»: i panorami sono natura per il tema di tutto il giro
    return out;
}

/** Le attese di un giorno rifatte dagli orari (dopo una tappa tolta): fine della voce prima + cammino → inizio. */
function rifaiAttese(day) {
    return day.map((e, i) => (i === 0 ? e : { ...e, waitMinutesBefore: Math.max(0, Math.ceil((e.start.getTime() - fineVoce(day[i - 1]) - (travelMinutes(day[i - 1].candidate, e.candidate) ?? 0) * 60000) / 60000)) }));
}

const VISITA = new Set(['mattina', 'pomeriggio']);
const COMMERCIALI = new Set(['bar', 'caffe', 'dolce', 'forno', 'spuntino', 'pasto']);
/** Una visita del giro: una tappa di mattina o pomeriggio che non e' un pasto, un caffe' o un dolce, ne' una sosta del DNA. */
export const eVisita = (e) => VISITA.has(e?.moment?.key) && e?.source !== 'dna' && !isMealPlace(e.candidate) && !COMMERCIALI.has(placeKind(e.candidate).kind);

/** La voce e' gia' nel giro? `quartiere`: il nome del quartiere che il motore ha scelto perche' nominato nella richiesta. */
export function voceNelGiro(v, days, { quartiere = null, minutiPrimaTappa = null } = {}) {
    const tutte = days.flat();
    if (v.tipo === 'luogo') {
        if (quartiere && luogoCorrisponde({ name: quartiere }, v.cosa)) return true;
        return tutte.some(e => !isTransito(e.candidate) && luogoCorrisponde(e.candidate, v.cosa));
    }
    if (v.tipo === 'tipo') {
        if (!v.tutte) return tutte.some(e => v.voce.ammette(e.candidate));
        const visite = tutte.filter(eVisita);
        return visite.length > 0 && visite.every(e => v.voce.ammette(e.candidate) || isNaturaOPanorama(e.candidate));
    }
    if (v.tipo === 'momento') {
        if (v.id === 'colazione') return days.some(d => d[0] && isBreakfastPlace(d[0].candidate));
        return tutte.some(e => e.moment?.key === v.id);
    }
    if (v.tipo === 'ora') return minutiPrimaTappa == null || (minutiPrimaTappa >= v.minuti && minutiPrimaTappa <= v.minuti + 30);
    return true;
}

/**
 * Rispetta la richiesta su un giro gia' in orario.
 * @param {object} p
 * @param {{ days: object[][] }} p.sched
 * @param {Array} p.voci                       vociDellaRichiesta(...)
 * @param {Array} p.candidati                  i posti trovati dalle ricerche e dalla lista (verificati), anche fuori dal pool
 * @param {number|null} p.capKm                il tetto a piedi per tratto (null = nessun tetto: ritmo Intenso con i mezzi → 5 km)
 * @param {(c, arrivo:Date, sosta:number) => boolean} p.aperto
 * @param {(di:number) => object[]} p.momentiDi  i momenti dello scheletro del giorno
 * @param {(di:number) => Date|null} p.fineDi    la fine della finestra del giorno
 * @param {string} p.citta
 * @param {string|null} [p.quartiere]           il quartiere scelto perche' nominato
 * @param {(c:object) => boolean} [p.ammesso]   un filtro in piu' (esclusioni, soglia di qualita')
 * @param {(when:Date) => number} [p.minutiDi]  l'ora locale in minuti (per la riga dell'ora)
 * @returns {{ sched: object, note: string[], report: Array }}
 */
export function rispettaRichiesta({ sched, voci, candidati = [], capKm = null, aperto, momentiDi = () => [], fineDi = () => null, citta = '', quartiere = null, ammesso = () => true, minutiDi = () => null }) {
    let days = (sched?.days || []).map(d => [...d]);
    const note = [];
    const report = [];
    if (!Array.isArray(voci) || voci.length === 0) return { sched, note, report };
    const cap = Number.isFinite(capKm) ? capKm : null;
    const usati = usatiNelGiro({ days });
    // il nome di una fermata dei mezzi («Colosseo») non toglie il posto vero con lo stesso nome
    for (const e of days.flat()) if (isTransito(e.candidate)) usati.delete(nomeNorm(e.candidate));
    const voceDi = (e) => voci.some(v => (v.tipo === 'luogo' && luogoCorrisponde(e.candidate, v.cosa) && !isTransito(e.candidate)) || (v.tipo === 'tipo' && !v.tutte && v.voce.ammette(e.candidate)));
    const primaTappa = () => { const p = days.find(d => d.length)?.[0]; return p ? minutiDi(p.start) : null; };
    const opzioni = { capKm: cap, aperto };

    // un candidato per una voce: prima i piu' conosciuti (recensioni), mai una fermata per un luogo, mai un posto gia' nel giro
    const candidatiPer = (v) => candidati
        .filter(c => idDi(c) && !giaUsato(usati, c) && ammesso(c))
        .filter(c => (v.tipo === 'luogo' ? (!isTransito(c) && luogoCorrisponde(c, v.cosa)) : v.voce.ammette(c)))
        .sort((x, y) => (Number(y.user_ratings_total ?? y.userRatingsTotal) || 0) - (Number(x.user_ratings_total ?? x.userRatingsTotal) || 0) || (Number(y.rating) || 0) - (Number(x.rating) || 0))
        .slice(0, 8);

    // dove mettere `c`: in un'attesa (anche in coda), o al posto di una visita che non risponde alla richiesta (prima una fermata dei mezzi)
    const prova = (c, { sostituibile, voce }) => {
        const tentativi = [];
        let migliore = null;
        // un luogo chiesto per nome che nel giro e' solo la fermata dei mezzi col suo nome («Colosseo»): il posto vero prende il suo posto
        if (voce?.tipo === 'luogo') {
            days.forEach((day, di) => day.forEach((x, j) => {
                if (migliore || !isTransito(x.candidate) || !luogoCorrisponde(x.candidate, voce.cosa)) return;
                const e = provaSostituire(day, j, c, { ...opzioni, fineFinestra: fineDi(di) });
                tentativi.push(e);
                if (e.ok) migliore = { modo: 'sostituita', di, j, esito: e, rango: 0, tolta: x.candidate?.name || x.candidate?.title || null };
            }));
            if (migliore) return { migliore, tentativi };
        }
        days.forEach((day, di) => {
            for (let i = 1; i <= day.length; i++) {
                const e = provaInserire(day, i, c, { ...opzioni, momenti: momentiDi(di), fineFinestra: fineDi(di) });
                tentativi.push(e);
                if (!e.ok) continue;
                const a = day[i - 1].candidate, b = day[i]?.candidate;
                const extra = (kmFra(a, c) ?? 0) + (b ? (kmFra(c, b) ?? 0) - (kmFra(a, b) ?? 0) : 0);
                if (!migliore || extra < migliore.extra) migliore = { modo: 'inserita', di, i, esito: e, extra };
            }
        });
        if (migliore) return { migliore, tentativi };
        days.forEach((day, di) => {
            day.forEach((x, j) => {
                if (!sostituibile(x, j, day)) return;
                const e = provaSostituire(day, j, c, { ...opzioni, fineFinestra: fineDi(di) });
                tentativi.push(e);
                if (!e.ok) return;
                const rango = isTransito(x.candidate) ? 0 : (x.candidate?._citta?.ancora ? 2 : 1);
                if (!migliore || rango < migliore.rango) migliore = { modo: 'sostituita', di, j, esito: e, rango, tolta: x.candidate?.name || x.candidate?.title || null };
            });
        });
        return { migliore, tentativi };
    };
    const applica = (c, m, trace) => {
        const day = days[m.di];
        days[m.di] = m.modo === 'inserita' ? inserisci(day, m.i, c, m.esito, { source: 'richiesta', trace }) : sostituisci(day, m.j, c, m.esito, { source: 'richiesta', trace });
        usati.add(idDi(c));
    };
    // perche' non entra: il motivo del primo candidato (il piu' conosciuto)
    const perche = (tentativi) => {
        const vicini = tentativi.filter(t => !t.ok && t.perche !== 'lontano' && t.perche !== 'posizione');
        if (vicini.length) return vicini.some(t => t.perche === 'tempo') ? 'nonEntra' : 'chiuso';
        const km = Math.min(...tentativi.filter(t => t.perche === 'lontano').map(t => t.km), Infinity);
        return Number.isFinite(km) ? { lontano: km } : 'nonEntra';
    };

    for (const v of voci) {
        if (v.tipo === 'luogo' || (v.tipo === 'tipo' && !v.tutte)) {
            if (voceNelGiro(v, days, { quartiere })) { report.push({ voce: v.id, esito: 'nel giro' }); continue; }
            const cands = candidatiPer(v);
            if (!cands.length) {
                note.push(TESTI_GIRO.richiesta.nonTrovato({ cosa: v.cosa, citta, luogo: v.tipo === 'luogo' }));
                report.push({ voce: v.id, esito: 'non trovato' });
                continue;
            }
            // sostituibile: una visita che non e' gia' una risposta alla richiesta; la fermata dei mezzi che porta il nome chiesto per prima
            const sostituibile = (x) => eVisita(x) && x.source !== 'richiesta' && !voceDi(x);
            let fatto = null;
            let motivo = null;
            for (const c of cands) {
                const { migliore, tentativi } = prova(c, { sostituibile, voce: v });
                if (migliore) { fatto = { c, m: migliore }; break; }
                if (!motivo) motivo = { c, m: perche(tentativi) };
            }
            if (fatto) {
                applica(fatto.c, fatto.m, { richiesta: { voce: v.id, cosa: v.cosa, modo: fatto.m.modo, ...(fatto.m.tolta ? { alPostoDi: fatto.m.tolta } : {}) } });
                // il posto vero c'e': la fermata dei mezzi col suo nome non e' una tappa (D8) e lascia il giro
                if (v.tipo === 'luogo') days = days.map(d => rifaiAttese(d.filter(e => !(isTransito(e.candidate) && luogoCorrisponde(e.candidate, v.cosa)))));
                report.push({ voce: v.id, esito: fatto.m.modo, place_id: idDi(fatto.c), nome: fatto.c.name || fatto.c.title, ...(fatto.m.tolta ? { alPostoDi: fatto.m.tolta } : {}) });
                continue;
            }
            const posto = v.tipo === 'luogo' ? (motivo.c.name || motivo.c.title) : null;
            if (motivo.m === 'chiuso') note.push(TESTI_GIRO.richiesta.chiuso({ cosa: v.tipo === 'luogo' ? `${v.cosa} (${posto})` : v.cosa, citta, uno: v.tipo === 'luogo' }));
            else if (motivo.m?.lontano) note.push(TESTI_GIRO.richiesta.lontano({ cosa: v.cosa, posto, km: motivo.m.lontano, capKm: cap ?? 5 }));
            else note.push(TESTI_GIRO.richiesta.nonEntra({ cosa: v.cosa, posto }));
            report.push({ voce: v.id, esito: 'dichiarato', motivo: motivo.m?.lontano ? 'lontano' : motivo.m, candidato: motivo.c.name || motivo.c.title });
        } else if (v.tipo === 'tipo' && v.tutte) {
            // un tema per tutto il giro: ogni visita che non e' del tema si cambia con una del tema che ci sta
            let fuori = 0, totale = 0, cambiate = 0;
            days = days.map((day, di) => {
                let d = day;
                for (let j = 0; j < d.length; j++) {
                    const x = d[j];
                    if (!eVisita(x)) continue;
                    totale++;
                    if (v.voce.ammette(x.candidate) || isNaturaOPanorama(x.candidate)) continue;
                    const cands = candidatiPer(v);
                    let ok = false;
                    for (const c of cands) {
                        const e = provaSostituire(d, j, c, { ...opzioni, fineFinestra: fineDi(di) });
                        if (!e.ok) continue;
                        d = sostituisci(d, j, c, e, { source: 'richiesta', trace: { richiesta: { voce: v.id, modo: 'tema', alPostoDi: x.candidate?.name || x.candidate?.title || null } } });
                        usati.add(idDi(c));
                        ok = true; cambiate++;
                        break;
                    }
                    if (!ok) fuori++;
                }
                return d;
            });
            if (fuori > 0) note.push(TESTI_GIRO.richiesta.nonDelTema({ n: fuori, totale, tema: v.voce.tema, altri: v.voce.altri, capKm: cap ?? 5 }));
            report.push({ voce: v.id, esito: fuori ? 'dichiarato' : (cambiate ? 'cambiate' : 'nel giro'), fuori, cambiate, totale });
        } else if (v.tipo === 'ora') {
            const vera = primaTappa();
            if (!voceNelGiro(v, days, { minutiPrimaTappa: vera })) { note.push(TESTI_GIRO.richiesta.ora({ chiesta: v.minuti, vera })); report.push({ voce: v.id, esito: 'dichiarato' }); }
            else report.push({ voce: v.id, esito: 'nel giro' });
        } else if (v.tipo === 'momento') {
            // il pasto chiesto lo mette lo scheletro; se manca, la riga del pasto («Nessun locale aperto qui vicino a quest'ora.») c'e' gia'
            report.push({ voce: v.id, esito: voceNelGiro(v, days) ? 'nel giro' : 'riga del pasto' });
        }
    }
    return { sched: { ...sched, days }, note, report };
}
