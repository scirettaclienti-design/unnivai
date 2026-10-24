/**
 * NAV-2 — L'ORDINE DEL PERCORSO: le tappe di un momento (mattina, pomeriggio) si camminano nell'ordine che fa meno strada.
 *
 * Il motore sceglie i posti per momento; dentro un momento l'ordine veniva dalla scelta, non dalla strada: con 12 tappe a Catania il
 * percorso tornava su sé stesso (5,9 km). Qui, come ULTIMO passo dell'ordine (dopo soste, buchi e minimi, prima dei tempi e dei
 * testi), ogni «fila» di tappe movibili dello stesso momento si prova in tutti gli ordini possibili e si tiene quello con meno
 * strada, da dove arrivi (la tappa prima della fila) a dove vai (la tappa dopo).
 *
 * ─── COSA NON SI MUOVE ───────────────────────────────────────────────────────────────────────────────────────────────
 *  · pasti, aperitivo, passeggiata, cena, dopocena: restano dove sono, con i loro orari (sono «gli orari vincolati»);
 *  · la colazione (la prima tappa di una mattina con colazione) e le soste del DNA (`source: 'dna'`, messe in un'attesa precisa);
 *  · le tappe senza coordinate.
 * Una fila è fatta di tappe consecutive dello stesso momento; un pasto la spezza.
 *
 * ─── QUANDO UN ORDINE NUOVO VALE ─────────────────────────────────────────────────────────────────────────────────────
 *  · meno strada di quello di prima (haversine, la stessa misura dei tempi di cammino del motore: `travelMinutes`);
 *  · nessun tratto più lungo del tratto più lungo di prima (il tetto di cammino non peggiora);
 *  · nessuna tappa chiusa quando ci si arriva (`openStatus`, per tutta la sosta);
 *  · la tappa dopo la fila non arriva più tardi di prima (il pranzo resta alle 12:30).
 * Funzione PURA: niente rete, niente orologio. Lavora su `sched.days` (l'uscita di `scheduleMomentPlan`) e ne rende una copia.
 */

import { travelMinutes, haversineKm, stayInMoment } from './tourTiming';
import { openStatus, CLOSED } from './openingHours';

const MOMENTI_MOVIBILI = new Set(['mattina', 'pomeriggio']);
/** Una fila più lunga di così non si prova (7! = 5040 ordini): il motore non ne fa mai così tante in un momento. */
export const FILA_MAX = 7;
const MS_MIN = 60000;
/** NAV-2 — spento solo per i confronti prima/dopo (`DV_ORDINE_PERCORSO=off`, come `DV_COLAZIONE_AUTO`) e nei test che non lo riguardano. */
export const ordinePercorsoSpento = () => !!globalThis.__ORDINE_PERCORSO_OFF__ || globalThis.process?.env?.DV_ORDINE_PERCORSO === 'off';

