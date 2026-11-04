/**
 * Il riquadro «Il tuo DNA esplorativo» di un giro (Crea, Quiz, Sorprendimi, Per Te): SOLO cio' che del DNA e della richiesta ha
 * guidato QUEL giro, detto con un fatto vero dell'utente. Funzione pura, nessuna rete, nessuna chiamata AI. Un dato che manca non
 * lascia una riga (mai «—»); senza righe il riquadro non compare. Al massimo 3 righe, nella voce di Unnivai: un fatto, mai un
 * aggettivo.
 *
 * DNA-5 — la riga uguale per tutti («Più cultura: è tra i tuoi gusti più forti.») non c'e' piu'. Al suo posto, nell'ordine:
 *  1. «Hai scelto natura · parchi.» / «Hai chiesto cibo e storia.» — la scelta o la richiesta (come prima);
 *  2. un FATTO dai giri finiti dell'utente su una cosa che c'e' in questo giro: la sosta media in quel tipo di posto
 *     («Nei tuoi ultimi 4 giri la sosta media nei musei è stata di 38 minuti.»), o quante tappe di quella categoria ha raggiunto
 *     («Nei tuoi ultimi 3 giri 5 tappe su 9 erano di storia e cultura.»);
 *  3. il RITMO del DNA che ha cambiato il giro, con la sua fonte (Profilo, giri, scelte);
 *  4. la COMPAGNIA del DNA, con la sua fonte (Profilo, scelte), e la merenda se c'e';
 *  5. senza nessun fatto: gli interessi scelti nel Profilo presenti nel giro, oppure, se il DNA ha guidato senza giri finiti,
 *     la riga onesta «Ancora nessun giro finito: il DNA impara dalle tappe che raggiungi.».
 */

import { tourCoreCategories, stopCoreCategory, normalizeCategory } from '../services/preferenceEngine.js';
import { ritmoAppreso, giriDalRegistro, RITMO_MAX_GIRI } from './dnaRitmo.js';
import { placeKind } from './placeKind.js';

export const MAX_RIGHE_DNA = 3;

// ─── I TESTI DEL RIQUADRO E DEL PROFILO (un file solo) ─────────────────────────────────────────────────────────────────────────
const num = (x) => String(x).replace('.', ',');
export const TESTI_DNA = {
    scelto: (valori) => `Hai scelto ${valori}.`,
    chiesto: (valori) => `Hai chiesto ${valori}.`,
    sostaTipo: (giri, dove, minuti) => `Nei tuoi ultimi ${giri} giri la sosta media ${dove} è stata di ${minuti} minuti.`,
    tappeCategoria: (giri, k, tot, di) => `Nei tuoi ultimi ${giri} giri ${k} tappe su ${tot} erano ${di}.`,
    ritmoProfilo: (effetto) => `${effetto}: il ritmo che hai scelto nel Profilo.`,
    ritmoSoste: (effetto, giri, pct, piu) => `${effetto}: nei tuoi ultimi ${giri} giri le soste sono durate il ${pct}% ${piu ? 'più' : 'meno'} della stima di Unnivai.`,
    ritmoKm: (effetto, giri, tappe, km) => `${effetto}: nei tuoi ultimi ${giri} giri hai raggiunto in media ${num(tappe)} tappe${km !== null ? ` e camminato ${num(km)} km` : ''}.`,
    ritmoScelte: (effetto, scelta, k, tot) => `${effetto}: hai scelto «${scelta}» in ${k} richieste su ${tot}.`,
    compagniaProfilo: (chi) => `${chi}: l'hai scelto nel Profilo.`,
    compagniaScelte: (chi, k, tot) => `${chi}: l'hai scelto in ${k} richieste su ${tot}.`,
    merenda: (ora, nome) => `Merenda alle ${ora} da ${nome}.`,
    interessi: (valori) => `Nel Profilo hai scelto ${valori}.`,
    pochiDati: 'Ancora nessun giro finito: il DNA impara dalle tappe che raggiungi.',
};
/** I testi del Profilo per ritmo e compagnia (RitmoCompagniaEditor). */
export const TESTI_RITMO_COMPAGNIA = {
    titolo: 'Come giri',
    ritmo: 'Che ritmo?',
    compagnia: 'Di solito con chi?',
    impara: 'Lo impara Unnivai',
    nota: 'Senza una scelta, Unnivai usa i tuoi giri finiti.',
    salva: 'Salva ritmo e compagnia',
    salvato: 'Ritmo e compagnia salvati',
    errore: 'Non sono riuscito a salvarli',
};

