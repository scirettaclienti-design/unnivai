/**
 * DNA-5 — dal ritmo e dalla compagnia del DNA a cosa il motore cambia nel giro. Funzione pura: il motore la chiama una volta
 * (`_generateItinerary`, `_homeTemi`) con `opts.dnaGiro` = { ritmo: ritmoDelGiro(...), compagnia: compagniaDelGiro(...) }, che la
 * pagina calcola (Crea: AiItinerary; Per Te: DashboardUser). Senza `opts.dnaGiro` il giro e' quello di sempre (banco, replay, Quiz,
 * Sorprendimi: invariati).
 */

import { REGOLE_COMPAGNIA, bonusCompagnia, compagniaDelGiro } from './compagniaDna.js';
import { ritmoAppreso, ritmoDelGiro } from './dnaRitmo.js';

const NESSUNO = Object.freeze({ attivo: false, ritmo: null, compagnia: null, passo: null, fattoreSosta: null, sostaPasto: null, gruppo: null, merenda: false, tappePerTe: null, bonus: null, impronta: '' });

/**
 * @param {{ ritmo?: object|null, compagnia?: object|null }|null} dnaGiro
 * @param {{ pace?: string, group?: string }} [prefs]  la richiesta: un ritmo chiesto spegne il ritmo del DNA
 */
export function giroDnaPerMotore(dnaGiro, prefs = {}) {
    if (!dnaGiro || typeof dnaGiro !== 'object') return NESSUNO;
    const ritmoChiesto = !!String(prefs?.pace || '').trim();
    const ritmo = dnaGiro.ritmo && dnaGiro.ritmo.fonte !== 'richiesta' && !ritmoChiesto ? dnaGiro.ritmo : null;
    const compagnia = dnaGiro.compagnia && REGOLE_COMPAGNIA[dnaGiro.compagnia.valore] ? dnaGiro.compagnia : null;
    if (!ritmo && !compagnia) return NESSUNO;
    const regole = compagnia ? REGOLE_COMPAGNIA[compagnia.valore] : null;
    const fattoreSosta = ritmo && Number.isFinite(ritmo.fattoreSosta) && ritmo.fattoreSosta !== 1 ? ritmo.fattoreSosta : null;
    return {
        attivo: true,
        ritmo,
        compagnia,
        passo: ritmo?.passo || null,
        fattoreSosta,
        sostaPasto: regole?.sostaPasto || null,
        // il Gruppo della richiesta resta quello scelto; senza, quello della compagnia del DNA (scheletro e prompt lo leggono)
        gruppo: !String(prefs?.group || '').trim() && compagnia ? compagnia.gruppo : null,
        merenda: !!regole?.merenda,
        tappePerTe: ritmo?.tappePerTe || null,
        bonus: compagnia && Object.keys(regole.spinte).length ? (c) => bonusCompagnia(c, compagnia.valore) : null,
        impronta: `dna5:${ritmo ? `${ritmo.valore}${fattoreSosta ?? ''}` : '-'}|${compagnia ? compagnia.valore : '-'}`,
    };
}

/** Il riassunto per il tracciato (`_momentReport.dnaGiro`, `_report.dnaGiro`): cosa del DNA ha cambiato il giro. */
export const tracciatoGiroDna = (g) => (g?.attivo ? {
    ritmo: g.ritmo ? {
        valore: g.ritmo.valore, fonte: g.ritmo.fonte, fattoreSosta: g.fattoreSosta ?? 1, passo: g.passo, tappePerTe: g.tappePerTe,
        ...(g.ritmo.quante ? { quante: g.ritmo.quante } : {}),
        ...(g.ritmo.dati ? { dati: { giri: g.ritmo.dati.giri, fattoreSosta: g.ritmo.dati.fattoreSosta, kmMedi: g.ritmo.dati.kmMedi, tappeMedie: g.ritmo.dati.tappeMedie } } : {}),
    } : null,
    compagnia: g.compagnia ? { valore: g.compagnia.valore, fonte: g.compagnia.fonte, ...(g.compagnia.quante ? { quante: g.compagnia.quante } : {}) } : null,
    sostaPasto: g.sostaPasto, gruppo: g.gruppo, merenda: g.merenda,
} : null);

/**
 * Il dnaGiro di una pagina (Crea, Per Te) dai dati che useAILearning gia' espone. Puro.
 * @param {{ righeRegistro?: object[]|null, onboardingPrefs?: object, ritmoPreferito?: object|null, compagniaPreferita?: object|null }} dna
 * @param {{ scelto?: string, gruppo?: string, testo?: string }} [richiesta]  Crea: ritmo e Gruppo scelti, la frase
 * @returns {{ ritmo: object|null, compagnia: object|null }}
 */
export function dnaGiroDaApprendimento(dna = {}, { scelto = null, gruppo = null, testo = '' } = {}) {
    const appreso = Array.isArray(dna?.righeRegistro) && dna.righeRegistro.length ? ritmoAppreso(dna.righeRegistro) : null;
    return {
        ritmo: ritmoDelGiro({ scelto, profilo: dna?.onboardingPrefs?.ritmo || null, appreso, scelte: dna?.ritmoPreferito || null }),
        compagnia: compagniaDelGiro({ testo, scelta: gruppo, profilo: dna?.onboardingPrefs?.compagnia || null, scelte: dna?.compagniaPreferita || null }),
    };
}
