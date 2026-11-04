/**
 * BANCO-DIFETTI-2 (T23) — METTERE UNA TAPPA IN UN GIRO GIA' IN ORARIO, senza spostare le altre.
 *
 * Lo usano la richiesta rispettata (D6: il luogo o il tipo di posto chiesto) e i buchi riempiti (D7: un'attesa di oltre 2 ore).
 * Lavora sull'uscita di `scheduleMomentPlan` ({ days: [[{ candidate, moment, start, waitMinutesBefore, source, trace }]] }).
 *
 * ─── LE REGOLE, IN PAROLE SEMPLICI ──────────────────────────────────────────────────────────────────────────────────────
 *  · la tappa nuova arriva alla fine della tappa prima + il cammino; le tappe dopo restano ai loro orari (si accorcia l'attesa);
 *  · a piedi ogni tratto (prima → nuova, nuova → dopo) sta nel tetto (1,2 km, `capKm`: il tetto non si tocca);
 *  · e' aperta per tutta la sosta all'ora d'arrivo (`aperto`, gli orari di Google);
 *  · in coda al giro solo se la sosta finisce entro la fine della finestra del giorno.
 * Funzioni PURE: niente rete, niente orologio.
 */
import { travelMinutes, haversineKm, stayInMoment } from './tourTiming';

