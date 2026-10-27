/**
 * Il riquadro «Il tuo DNA esplorativo» di un giro (Crea, Quiz, Sorprendimi, Per Te): SOLO cio' che del DNA e della richiesta ha
 * guidato QUEL giro. Funzione pura, nessuna rete, nessuna chiamata AI. Un dato che manca non lascia una riga (mai «—»); senza righe
 * il riquadro non compare. Al massimo 3 righe, nella voce di Unnivai: un fatto, mai un aggettivo.
 *
 *  · «Hai scelto natura · parchi.» — la scelta fatta nel Quiz o in Sorprendimi (le opzioni cliccate);
 *  · «Hai chiesto cibo e storia.» — le categorie che la frase o i chip di Crea chiedono davvero (richiestaEsplicita);
 *  · «Più cibo: è tra i tuoi gusti più forti.» — una delle prime 2 categorie del DNA presenti nel giro, senza percentuali, SOLO se il DNA guida (fiducia > 0, come
 *    nel motore) e SOLO se il giro ha almeno una tappa di quella categoria.
 */

import { categorieForti, ETICHETTE_CATEGORIA } from './dnaProfilo.js';
import { tourCoreCategories } from '../services/preferenceEngine.js';

export const MAX_RIGHE_DNA = 3;
/** Quante categorie del DNA, al massimo, entrano nel riquadro. */
export const MAX_CATEGORIE_DNA = 2;

// ─── I TESTI DEL RIQUADRO (un file solo) ─────────────────────────────────────────────────────────────────────────
export const TESTI_DNA = {
    scelto: (valori) => `Hai scelto ${valori}.`,
    chiesto: (valori) => `Hai chiesto ${valori}.`,
    forte: (categoria) => `Più ${categoria}: è tra i tuoi gusti più forti.`,
};

/** Come si dice una categoria dentro una frase (minuscolo, breve). */
const PAROLA = {
    cultura: 'cultura', food: 'cibo', nightlife: 'serate', natura: 'natura',
    avventura: 'avventura', shopping: 'shopping', relax: 'relax', arte: 'arte',
};
const parola = (c) => PAROLA[c] || (ETICHETTE_CATEGORIA[c] ? ETICHETTE_CATEGORIA[c].toLowerCase() : null);
const unisci = (v) => (v.length <= 1 ? (v[0] || '') : `${v.slice(0, -1).join(', ')} e ${v.at(-1)}`);
const pulito = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * @param {object} p
 * @param {object} [p.pesi]       i pesi del DNA (0–1 per categoria, quelli del Profilo)
 * @param {number} [p.fiducia]    quanto il DNA pesa nel motore (`dnaShare`); 0 = il DNA non ha guidato nulla
 * @param {string[]} [p.scelte]   le opzioni scelte nel Quiz o in Sorprendimi, nell'ordine (es. ['Natura', 'Parchi'])
 * @param {string[]} [p.richiesta] le categorie chieste con la frase o i chip di Crea (chiavi di base: 'food', 'cultura', …)
 * @param {Array}  [p.tappe]      le tappe del giro (per sapere se una categoria del DNA c'e' davvero)
 * @returns {string[]} da 0 a 3 righe
 */
export function righeDnaDelGiro({ pesi = {}, fiducia = 0, scelte = [], richiesta = [], tappe = [] } = {}) {
    const righe = [];
    const nominate = new Set();

    const sc = (Array.isArray(scelte) ? scelte : []).map(pulito).filter(Boolean);
    if (sc.length) righe.push(TESTI_DNA.scelto(sc.map(s => s.toLowerCase()).join(' · ')));

    const chieste = [...new Set((Array.isArray(richiesta) ? richiesta : []).filter(c => parola(c)))];
    if (chieste.length) {
        const prime = chieste.slice(0, 2);
        prime.forEach(c => nominate.add(c));
        righe.push(TESTI_DNA.chiesto(unisci(prime.map(parola))));
    }

    if (Number(fiducia) > 0) {
        const nelGiro = new Set(tourCoreCategories((Array.isArray(tappe) ? tappe : []).filter(s => s && !s.tempoLibero)));
        let dna = 0;
        for (const { categoria } of categorieForti(pesi)) {
            if (righe.length >= MAX_RIGHE_DNA || dna >= MAX_CATEGORIE_DNA) break;
            if (nominate.has(categoria) || !nelGiro.has(categoria) || !parola(categoria)) continue;
            righe.push(TESTI_DNA.forte(parola(categoria)));
            dna += 1;
        }
    }
    return righe.slice(0, MAX_RIGHE_DNA);
}