/** Come si dice una categoria dentro una frase (minuscolo, breve). */
const PAROLA = {
    cultura: 'cultura', food: 'cibo', nightlife: 'serate', natura: 'natura',
    avventura: 'avventura', shopping: 'shopping', relax: 'relax', arte: 'arte',
};
/** «… erano di storia e cultura / nel verde» */
const TAPPE_DI = {
    cultura: 'di storia e cultura', food: 'per mangiare o bere', natura: 'nel verde', arte: "d'arte",
    nightlife: 'da sera', avventura: "d'avventura", shopping: 'di shopping', relax: 'di relax',
};
/** «la sosta media nei musei» — per tipo di posto (placeKind), poi per categoria */
const DOVE_TIPO = {
    museo: 'nei musei', chiesa: 'nelle chiese', verde: 'nel verde', pasto: 'a tavola', caffe: 'nei caffè', bar: 'nei bar',
    forno: 'nei forni', dolce: 'in gelateria e pasticceria', spuntino: 'nello street food', negozio: 'nei negozi', notte: 'nei locali da sera',
};
const DOVE_CATEGORIA = {
    cultura: 'nei luoghi di storia e cultura', natura: 'nel verde', arte: "nei luoghi d'arte", food: 'dove si mangia',
    relax: 'nei luoghi di relax', shopping: 'nei negozi', avventura: "nei luoghi d'avventura", nightlife: 'nei locali da sera',
};
const EFFETTO_RITMO = { lento: 'Meno tappe e soste più lunghe', veloce: 'Più tappe e soste più corte' };
const SCELTA_RITMO = { lento: 'Rilassato', medio: 'Attivo', veloce: 'Intenso' };
const CHI = { solo: 'Da solo', coppia: 'In coppia', famiglia: 'In famiglia', amici: 'Con gli amici' };
const MIN_PER_FATTO = 2;

const parola = (c) => PAROLA[c] || null;
const unisci = (v) => (v.length <= 1 ? (v[0] || '') : `${v.slice(0, -1).join(', ')} e ${v.at(-1)}`);
const pulito = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const oraDi = (iso) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return null;
    const p = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return p.replace('.', ':');
};

/** Il fatto piu' specifico dai giri finiti su una cosa che c'e' in questo giro (null se i dati non bastano). */
export function fattoDaiGiri(registro, tappe) {
    const vere = (Array.isArray(tappe) ? tappe : []).filter(s => s && !s.tempoLibero);
    if (!Array.isArray(registro) || registro.length === 0 || vere.length === 0) return null;
    const appreso = ritmoAppreso(registro);
    // 1. la sosta media nel tipo di posto (museo, chiesa, verde…) presente nel giro
    const tipiNelGiro = new Set(vere.map(s => placeKind({ types: s.types, primaryType: s.primaryType ?? s.primary_type }).kind).filter(Boolean));
    const perTipo = Object.entries(appreso.perTipo)
        .filter(([k, v]) => tipiNelGiro.has(k) && DOVE_TIPO[k] && v.n >= MIN_PER_FATTO && v.giri >= MIN_PER_FATTO)
        .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    if (perTipo.length) return TESTI_DNA.sostaTipo(appreso.giri, DOVE_TIPO[perTipo[0][0]], perTipo[0][1].media);
    // 2. la sosta media nella categoria presente nel giro
    const catNelGiro = new Set(tourCoreCategories(vere));
    const perCat = Object.entries(appreso.perCategoria)
        .filter(([k, v]) => catNelGiro.has(k) && DOVE_CATEGORIA[k] && v.n >= MIN_PER_FATTO && v.giri >= MIN_PER_FATTO)
        .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    if (perCat.length) return TESTI_DNA.sostaTipo(appreso.giri, DOVE_CATEGORIA[perCat[0][0]], perCat[0][1].media);
    // 3. quante tappe di quella categoria ha raggiunto (vale anche per le righe vecchie, senza soste)
    const giri = giriDalRegistro(registro).slice(0, RITMO_MAX_GIRI);
    if (giri.length < MIN_PER_FATTO) return null;
    const tutte = giri.flatMap(g => g.tappe);
    const conteggi = {};
    for (const t of tutte) if (t.categoria) conteggi[t.categoria] = (conteggi[t.categoria] || 0) + 1;
    const migliore = Object.entries(conteggi)
        .filter(([k, n]) => catNelGiro.has(k) && TAPPE_DI[k] && n >= MIN_PER_FATTO)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return migliore ? TESTI_DNA.tappeCategoria(giri.length, migliore[1], tutte.length, TAPPE_DI[migliore[0]]) : null;
}