const ms = (d) => (d instanceof Date ? d.getTime() : NaN);
const pt = (c) => {
    const lat = Number(c?.latitude ?? c?.lat), lng = Number(c?.longitude ?? c?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};
export const kmFra = (a, b) => {
    const A = pt(a), B = pt(b);
    return A && B ? haversineKm(A[0], A[1], B[0], B[1]) : null;
};
export const idDi = (c) => c?.place_id || c?.googlePlaceId || null;
export const nomeNorm = (c) => String(c?.name || c?.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** La fine della sosta di una voce del piano (ms). */
export const fineDi = (e) => ms(e.start) + stayInMoment(e.candidate, e.moment) * 60000;

/** Gli id e i nomi gia' nel giro (lo stesso posto in due schede di Google conta come uno: C10c-piena-2). */
export function usatiNelGiro(sched) {
    const s = new Set();
    for (const e of (sched?.days || []).flat()) { const id = idDi(e.candidate); if (id) s.add(id); const n = nomeNorm(e.candidate); if (n) s.add(n); }
    return s;
}
export const giaUsato = (usati, c) => usati.has(idDi(c)) || usati.has(nomeNorm(c));

/**
 * Il momento a cui appartiene una tappa nuova che arriva a `arrivo`: il momento di visita (mattina, pomeriggio) che contiene l'arrivo,
 * altrimenti quello della tappa prima o dopo se sono di visita, altrimenti il momento di visita del giorno piu' vicino all'arrivo.
 */
const VISITA = new Set(['mattina', 'pomeriggio']);
export function momentoDiVisita(arrivo, a, b, momentiDelGiorno = []) {
    const dentro = momentiDelGiorno.find(m => VISITA.has(m.key) && ms(m.start) <= arrivo && arrivo < ms(m.end));
    if (dentro) return dentro;
    if (VISITA.has(a?.moment?.key)) return a.moment;
    if (VISITA.has(b?.moment?.key)) return b.moment;
    const visite = momentiDelGiorno.filter(m => VISITA.has(m.key));
    if (!visite.length) return a?.moment || b?.moment || null;
    const dist = (m) => Math.min(Math.abs(ms(m.start) - arrivo), Math.abs(ms(m.end) - arrivo));
    return visite.slice().sort((x, y) => dist(x) - dist(y))[0];
}

/**
 * Prova a mettere `c` fra la voce `i-1` e la voce `i` del giorno (in coda se `i === day.length`).
 * @param {object[]} day
 * @param {number} i
 * @param {object} c il candidato
 * @param {{ capKm: number|null, aperto: (c, arrivo:Date, sosta:number) => boolean, momenti?: object[], fineFinestra?: Date|null, momento?: object|null }} o
 * @returns {{ ok: true, arrivo:number, sosta:number, moment:object, attesaDopo:number|null }|{ ok: false, perche: 'lontano'|'tempo'|'chiuso'|'posizione', km?: number }}
 */
export function provaInserire(day, i, c, { capKm, aperto, momenti = [], fineFinestra = null, momento = null, soloVisite = true }) {
    const a = day[i - 1] || null, b = day[i] || null;
    if (!a) return { ok: false, perche: 'posizione' }; // mai prima della prima tappa: il giro comincia li'
    const kmA = kmFra(a.candidate, c);
    const kmB = b ? kmFra(c, b.candidate) : 0;
    if (kmA == null || kmB == null) return { ok: false, perche: 'posizione' };
    if (Number.isFinite(capKm) && (kmA > capKm || kmB > capKm)) return { ok: false, perche: 'lontano', km: Math.max(kmA, kmB) };
    let arrivo = fineDi(a) + (travelMinutes(a.candidate, c) ?? 0) * 60000;
    // una visita nuova sta dentro la mattina o il pomeriggio: arrivata prima, aspetta l'inizio del momento (come lo scheletro); mai di sera
    const visite = momenti.filter(m => VISITA.has(m.key));
    if (soloVisite && !momento && visite.length) {
        const dentro = visite.find(m => ms(m.start) <= arrivo && arrivo < ms(m.end));
        if (!dentro) {
            const poi = visite.filter(m => ms(m.start) > arrivo).sort((x, y) => ms(x.start) - ms(y.start))[0];
            if (!poi) return { ok: false, perche: 'tempo' };
            arrivo = ms(poi.start);
        }
    }
    // un momento dato (il pasto da rimettere): si arriva non prima del suo inizio e mai dopo la sua fine
    if (momento) {
        if (arrivo < ms(momento.start)) arrivo = ms(momento.start);
        if (arrivo >= ms(momento.end)) return { ok: false, perche: 'tempo' };
    }
    const m = momento || momentoDiVisita(arrivo, a, b, momenti);
    if (!m) return { ok: false, perche: 'posizione' };
    const sosta = stayInMoment(c, m);
    const fine = arrivo + sosta * 60000;
    // chiuso prima del tempo: «chiuso a quell'ora» e' il motivo vero anche quando la sosta non ci starebbe
    if (!aperto(c, new Date(arrivo), sosta)) return { ok: false, perche: 'chiuso' };
    if (b) {
        const arrivoB = fine + (travelMinutes(c, b.candidate) ?? 0) * 60000;
        if (arrivoB > ms(b.start)) return { ok: false, perche: 'tempo' };
    } else if (!(fineFinestra instanceof Date) || fine > fineFinestra.getTime()) return { ok: false, perche: 'tempo' };
    const attesaDopo = b ? Math.max(0, Math.ceil((ms(b.start) - fine - (travelMinutes(c, b.candidate) ?? 0) * 60000) / 60000)) : null;
    return { ok: true, arrivo, sosta, moment: m, attesaDopo };
}

/**
 * Prova a mettere `c` AL POSTO della voce `j` (stesso momento): arriva quando arrivava lei (o alla fine della tappa prima + il cammino,
 * se e' piu' tardi) e deve lasciare in orario la tappa dopo.
 */
export function provaSostituire(day, j, c, { capKm, aperto, fineFinestra = null }) {
    const old = day[j];
    const a = day[j - 1] || null, b = day[j + 1] || null;
    const kmA = a ? kmFra(a.candidate, c) : 0;
    const kmB = b ? kmFra(c, b.candidate) : 0;
    if (kmA == null || kmB == null) return { ok: false, perche: 'posizione' };
    if (Number.isFinite(capKm) && (kmA > capKm || kmB > capKm)) return { ok: false, perche: 'lontano', km: Math.max(kmA, kmB) };
    const arrivo = a ? Math.max(ms(old.start), fineDi(a) + (travelMinutes(a.candidate, c) ?? 0) * 60000) : ms(old.start);
    const sosta = stayInMoment(c, old.moment);
    const fine = arrivo + sosta * 60000;
    if (!aperto(c, new Date(arrivo), sosta)) return { ok: false, perche: 'chiuso' };
    if (b) {
        if (fine + (travelMinutes(c, b.candidate) ?? 0) * 60000 > ms(b.start)) return { ok: false, perche: 'tempo' };
    } else if (fineFinestra instanceof Date && fine > fineFinestra.getTime()) return { ok: false, perche: 'tempo' };
    return { ok: true, arrivo, sosta, moment: old.moment };
}

/** Il giorno con `c` messa in posizione `i` (esito di provaInserire) e l'attesa della tappa dopo rifatta. */
export function inserisci(day, i, c, esito, { source, trace }) {
    const a = day[i - 1];
    const voce = {
        candidate: c, narration: null, source, moment: esito.moment, start: new Date(esito.arrivo),
        waitMinutesBefore: Math.max(0, Math.ceil((esito.arrivo - fineDi(a) - (travelMinutes(a.candidate, c) ?? 0) * 60000) / 60000)),
        trace,
    };
    const out = [...day.slice(0, i), voce, ...day.slice(i)];
    if (out[i + 1]) out[i + 1] = { ...out[i + 1], waitMinutesBefore: esito.attesaDopo ?? out[i + 1].waitMinutesBefore };
    return out;
}

/** Il giorno con `c` al posto della voce `j` (esito di provaSostituire) e le attese rifatte. */
export function sostituisci(day, j, c, esito, { source, trace }) {
    const out = day.slice();
    const a = out[j - 1];
    const attesa = a ? Math.max(0, Math.ceil((esito.arrivo - fineDi(a) - (travelMinutes(a.candidate, c) ?? 0) * 60000) / 60000)) : (out[j].waitMinutesBefore ?? 0);
    out[j] = { ...out[j], candidate: c, source, start: new Date(esito.arrivo), waitMinutesBefore: attesa, trace: { ...(out[j].trace || {}), ...trace } };
    const b = out[j + 1];
    if (b) {
        const fine = esito.arrivo + esito.sosta * 60000 + (travelMinutes(c, b.candidate) ?? 0) * 60000;
        out[j + 1] = { ...b, waitMinutesBefore: Math.max(0, Math.ceil((ms(b.start) - fine) / 60000)) };
    }
    return out;
}
