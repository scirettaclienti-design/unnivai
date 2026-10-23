/**
 * DNA-3b — LE SOSTE DEL DNA: il DNA non riordina soltanto, cambia com'e' fatto il giro.
 *
 * Negli SPAZI LIBERI di mattina e pomeriggio (l'attesa che resta fra una tappa e la successiva, prima del pranzo o del
 * pomeriggio) un utente con un DNA forte trova 1–2 soste brevi (15–30 minuti) della sua passione. Funzione PURA: niente rete,
 * niente orologio; i posti sono quelli gia' trovati e verificati dal motore (il pool), l'orario e' quello di Google.
 *
 * ─── LA REGOLA, IN PAROLE SEMPLICI ──────────────────────────────────────────────────────────────────────────────────────────
 *  1. Quante: dalla fiducia del DNA (fasciaDna.gradinoFiducia) — 0: nessuna · poca: al massimo 1 · media: 1 · alta: al massimo 2.
 *  2. Di cosa: le 2 categorie piu' forti del DNA (peso da 0,20) che hanno una corrispondenza qui sotto; con 2 soste, una per categoria.
 *  3. Dove: solo in un'attesa vera, dopo una tappa di mattina o di pomeriggio, e solo se la sosta + il cammino ci stanno senza far
 *     slittare la tappa dopo; la deviazione dal percorso (andata + ritorno - tragitto diretto) e' al massimo 300 m.
 *  4. Posto vero: dal pool del motore (gia' verificato e dentro la soglia di qualita'), aperto per tutta la sosta all'ora di arrivo
 *     (per i parchi e i belvedere senza orario Google si accetta «sconosciuto»), mai un posto gia' nel giro.
 *  5. La richiesta vince (DNA-3): nessuna sosta se l'utente ha chiesto categorie precise o un posto per nome, se il giro e' di una
 *     sola categoria, o se la categoria (o il tipo del posto) e' esclusa. La natura mai al buio e mai «da fuori» (regola del buio).
 *  Le soste non contano nel tetto delle visite: sono 15–30 minuti dentro un'attesa che c'era gia'.
 */
import { gradinoFiducia } from './fasciaDna';
import { placeKind } from './placeKind';
import { openStatus, OPEN, UNKNOWN, romeMinutes } from './openingHours';
import { travelMinutes, haversineKm, stayOf, stayInMoment } from './tourTiming';
import { statoCandidato, categoriaEsclusa, haCategoriePrecise, luogoNominato } from './richiestaEsplicita';

export const SOSTA_MIN_MINUTI = 15;
export const SOSTA_MAX_MINUTI = 30;
export const DEVIAZIONE_MAX_KM = 0.3;
const SOGLIA_CATEGORIA_FORTE = 0.2;
const DOLCE_DALLE = 14 * 60 + 30;
const MOMENTI_AMMESSI = new Set(['mattina', 'pomeriggio']);

const lower = (t) => String(t || '').toLowerCase();
const tipiDi = (c) => (Array.isArray(c?.types) ? c.types : []).map(lower);
const nomeDi = (c) => lower(c?.name || c?.title);
const idDi = (c) => c?.place_id || c?.googlePlaceId || null;
const nomeNorm = (c) => nomeDi(c).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const kindDi = (c) => placeKind(c).kind;

/**
 * Le corrispondenze categoria del DNA → tipo di sosta. `ammette(c, minutiDelGiorno)` dice se il posto e' di quel tipo.
 *  food    → caffe' (anche storico), forno/pasticceria, gelateria/dolce (dalle 14:30), street food/spuntino: MAI un pasto seduto.
 *  natura  → belvedere, giardino, parco.
 *  cultura → libreria, bottega storica (negozio con «bottega», «antica», «storica», «antiquari…» nel nome).
 * Arte, vita notturna, avventura, shopping, relax: nessuna sosta (non c'e' un posto da 15–30 minuti che le rappresenti bene).
 */
