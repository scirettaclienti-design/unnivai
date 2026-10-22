// DOPPIO-FIX-2 — la chiave di Per Te e l'ultimo Per Te salvato sul telefono.
//
// DOPPIO-FIX-3 — tre fasce (decisione di Ivano), ora di Roma, coi confini del motore: sera = isSeraStart (dalle 18:00 alle 05:00),
// pomeriggio = il momento «pomeriggio» di momentAtClock (14:30–18:00), mattina = il resto del giorno (05:00–14:30). Al massimo tre
// Per Te al giorno; il motore continua a scegliere i posti coi suoi momenti.
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
        fascia: sera ? 'sera' : (momentAtClock(p.h, p.mi).key === 'pomeriggio' ? 'pomeriggio' : 'mattina'),
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

// DNA-4 — il tetto delle rigenerazioni dovute al DNA. Ogni generazione di Per Te e' un giro dei 10 al giorno dell'utente
// (ai_quota_daily): le fasce orarie ne portano gia' al massimo 3, il DNA ne puo' aggiungere al massimo 2 al giorno.
// Oltre il tetto la fascia di DNA resta quella dell'ultima generazione, e Per Te cambia solo col cambio di fascia oraria.
// Il conto e' per utente e per giorno (quello di giornoEFasciaPerTe), sul telefono; il logout lo cancella (AuthContext).
export const PER_TE_DNA_KEY = 'dvai_per_te_dna_v1';
export const TETTO_RIGENERAZIONI_DNA_AL_GIORNO = 2;

function leggiConto(giorno, utente) {
    try {
        const r = JSON.parse(localStorage.getItem(PER_TE_DNA_KEY) || 'null');
        if (r && r.giorno === giorno && r.utente === (utente || null) && typeof r.ultima === 'string') return r;
    } catch { /* storage illeggibile: nessun tetto, vale la fascia calcolata */ }
    return null;
}

/** La fascia di DNA da mettere nella chiave: quella calcolata, o quella dell'ultima generazione se il tetto del giorno e' raggiunto. */
export function fasciaDnaEffettiva(calcolata, giorno, utente) {
    const c = leggiConto(giorno, utente);
    return c && c.rigenerazioni >= TETTO_RIGENERAZIONI_DNA_AL_GIORNO ? c.ultima : calcolata;
}

/** Da chiamare quando Per Te e' stato generato con questa fascia: se e' diversa dall'ultima del giorno, e' una rigenerazione dovuta al DNA. */
export function registraFasciaDna(fascia, giorno, utente) {
    const c = leggiConto(giorno, utente);
    const rigenerazioni = c ? c.rigenerazioni + (c.ultima !== fascia ? 1 : 0) : 0;
    try {
        localStorage.setItem(PER_TE_DNA_KEY, JSON.stringify({ giorno, utente: utente || null, ultima: fascia, rigenerazioni }));
    } catch { /* storage pieno: il tetto non si applica, la fascia oraria resta il limite */ }
}
