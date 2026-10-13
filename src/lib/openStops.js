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

import { computeScheduledTimes, stayOf, travelMinutes } from './tourTiming';
import { openStatus, OPEN, CLOSED, UNKNOWN, NIGHT_FROM_MINUTES, romeMinutes, orarioLabel } from './openingHours';

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;
const nameOf = (c) => c?.name || c?.title || null;

/** Lo stato d'orario di una tappa gia' in orario (scheduledTime ISO, stayMinutes). */
const statusOfStop = (s) => openStatus(s, s.scheduledTime ? new Date(s.scheduledTime) : null, Number.isFinite(s.stayMinutes) ? s.stayMinutes : stayOf(s));

/**
 * @param {object} p
 * @param {Array} p.stops    tappe in ordine, con stayMinutes/travelMinutesFromPrev e openingPeriods
 * @param {Array} p.pool     i candidati da cui riempire (ordine = ordine di merito)
 * @param {Date}  p.start    la partenza del giro
 * @param {(list: Array) => Array} p.retime  rimette in ordine e ricalcola soste e cammino
 * @param {(candidate: object) => object|null} p.toStop  il candidato come tappa (stessa forma di `stops`)
 * @param {Set<string>} [p.exclude] place_id da non usare (gia' in altri tour)
 * @param {(c: object, arrivo: Date, altre: Array<{ c: object, arrivo: Date }>) => string|null} [p.invalidAt] C8b — una regola in piu' sull'ora di arrivo (le fasce dei pasti di
 *   "Per Te"): torna il motivo se il posto non va bene a quell'ora, altrimenti null. Un posto cosi' si toglie e si sostituisce
 *   come uno chiuso. `altre`: le tappe gia' accettate del giro, in ordine, con il loro arrivo (serve a "un solo pasto seduto").
 * @param {number} [p.maxPasses]
 * @returns {{ stops: Array, chiuse: Array, aggiunte: Array, ignote: number, passi: number }}
 */
export function keepOpenStops({ stops, pool, start, retime, toStop, exclude = null, maxPasses = 4, invalidAt = null }) {
    const want = stops.length;
    let list = stops;
    const vietati = new Set();
    const chiuse = [];
    const aggiunte = [];
    let passi = 0;
    for (; passi < maxPasses; passi++) {
        const timed = computeScheduledTimes(list, start);
        // C8b — la regola in piu' si guarda in ordine di arrivo, contro le tappe gia' accettate
        const accettate = [];
        const motivoRegola = new Map();
        for (const s of timed) {
            if (statusOfStop(s).stato === CLOSED) continue;
            const m = invalidAt && s.scheduledTime ? invalidAt(s, new Date(s.scheduledTime), accettate) : null;
            if (m) motivoRegola.set(idOf(s), m);
            else if (s.scheduledTime) accettate.push({ c: s, arrivo: new Date(s.scheduledTime) });
        }
        const closed = timed.filter(s => statusOfStop(s).stato === CLOSED || motivoRegola.has(idOf(s)));
        if (closed.length === 0) break;
        for (const s of closed) {
            const st = statusOfStop(s);
            vietati.add(idOf(s));
            chiuse.push({ place_id: idOf(s), nome: nameOf(s), arrivo: s.scheduledTime, perche: st.stato === CLOSED ? st.motivo : motivoRegola.get(idOf(s)) });
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
                const st = openStatus(c, arrivo, stayOf(c));
                if (st.stato === CLOSED) continue;
                if (invalidAt && invalidAt(c, arrivo, t.filter(x => x.scheduledTime).map(x => ({ c: x, arrivo: new Date(x.scheduledTime) })))) continue;
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
    const accettateFin = [];
    const residue = [];
    for (const s of finale) {
        const m = statusOfStop(s).stato === CLOSED ? statusOfStop(s).motivo
            : (invalidAt && s.scheduledTime ? invalidAt(s, new Date(s.scheduledTime), accettateFin) : null);
        if (m) residue.push({ s, m });
        else if (s.scheduledTime) accettateFin.push({ c: s, arrivo: new Date(s.scheduledTime) });
    }
    if (residue.length) {
        const residueSet = residue.map(x => x.s);
        for (const { s, m } of residue) chiuse.push({ place_id: idOf(s), nome: nameOf(s), arrivo: s.scheduledTime, perche: m, residua: true });
        list = retime(list.filter(s => !residueSet.some(r => idOf(r) === idOf(s))));
        finale = computeScheduledTimes(list, start);
    }
    const ignote = finale.filter(s => statusOfStop(s).stato === UNKNOWN).length;
    // Lo stato d'orario di ogni tappa va nel tracciato (`_orario`); l'orario assoluto lo rimette chi chiama.
    const out = finale.map(({ scheduledTime, ...s }) => {
        const st = statusOfStop({ ...s, scheduledTime });
        // ORARI-FESTIVI — e da quale orario viene: del giorno (festivi, ferie) o della settimana.
        return { ...s, _orario: orarioLabel(st.stato), ...(st.fonte ? { _orarioFonte: st.fonte } : {}) };
    });
    return { stops: out, chiuse, aggiunte, ignote, passi };
}