export const CORRISPONDENZE = {
    food: {
        etichetta: 'caffè, pasticceria, gelateria, street food',
        ammette: (c, minuti) => {
            const k = kindDi(c);
            if (k === 'dolce') return minuti >= DOLCE_DALLE;
            // un «bar» di giorno con tipo caffe' o forno fra i tipi e' un caffe' (i cocktail bar restano all'aperitivo)
            if (k === 'bar') return tipiDi(c).some(t => t === 'cafe' || t === 'coffee_shop' || t === 'bakery') && !tipiDi(c).includes('cocktail_bar');
            return k === 'caffe' || k === 'forno' || k === 'spuntino';
        },
    },
    natura: {
        etichetta: 'belvedere, giardino, parco',
        ammette: (c) => kindDi(c) === 'verde' || tipiDi(c).includes('viewpoint') || tipiDi(c).includes('observation_deck') || /\b(belvedere|giardin\w*|villa comunale|parco)\b/.test(nomeDi(c)),
    },
    cultura: {
        etichetta: 'libreria, bottega storica',
        ammette: (c) => tipiDi(c).includes('book_store') || tipiDi(c).includes('library')
            || (kindDi(c) === 'negozio' && /\b(libreria|bottega|botteghe|antica|antico|storica|storico|antiquari\w*)\b/.test(nomeDi(c))),
    },
};

/** Quante soste: 0 / 1 / 1 / 2 secondo il gradino di fiducia (0, poca, media, alta). */
export const numeroSoste = (share) => {
    const g = gradinoFiducia(share);
    return g === 0 ? 0 : (g === 3 ? 2 : 1);
};

/** Le categorie delle soste, dalla piu' forte: tra le 2 piu' forti del DNA (peso da 0,20), quelle che hanno una corrispondenza. */
export function categorieDelleSoste(dnaWeights) {
    const forti = Object.keys(dnaWeights || {})
        .filter(k => !k.startsWith('_') && Number(dnaWeights[k]) >= SOGLIA_CATEGORIA_FORTE)
        .sort((a, b) => Number(dnaWeights[b]) - Number(dnaWeights[a]) || a.localeCompare(b))
        .slice(0, 2);
    return forti.filter(k => CORRISPONDENZE[k]);
}

/** Perche' NON si aggiungono soste (null = si possono aggiungere). */
export function motivoNessunaSosta({ dnaWeights, richiesta, categoriaTarget = null, pool = [] }) {
    if (numeroSoste(dnaWeights?._share) === 0) return 'fiducia del DNA 0';
    if (categoriaTarget) return 'il giro e\' di una sola categoria chiesta';
    if (haCategoriePrecise(richiesta)) return 'la richiesta ha categorie precise';
    if (richiesta?.testoNomi && pool.some(c => luogoNominato(c, richiesta.testoNomi))) return 'la richiesta nomina un posto';
    const cats = categorieDelleSoste(dnaWeights).filter(cat => !categoriaEsclusa(richiesta, cat));
    if (cats.length === 0) return 'nessuna categoria forte con una sosta, o categoria esclusa';
    return null;
}

const ms = (d) => (d instanceof Date ? d.getTime() : NaN);

/**
 * Prova a mettere `c` fra `a` e `b` (tappe consecutive del giorno, gia' in orario). null se non ci sta.
 * @returns {{ start:number, end:number, stay:number, deviazioneM:number, attesaB:number, camminoMin:number }|null}
 */
export function sistemazione(a, c, b) {
    const stayC = stayOf(c);
    if (!(stayC >= SOSTA_MIN_MINUTI && stayC <= SOSTA_MAX_MINUTI)) return null;
    const tAC = travelMinutes(a.candidate, c);
    const tCB = travelMinutes(c, b.candidate);
    if (tAC === null || tCB === null) return null;
    const A = a.candidate, B = b.candidate;
    const pt = (x) => [x.latitude ?? x.lat, x.longitude ?? x.lng];
    const d = (x, y) => haversineKm(...pt(x), ...pt(y));
    const deviazioneKm = d(A, c) + d(c, B) - d(A, B);
    if (!(deviazioneKm <= DEVIAZIONE_MAX_KM)) return null;
    const fineA = ms(a.start) + stayInMoment(A, a.moment) * 60000;
    const start = fineA + tAC * 60000;
    const end = start + stayC * 60000;
    const arrivoB = end + tCB * 60000;
    // la tappa dopo non deve slittare, e la sosta comincia dentro il momento di `a`
    if (!(arrivoB <= ms(b.start)) || !(start < ms(a.moment.end))) return null;
    return { start, end, stay: stayC, deviazioneM: Math.max(0, Math.round(deviazioneKm * 1000)), attesaB: Math.ceil((ms(b.start) - arrivoB) / 60000), camminoMin: tAC + tCB };
}

