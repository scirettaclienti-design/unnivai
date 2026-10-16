// DOPPIO-FIX-2 — la chiave di Per Te e l'ultimo Per Te salvato sul telefono.
//
// La fascia e' quella che il motore usa gia': di sera (isSeraStart, dalle 18:00 all'alba) Per Te e' il giro della sera, di giorno
// i temi col momento della tabella dei momenti (momentAtClock), lo stesso che entra nella cache di generateHomeTours. Ora di Roma.
// La sera dopo mezzanotte resta la sera del giorno prima: rientrare alle 00:10 non rigenera il giro delle 23:50.
import { isSeraStart, ALBA_MINUTES } from './daySkeleton';
import { momentAtClock } from './dayMoments';
import { romeParts } from './tourWindow';

export const PER_TE_SALVATO_KEY = 'dvai_per_te_v1';

const due = (n) => String(n).padStart(2, '0');

export function giornoEFasciaPerTe(ora = new Date()) {
    const p = romeParts(ora);
    const sera = isSeraStart(ora);
    let data = new Date(Date.UTC(p.y, p.m - 1, p.d));
    if (sera && p.h * 60 + p.mi < ALBA_MINUTES) data = new Date(data.getTime() - 24 * 60 * 60 * 1000);
    return {
        giorno: `${data.getUTCFullYear()}-${due(data.getUTCMonth() + 1)}-${due(data.getUTCDate())}`,
        fascia: `${sera ? 'sera' : 'giorno'}:${momentAtClock(p.h, p.mi).key}`,
    };
}

// Solo l'ultimo Per Te, e solo per la stessa chiave e lo stesso utente (il logout lo cancella: AuthContext).
export function leggiPerTe(chiave, utente) {
    try {
        const r = JSON.parse(localStorage.getItem(PER_TE_SALVATO_KEY) || 'null');
        if (r && r.chiave === JSON.stringify(chiave) && r.utente === (utente || null)) return r.dati;
    } catch { /* storage illeggibile: si genera */ }
    return undefined;
}

export function salvaPerTe(chiave, utente, dati) {
    try {
        localStorage.setItem(PER_TE_SALVATO_KEY, JSON.stringify({ chiave: JSON.stringify(chiave), utente: utente || null, dati }));
    } catch { /* storage pieno: la prossima ricarica genera */ }
}