/** La riga del ritmo del DNA che ha cambiato il giro (null per il ritmo medio o chiesto). */
export function rigaRitmo(ritmo) {
    if (!ritmo || ritmo.fonte === 'richiesta' || !EFFETTO_RITMO[ritmo.valore]) return null;
    const effetto = EFFETTO_RITMO[ritmo.valore];
    if (ritmo.fonte === 'profilo') return TESTI_DNA.ritmoProfilo(effetto);
    if (ritmo.fonte === 'giri' && ritmo.dati) {
        const f = Number(ritmo.dati.fattoreSosta);
        if (Number.isFinite(f) && f !== 1) return TESTI_DNA.ritmoSoste(effetto, ritmo.dati.giri, Math.round(Math.abs(f - 1) * 100), f > 1);
        if (Number.isFinite(ritmo.dati.tappeMedie)) return TESTI_DNA.ritmoKm(effetto, ritmo.dati.giri, ritmo.dati.tappeMedie, Number.isFinite(ritmo.dati.kmMedi) ? ritmo.dati.kmMedi : null);
        return null;
    }
    if (ritmo.fonte === 'scelte' && ritmo.quante?.tot) return TESTI_DNA.ritmoScelte(effetto, SCELTA_RITMO[ritmo.valore], ritmo.quante.k, ritmo.quante.tot);
    return null;
}

/** La riga della compagnia del DNA (null se la compagnia l'ha chiesta la richiesta: e' gia' scritta li'). */
export function rigaCompagnia(compagnia) {
    if (!compagnia || !CHI[compagnia.valore]) return null;
    if (compagnia.fonte === 'profilo') return TESTI_DNA.compagniaProfilo(CHI[compagnia.valore]);
    if (compagnia.fonte === 'scelte' && compagnia.quante?.tot) return TESTI_DNA.compagniaScelte(CHI[compagnia.valore], compagnia.quante.k, compagnia.quante.tot);
    return null;
}

/**
 * @param {object} p
 * @param {object} [p.pesi]       i pesi del DNA (0–1 per categoria, quelli del Profilo)
 * @param {number} [p.fiducia]    quanto il DNA pesa nel motore (`dnaShare`); 0 = il DNA non ha guidato nulla
 * @param {string[]} [p.scelte]   le opzioni scelte nel Quiz o in Sorprendimi, nell'ordine (es. ['Natura', 'Parchi'])
 * @param {string[]} [p.richiesta] le categorie chieste con la frase o i chip di Crea (chiavi di base: 'food', 'cultura', …)
 * @param {Array}  [p.tappe]      le tappe del giro
 * @param {object[]} [p.registro] DNA-5 — le righe del registro del DNA (dna_events) dell'utente
 * @param {object} [p.giro]       DNA-5 — cosa del ritmo e della compagnia ha cambiato il giro (tracciatoGiroDna)
 * @param {string[]} [p.interessi] DNA-5 — gli interessi scelti nel Profilo (id di base: 'cultura', 'natura'…)
 * @returns {string[]} da 0 a 3 righe
 */
export function righeDnaDelGiro({ pesi = {}, fiducia = 0, scelte = [], richiesta = [], tappe = [], registro = null, giro = null, interessi = [] } = {}) { // eslint-disable-line no-unused-vars
    const righe = [];
    const vere = (Array.isArray(tappe) ? tappe : []).filter(s => s && !s.tempoLibero);

    const sc = (Array.isArray(scelte) ? scelte : []).map(pulito).filter(Boolean);
    if (sc.length) righe.push(TESTI_DNA.scelto(sc.map(s => s.toLowerCase()).join(' · ')));

    const chieste = [...new Set((Array.isArray(richiesta) ? richiesta : []).filter(c => parola(c)))];
    if (chieste.length) righe.push(TESTI_DNA.chiesto(unisci(chieste.slice(0, 2).map(parola))));

    const dna = [];
    const fatto = fattoDaiGiri(registro, vere);
    if (fatto) dna.push(fatto);
    const rr = rigaRitmo(giro?.ritmo);
    if (rr) dna.push(rr);
    const rc = rigaCompagnia(giro?.compagnia);
    if (rc) dna.push(rc);
    // la merenda della famiglia, se il giro ce l'ha davvero
    if (giro?.merenda) {
        const m = vere.find(s => s?._tracciato?.dna?.merenda);
        const ora = m ? oraDi(m.scheduledTime) : null;
        if (m && ora) dna.push(TESTI_DNA.merenda(ora, pulito(m.title || m.name)));
    }
    if (dna.length === 0) {
        // nessun fatto: gli interessi del Profilo presenti nel giro (un dato vero), o la riga onesta se il DNA ha guidato senza giri
        const nelGiro = new Set(vere.map(stopCoreCategory).filter(Boolean));
        const scelti = [...new Set((Array.isArray(interessi) ? interessi : []).map(normalizeCategory).filter(c => c && nelGiro.has(c) && parola(c) && !chieste.includes(c)))];
        if (scelti.length) dna.push(TESTI_DNA.interessi(unisci(scelti.slice(0, 2).map(parola))));
        else if (Number(fiducia) > 0 && vere.length > 0 && Array.isArray(registro) && !registro.some(r => r?.kind === 'stop_reached' || r?.kind === 'tour_completed')) {
            dna.push(TESTI_DNA.pochiDati);
        }
    }
    return [...righe, ...dna].slice(0, MAX_RIGHE_DNA);
}