/**
 * Aggiunge le soste del DNA a un giro gia' messo in orario.
 * @param {object} p
 * @param {{ days: Array<Array<object>> }} p.sched   l'uscita di scheduleMomentPlan (non cambia: se ne restituisce una copia)
 * @param {object[]} p.pool                          i candidati del motore (verificati)
 * @param {object} p.dnaWeights                      pesi del DNA con `_share`
 * @param {object} p.richiesta                       richiestaEsplicita(...)
 * @param {string|null} [p.categoriaTarget]          categoria resa vincolante dal motore (Gate RAGGIO-CATEGORIA)
 * @param {(c:object)=>boolean} [p.passaQualita]     la soglia di qualita' del motore
 * @param {(when:Date, dayIndex:number)=>boolean} [p.alBuio]  la regola del buio (eBuio)
 * @param {(c:object)=>boolean} [p.daFuori]          la natura «da fuori» (isNaturaDaFuori)
 * @param {(c:object)=>Set<string>} [p.categorieDi]  categorie di base di un candidato
 */
export function aggiungiSosteDna({ sched, pool, dnaWeights, richiesta, categoriaTarget = null, passaQualita = () => true, alBuio = () => false, daFuori = () => false, categorieDi = () => new Set(), gia = [] }) {
    // `gia`: le soste gia' messe ({ giorno, categoria }, secondo passaggio dopo la ricerca mirata): si completa il numero, non si rifa'
    const report = { aggiunte: [], motivo: null, numero: numeroSoste(dnaWeights?._share), categorie: [] };
    const motivo = motivoNessunaSosta({ dnaWeights, richiesta, categoriaTarget, pool });
    if (motivo) return { sched, report: { ...report, motivo } };
    const cats = categorieDelleSoste(dnaWeights).filter(cat => !categoriaEsclusa(richiesta, cat));
    report.categorie = cats;
    const days = (sched?.days || []).map(d => [...d]);
    const usati = new Set(days.flat().flatMap(s => [idDi(s.candidate), nomeNorm(s.candidate)]).filter(Boolean));

    days.forEach((day, di) => {
        // l'ordine delle categorie per le soste del giorno: con 2 soste una per categoria; con una sola categoria, due della stessa
        const ordine = Array.from({ length: report.numero }, (_, k) => cats[k % cats.length]);
        for (const g of gia.filter(x => x.giorno === di + 1)) { const k = ordine.indexOf(g.categoria); if (k >= 0) ordine.splice(k, 1); }
        for (const cat of ordine) {
            const provate = [cat, ...cats.filter(x => x !== cat)];
            let fatta = false;
            for (const categoria of provate) {
                const opzioni = [];
                for (let i = 0; i < day.length - 1; i++) {
                    const a = day[i], b = day[i + 1];
                    if (!MOMENTI_AMMESSI.has(a.moment?.key) || a.moment?.key === 'passeggiata' || b.moment?.key === 'passeggiata') continue;
                    if (!(a.start instanceof Date) || !(b.start instanceof Date)) continue;
                    for (const c of pool) {
                        const id = idDi(c);
                        if (!id || usati.has(id) || usati.has(nomeNorm(c))) continue;
                        if (!passaQualita(c)) continue;
                        if (statoCandidato(c, richiesta, categorieDi) === 'escluso') continue;
                        const sis = sistemazione(a, c, b);
                        if (!sis) continue;
                        if (!CORRISPONDENZE[categoria].ammette(c, romeMinutes(new Date(sis.start)))) continue;
                        if (categoria === 'natura' && (alBuio(new Date(sis.start), di) || alBuio(new Date(sis.end), di) || daFuori(c))) continue;
                        const stato = openStatus(c, new Date(sis.start), sis.stay).stato;
                        if (!(stato === OPEN || (categoria === 'natura' && stato === UNKNOWN))) continue;
                        opzioni.push({ i, c, sis, categoria, stato, voto: Number(c.rating) || 0 });
                    }
                }
                if (opzioni.length === 0) continue;
                // il posto migliore: voto piu' alto, poi la deviazione piu' corta
                opzioni.sort((x, y) => y.voto - x.voto || x.sis.deviazioneM - y.sis.deviazioneM);
                const { i, c, sis } = opzioni[0];
                const a = day[i], b = day[i + 1];
                const nuova = {
                    candidate: c, narration: null, source: 'dna', moment: a.moment, start: new Date(sis.start), waitMinutesBefore: 0,
                    trace: { dna: { sosta: true, categoria, minuti: sis.stay, deviazioneM: sis.deviazioneM, dopo: a.candidate?.name || a.candidate?.title || null } },
                };
                day.splice(i + 1, 1, nuova, { ...b, waitMinutesBefore: sis.attesaB });
                usati.add(idDi(c)); usati.add(nomeNorm(c));
                report.aggiunte.push({ giorno: di + 1, categoria, place_id: idDi(c), nome: c.name || c.title, momento: a.moment?.key, minuti: sis.stay, deviazioneM: sis.deviazioneM, orario: opzioni[0].stato === OPEN ? 'noto' : 'sconosciuto' });
                fatta = true;
                break;
            }
            if (!fatta) report.motivoParziale = 'nessun posto che ci stia negli spazi liberi';
        }
    });
    return { sched: { ...sched, days }, report };
}