const pt = (e) => {
    const c = e?.candidate || e;
    const lat = Number(c?.latitude ?? c?.lat);
    const lng = Number(c?.longitude ?? c?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};
const km = (a, b) => {
    const A = pt(a), B = pt(b);
    return A && B ? haversineKm(A.lat, A.lng, B.lat, B.lng) : null;
};
const ms = (d) => (d instanceof Date ? d.getTime() : NaN);

/** I km di un percorso: la somma delle distanze fra tappe consecutive (le voci senza coordinate, come il tempo libero, non contano). */
export function kmDelPercorso(stops) {
    const v = (stops || []).filter(s => pt(s));
    let tot = 0;
    for (let i = 1; i < v.length; i++) tot += km(v[i - 1], v[i]);
    return tot;
}

/** Una tappa si puo' spostare dentro il suo momento? */
export function eMovibile(e, indice, giorno) {
    if (!e || !MOMENTI_MOVIBILI.has(e.moment?.key)) return false;
    if (e.source === 'dna') return false;
    if (!pt(e)) return false;
    // la colazione: la prima tappa di un momento che ha la colazione
    if (e.moment?.colazione && !(indice > 0 && giorno[indice - 1]?.moment === e.moment)) return false;
    return true;
}

function permutazioni(lista) {
    if (lista.length <= 1) return [lista];
    const out = [];
    lista.forEach((x, i) => {
        for (const r of permutazioni([...lista.slice(0, i), ...lista.slice(i + 1)])) out.push([x, ...r]);
    });
    return out;
}

const lunghezza = (prev, ordine, next) => {
    const legs = [];
    const catena = [prev, ...ordine, next].filter(Boolean);
    for (let i = 1; i < catena.length; i++) {
        const d = km(catena[i - 1], catena[i]);
        if (d === null) return null;
        legs.push(d);
    }
    return { legs, tot: legs.reduce((a, b) => a + b, 0) };
};

/**
 * Prova a rimettere in ordine di strada una fila. Rende null se non c'e' un ordine migliore e valido.
 * @returns {{ ordine: Array, starts: number[], waits: number[], nextWait: number, kmPrima: number, kmDopo: number }|null}
 */
function miglioraFila(prev, fila, next) {
    const prima = lunghezza(prev, fila, next);
    if (!prima) return null;
    const maxLegPrima = Math.max(...prima.legs);
    const fineP = prev ? ms(prev.start) + stayInMoment(prev.candidate, prev.moment) * MS_MIN : null;
    let migliore = null;
    for (const ordine of permutazioni(fila)) {
        if (ordine.every((e, i) => e === fila[i])) continue;
        const dopo = lunghezza(prev, ordine, next);
        if (!dopo || dopo.tot >= prima.tot - 1e-6) continue;
        if (Math.max(...dopo.legs) > maxLegPrima + 1e-9) continue;
        if (migliore && dopo.tot >= migliore.dopo.tot - 1e-9) continue;
        // i tempi: come arriva ogni tappa nel nuovo ordine. Un'attesa che il motore aveva messo prima di una posizione (aprire, inizio del momento) resta li'.
        const starts = [];
        const waits = [];
        let fine = fineP;
        let ok = true;
        ordine.forEach((e, j) => {
            if (!ok) return;
            const slot = fila[j];
            let arrivo;
            let attesa = 0;
            if (j === 0 && !prev) {
                arrivo = ms(slot.start);
                attesa = Number(slot.waitMinutesBefore) || 0;
            } else {
                const da = j === 0 ? prev : ordine[j - 1];
                const t = travelMinutes(da.candidate || da, e.candidate);
                if (t === null) { ok = false; return; }
                const catena = fine + t * MS_MIN;
                const vincolata = (Number(slot.waitMinutesBefore) || 0) > 0;
                arrivo = vincolata ? Math.max(catena, ms(slot.start)) : catena;
                attesa = Math.max(0, Math.round((arrivo - catena) / MS_MIN));
            }
            const sosta = stayInMoment(e.candidate, e.moment);
            if (openStatus(e.candidate, new Date(arrivo), sosta).stato === CLOSED) { ok = false; return; }
            starts.push(arrivo);
            waits.push(attesa);
            fine = arrivo + sosta * MS_MIN;
        });
        if (!ok) continue;
        let nextWait = 0;
        if (next) {
            const t = travelMinutes(ordine.at(-1).candidate, next.candidate);
            if (t === null) continue;
            const catenaNext = fine + t * MS_MIN;
            // la tappa dopo non arriva piu' tardi di prima: il pranzo resta alle 12:30
            if (catenaNext > ms(next.start) + 1000) continue;
            nextWait = Math.max(0, Math.round((ms(next.start) - catenaNext) / MS_MIN));
        }
        migliore = { ordine, starts, waits, nextWait, kmPrima: prima.tot, kmDopo: dopo.tot, dopo };
    }
    return migliore;
}

/**
 * Rimette in ordine di strada le tappe movibili di ogni momento.
 * @param {{ days: Array<Array<object>> }} sched   l'uscita di scheduleMomentPlan (non cambia: si rende una copia)
 * @returns {{ sched: object, report: { kmPrima: number, kmDopo: number, file: Array<{ giorno: number, momento: string, prima: string[], dopo: string[], kmPrima: number, kmDopo: number }> } }}
 */
export function riordinaPerPercorso(sched) {
    const report = { kmPrima: 0, kmDopo: 0, file: [] };
    const days = (sched?.days || []).map((day, di) => {
        const out = [...day];
        report.kmPrima += kmDelPercorso(out.map(e => e.candidate));
        let i = 0;
        while (i < out.length) {
            if (!eMovibile(out[i], i, out)) { i++; continue; }
            let j = i;
            while (j + 1 < out.length && out[j + 1].moment === out[i].moment && eMovibile(out[j + 1], j + 1, out)) j++;
            const fila = out.slice(i, j + 1);
            if (fila.length >= 2 && fila.length <= FILA_MAX) {
                const prev = i > 0 ? out[i - 1] : null;
                const next = j + 1 < out.length ? out[j + 1] : null;
                const m = miglioraFila(prev, fila, next);
                if (m) {
                    m.ordine.forEach((e, k) => {
                        out[i + k] = { ...e, start: new Date(m.starts[k]), waitMinutesBefore: m.waits[k], trace: { ...(e.trace || {}), ordine: { riordinata: true } } };
                    });
                    if (next) out[j + 1] = { ...next, waitMinutesBefore: m.nextWait };
                    report.file.push({
                        giorno: di + 1, momento: fila[0].moment.key,
                        prima: fila.map(e => e.candidate?.name || e.candidate?.title), dopo: m.ordine.map(e => e.candidate?.name || e.candidate?.title),
                        kmPrima: Number(m.kmPrima.toFixed(3)), kmDopo: Number(m.kmDopo.toFixed(3)),
                    });
                }
            }
            i = j + 1;
        }
        report.kmDopo += kmDelPercorso(out.map(e => e.candidate));
        return out;
    });
    report.kmPrima = Number(report.kmPrima.toFixed(3));
    report.kmDopo = Number(report.kmDopo.toFixed(3));
    return { sched: { ...sched, days }, report };
}
