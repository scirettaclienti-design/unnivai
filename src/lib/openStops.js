/**
 * ORARI — le modalita' senza un pool per momento (Percorso Veloce e Sorprendimi
 * senza scheletro, "Per Te"): stesse regole, applicate alla lista di candidati.
 *
 * Le tappe scelte e messe in ordine vengono messe in orario dalla partenza; ogni
 * tappa chiusa quando ci si arriva (arrivo → arrivo + sosta) si toglie e si
 * sostituisce col candidato piu' vicino alla tappa prima che sia aperto in quel
 * momento. Se non ce n'e', il giro resta piu' corto: mai una tappa chiusa, e il
 * chiamante decide il ripiego dichiarato (messaggio notturno, tour non servito).
 * Un orario sconosciuto e' ammesso, tranne dopo le 21 se esiste un'alternativa
 * aperta con orario noto.
 *
 * Puro: niente rete, niente orologio. Il chiamante passa come rimettere in
 * ordine (`retime`) e come costruire una tappa da un candidato (`toStop`).
 */

import { computeScheduledTimes, resolveStayMinutes, travelMinutes } from './tourTiming';
import { openStatus, OPEN, CLOSED, UNKNOWN, NIGHT_FROM_MINUTES, romeMinutes, orarioLabel } from './openingHours';

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;
const nameOf = (c) => c?.name || c?.title || null;

/** Lo stato d'orario di una tappa gia' in orario (scheduledTime ISO, stayMinutes). */
const statusOfStop = (s) => openStatus(s, s.scheduledTime ? new Date(s.scheduledTime) : null, Number.isFinite(s.stayMinutes) ? s.stayMinutes : resolveStayMinutes(s.types));

/**
 * @param {object} p
 * @param {Array} p.stops    tappe in ordine, con stayMinutes/travelMinutesFromPrev e openingPeriods
 * @param {Array} p.pool     i candidati da cui riempire (ordine = ordine di merito)
 * @param {Date}  p.start    la partenza del giro
 * @param {(list: Array) => Array} p.retime  rimette in ordine e ricalcola soste e cammino
 * @param {(candidate: object) => object|null} p.toStop  il candidato come tappa (stessa forma di `stops`)
 * @param {Set<string>} [p.exclude] place_id da non usare (gia' in altri tour)
 * @param {number} [p.maxPasses]
 * @returns {{ stops: Array, chiuse: Array, aggiunte: Array, ignote: number, passi: number }}
 */
export function keepOpenStops({ stops, pool, start, retime, toStop, exclude = null, maxPasses = 4 }) {
    const want = stops.length;
    let list = stops;
    const vietati = new Set();
    const chiuse = [];
    const aggiunte = [];
    let passi = 0;
    for (; passi < maxPasses; passi++) {
        const timed = computeScheduledTimes(list, start);
        const closed = timed.filter(s => statusOfStop(s).stato === CLOSED);
        if (closed.length === 0) break;
        for (const s of closed) {
            const st = statusOfStop(s);
            vietati.add(idOf(s));
            chiuse.push({ place_id: idOf(s), nome: nameOf(s), arrivo: s.scheduledTime, perche: st.motivo });
        }
        list = timed.filter(s => !vietati.has(idOf(s)));
        // Riempie fino al numero di prima: il piu' vicino alla tappa prima, aperto quando ci si arriva.
        while (list.length < want) {
            const t = computeScheduledTimes(list, start);
            const last = t.at(-1) || null;
            const fine = last && last.scheduledTime
                ? new Date(new Date(last.scheduledTime).getTime() + (Number.isFinite(last.stayMinutes) ? last.stayMinutes : 30) * 60000)
                : start;
            const usati = new Set(list.map(idOf));
            const eleggibili = [];
            for (const c of pool || []) {
                const id = idOf(c);
                if (!id || usati.has(id) || vietati.has(id) || exclude?.has(id)) continue;
                const walk = last ? (travelMinutes(last, c) ?? 0) : 0;
                const arrivo = new Date(fine.getTime() + walk * 60000);
                const st = openStatus(c, arrivo, resolveStayMinutes(c.types));
                if (st.stato === CLOSED) continue;
                eleggibili.push({ c, st: st.stato, walk, arrivo });
            }
            if (eleggibili.length === 0) break;
            // Dopo le 21 un orario sconosciuto perde contro uno aperto noto.
            const notte = romeMinutes(fine) >= NIGHT_FROM_MINUTES;
            const noti = eleggibili.filter(x => x.st === OPEN);
            const tra = notte && noti.length > 0 ? noti : eleggibili;
            const migliore = tra.reduce((a, b) => (b.walk < a.walk ? b : a));
            const stop = toStop(migliore.c);
            if (!stop) { vietati.add(idOf(migliore.c)); continue; }
            list = [...list, stop];
            aggiunte.push({ place_id: idOf(migliore.c), nome: nameOf(migliore.c) });
        }
        list = retime(list);
    }
    let finale = computeScheduledTimes(list, start);
    // L'ultima rete: dopo i giri, una tappa ancora chiusa non esce mai.
    const residue = finale.filter(s => statusOfStop(s).stato === CLOSED);
    if (residue.length) {
        for (const s of residue) chiuse.push({ place_id: idOf(s), nome: nameOf(s), arrivo: s.scheduledTime, perche: statusOfStop(s).motivo, residua: true });
        list = retime(list.filter(s => !residue.some(r => idOf(r) === idOf(s))));
        finale = computeScheduledTimes(list, start);
    }
    const ignote = finale.filter(s => statusOfStop(s).stato === UNKNOWN).length;
    // Lo stato d'orario di ogni tappa va nel tracciato (`_orario`); l'orario assoluto lo rimette chi chiama.
    const out = finale.map(({ scheduledTime, ...s }) => ({ ...s, _orario: orarioLabel(statusOfStop({ ...s, scheduledTime }).stato) }));
    return { stops: out, chiuse, aggiunte, ignote, passi };
}