// ─── DNA-3c — LA RICERCA MIRATA DELLA SOSTA ─────────────────────────────────────────────────────────────────────────────────────
// Nelle citta' la lista e il pool spesso non hanno il caffe', il giardino o la libreria sulla strada. Allora, e solo allora, UNA ricerca
// vicino allo spazio libero (due con fiducia alta), dal proxy dei posti di sempre:
//   · solo con fiducia DNA media o alta (gradino 2 o 3: la poca non spende);
//   · solo se c'e' uno spazio libero di almeno 20 minuti (l'attesa prima della tappa dopo, in un momento di mattina o pomeriggio);
//   · solo se nel pool non c'e' un candidato adatto: e' il primo passaggio (`aggiungiSosteDna` sul pool) a decidere, la ricerca serve
//     alle soste che il primo passaggio non ha potuto mettere;
//   · centrata sul punto di mezzo fra la tappa prima e la tappa dopo, raggio 300 m (`RAGGIO_RICERCA_M`); il posto trovato passa poi per
//     tutto il resto della regola (soglia di qualita', aperto all'arrivo, deviazione, richiesta, esclusioni, buio).
// Costo: 1 ricerca di testo (0,032 $, listino del banco) con fiducia media, al massimo 2 (0,064 $) con fiducia alta; 0 $ se la ricerca e' gia'
// nella cache (24 ore, per citta', ricerca e punto arrotondato a 3 decimali: ~100 m) o se il pool basta.
export const LIBERO_MIN_RICERCA_MINUTI = 20;
export const RAGGIO_RICERCA_M = 300;
export const RICERCA_PER_CATEGORIA = {
    food: { query: 'caffè storico pasticceria gelateria', kind: 'FOOD' },
    natura: { query: 'belvedere giardino parco', kind: 'NATURA' },
    cultura: { query: 'libreria bottega storica', kind: 'CULTURA' },
};

