// PER-TE-PROPOSTE — Per Te mostra sempre almeno 4 proposte, a qualsiasi ora.
//
// Il motore dà i giri che si possono fare ADESSO (di sera: il giro della sera; di giorno: i temi con posti aperti). Se sono meno
// di PROPOSTE_MINIME, le altre si compongono per il PROSSIMO MATTINO (le 9:30 a Roma, come GIRO-LONTANO): stessi pool, stesse regole degli orari, ma
// misurate sull'ora in cui si parte davvero. Ogni proposta che non parte adesso lo dice (`perDopo`): mai un posto chiuso
// presentato come «adesso». Funzioni pure: le usano generateHomeTours e la Home.
import { romeParts, romeDate, DAY_START } from './tourWindow';
import { PER_TE_TESTI } from './esitoVuoto';

export const PROPOSTE_MINIME = 4;
/** A che ora si parte «per dopo» (ora di Roma): l'inizio della mattina, le 9:30, come «Domani · 9:30» di GIRO-LONTANO (decisione di Ivano). */
export const ORA_PER_DOPO = DAY_START;

const giornoSuccessivo = ({ y, m, d }) => {
    const t = new Date(Date.UTC(y, m - 1, d + 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

/**
 * Il prossimo mattino, alle 9:30 di Roma. Prima delle 9:30 di oggi vale oggi («stamattina»: all'1:20 si dice così), altrimenti domani.
 * @param {Date} adesso
 * @returns {{ data: Date, quando: 'stamattina'|'domattina' }}
 */
export function riferimentoPerDopo(adesso) {
    const p = romeParts(adesso);
    const minuti = p.h * 60 + p.mi;
    const oggi = romeDate({ y: p.y, m: p.m, d: p.d }, ORA_PER_DOPO);
    if (minuti < ORA_PER_DOPO.h * 60 + ORA_PER_DOPO.m && oggi.getTime() > adesso.getTime()) return { data: oggi, quando: 'stamattina' };
    return { data: romeDate(giornoSuccessivo(p), ORA_PER_DOPO), quando: 'domattina' };
}

/** «stamattina» | «domattina» → le parole a schermo. */
const parolaQuando = (quando) => (quando === 'stamattina' ? 'stamattina' : 'domattina');

/** La riga sopra le card: una parte è per dopo (mista) o tutte. */
export const rigaPerDopo = (quando, tutte) => (tutte ? PER_TE_TESTI.rigaTuttePerDopo(parolaQuando(quando)) : PER_TE_TESTI.rigaPerDopoMista(parolaQuando(quando)));

/** Il badge di una proposta per dopo. */
export const badgePerDopo = (quando) => (quando === 'stamattina' ? PER_TE_TESTI.badgePerStamattina : PER_TE_TESTI.badgePerDomattina);

/** Le tappe (place_id) dei giri già scelti: nessuna proposta per dopo le ripete. */
export const placeIdDeiGiri = (tours) => (tours || []).flatMap(t => (t.stops || []).map(s => s.place_id || s.googlePlaceId).filter(Boolean));

/**
 * Le proposte per adesso restano in testa; quelle per dopo seguono, ognuna col suo `perDopo`. Un tema già servito non si ripete.
 * @returns {Array} la lista unica
 */
export function unisciProposte(adesso, dopo, quando) {
    const temi = new Set((adesso || []).map(t => t.themeType));
    const visti = new Set(placeIdDeiGiri(adesso));
    const out = [...(adesso || [])];
    for (const t of dopo || []) {
        if (!t || (t.stops || []).length === 0) continue;
        if (temi.has(t.themeType) && t.themeType !== 'insider') continue;
        const ids = placeIdDeiGiri([t]);
        if (ids.some(id => visti.has(id))) continue;
        ids.forEach(id => visti.add(id));
        out.push({ ...t, perDopo: { quando, badge: badgePerDopo(quando) } });
    }
    return out;
}