/** Gli spazi liberi del giro: le attese di almeno `minimo` minuti prima di una tappa, dopo una tappa di mattina o pomeriggio. */
export function spaziLiberi(sched, minimo = LIBERO_MIN_RICERCA_MINUTI) {
    const out = [];
    (sched?.days || []).forEach((day, di) => {
        for (let i = 0; i < day.length - 1; i++) {
            const a = day[i], b = day[i + 1];
            if (!MOMENTI_AMMESSI.has(a.moment?.key) || a.moment?.key === 'passeggiata' || b.moment?.key === 'passeggiata') continue;
            if (!(a.start instanceof Date) || !(b.start instanceof Date)) continue;
            const libero = Number(b.waitMinutesBefore) || 0;
            const pa = [a.candidate?.latitude ?? a.candidate?.lat, a.candidate?.longitude ?? a.candidate?.lng];
            const pb = [b.candidate?.latitude ?? b.candidate?.lat, b.candidate?.longitude ?? b.candidate?.lng];
            if (libero < minimo || ![...pa, ...pb].every(Number.isFinite)) continue;
            out.push({ giorno: di + 1, i, libero, punto: { latitude: (pa[0] + pb[0]) / 2, longitude: (pa[1] + pb[1]) / 2 }, dopo: a.candidate?.name || a.candidate?.title || null });
        }
    });
    return out.sort((x, y) => y.libero - x.libero);
}

/**
 * Le ricerche da fare per le soste che il pool non ha potuto dare. `sched` e' il giro DOPO il primo passaggio, `primo` il suo report.
 * @returns {{ ricerche: Array<{categoria, query, kind, punto, raggioM, libero, giorno, dopo}>, motivo: string|null }}
 */
export function ricercheDellaSosta({ sched, dnaWeights, richiesta, categoriaTarget = null, primo, pool = [], giaCercate = [] }) {
    if (primo?.motivo) return { ricerche: [], motivo: primo.motivo };
    const g = gradinoFiducia(dnaWeights?._share);
    if (g < 2) return { ricerche: [], motivo: 'fiducia del DNA poca: nessuna ricerca' };
    const mancanti = (primo?.numero || 0) - (primo?.aggiunte?.length || 0);
    if (mancanti <= 0) return { ricerche: [], motivo: 'le soste sono gia\' tutte al loro posto' };
    if (motivoNessunaSosta({ dnaWeights, richiesta, categoriaTarget, pool })) return { ricerche: [], motivo: 'la richiesta non lascia soste' };
    const spazi = spaziLiberi(sched);
    if (spazi.length === 0) return { ricerche: [], motivo: 'nessuno spazio libero di almeno 20 minuti' };
    const cats = (primo?.categorie || []);
    // le categorie che mancano: l'ordine voluto meno quelle gia' messe
    const volute = Array.from({ length: primo.numero }, (_, k) => cats[k % cats.length]);
    for (const x of primo.aggiunte) { const k = volute.indexOf(x.categoria); if (k >= 0) volute.splice(k, 1); }
    const massimo = (g === 3 ? 2 : 1) - giaCercate.length;
    if (massimo <= 0) return { ricerche: [], motivo: 'il tetto di ricerche del giro e\' raggiunto' };
    const ricerche = [];
    const usati = new Set();
    for (const categoria of volute) {
        if (ricerche.length >= Math.min(massimo, mancanti)) break;
        const spazio = spazi.find(x => !usati.has(`${categoria}|${x.giorno}:${x.i}`) && ![...giaCercate, ...ricerche].some(r => r.giorno === x.giorno && r.categoria === categoria && r.dopo === x.dopo));
        if (!spazio) continue; // la stessa ricerca (stessa categoria, stesso spazio) non si fa due volte
        usati.add(`${categoria}|${spazio.giorno}:${spazio.i}`);
        const q = RICERCA_PER_CATEGORIA[categoria];
        ricerche.push({ categoria, query: q.query, kind: q.kind, punto: spazio.punto, raggioM: RAGGIO_RICERCA_M, libero: spazio.libero, giorno: spazio.giorno, dopo: spazio.dopo });
    }
    return { ricerche, motivo: ricerche.length ? null : 'nessuna categoria da cercare' };
}
