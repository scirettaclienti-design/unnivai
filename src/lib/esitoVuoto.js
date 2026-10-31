// TROINA-FIX — un giro vuoto ha due messaggi, e uno solo dice «non troviamo».
//
//   · «A [città] non troviamo [categoria]. Cambia richiesta e riprovo.» SOLO se la ricerca e' riuscita e ha davvero zero
//     posti (il motore lo segna: `_zeroVero`, vedi aiRecommendationService);
//   · ogni altro vuoto — timeout, rete, lista della citta' mancante, selettore caduto, un giro andato a vuoto con dei posti
//     nel pool — e' «Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.» col tasto
//     «Riprova» (testo di Ivano, alla lettera).
//   · «quasi tutto chiuso» (closed-now) resta il suo messaggio. Le quote e il guasto del motore AI non arrivano qui: il
//     motore le lancia e le pagine mostrano i loro testi (QUOTA_*_MESSAGE, AI_ENGINE_MESSAGE).
//
// Lo usano Quiz Veloce, Sorprendimi e Crea il tuo Percorso: prima ciascuna pagina trasformava qualunque vuoto in «non
// troviamo», anche un selettore caduto (Troina, 15/10).

export const MESSAGGIO_TECNICO = 'Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.';
export const TASTO_RIPROVA = 'Riprova';
export const SOTTOTITOLO_NON_TROVIAMO = 'Cambia richiesta e riprovo.';

/** «A Troina non troviamo parchi e giardini.» (la seconda frase, «Cambia richiesta e riprovo.», la aggiunge chi mostra). */
export const titoloNonTroviamo = (citta, oggetto) => `A ${citta || 'questa città'} non troviamo ${oggetto || 'quello che hai chiesto'}.`;
/** La frase intera, come la vuole il testo di Ivano. */
export const messaggioNonTroviamo = (citta, oggetto) => `${titoloNonTroviamo(citta, oggetto)} ${SOTTOTITOLO_NON_TROVIAMO}`;

/**
 * Che cosa dire di un risultato del motore senza tappe.
 * @param {object} result il risultato di generateItinerary
 * @param {string} citta  la citta' del giro (per il testo)
 * @returns {{ tipo: 'chiuso'|'zero'|'tecnico', testo: string, titolo: string, sottotitolo: string|null, riprova: boolean }}
 */
export function esitoVuoto(result, citta) {
    if (result?._source === 'closed-now') {
        const t = result._messaggio || 'A quest\'ora qui è quasi tutto chiuso.';
        return { tipo: 'chiuso', testo: t, titolo: t, sottotitolo: null, riprova: false };
    }
    if (result?._zeroVero === true) {
        const titolo = titoloNonTroviamo(citta, result._oggetto_umano);
        return { tipo: 'zero', testo: `${titolo} ${SOTTOTITOLO_NON_TROVIAMO}`, titolo, sottotitolo: SOTTOTITOLO_NON_TROVIAMO, riprova: false };
    }
    return { tipo: 'tecnico', testo: MESSAGGIO_TECNICO, titolo: MESSAGGIO_TECNICO, sottotitolo: null, riprova: true };
}

/** Un risultato del motore e' vuoto (nessuna tappa vera)? */
export const giroVuoto = (result) => !(result?.days || []).some(d => (d?.stops || []).some(s => s && !s.tempoLibero));

// PER-TE-PROPOSTE — i testi di Per Te: le proposte che non partono adesso lo dicono. Voce Unnivai: diretta, frasi brevi, il dato nudo.
export const PER_TE_TESTI = {
    /** Il badge di una card che non si fa adesso (i posti aprono dopo). */
    badgePerDomattina: 'Per domattina',
    badgePerStamattina: 'Per stamattina',
    /** Una riga sopra le card quando solo una parte è per adesso. */
    rigaPerDopoMista: (quando) => `Adesso è aperto poco. Le altre sono per ${quando}.`,
    /** Una riga sopra le card quando nessuna è per adesso. */
    rigaTuttePerDopo: (quando) => `A quest’ora è quasi tutto chiuso. Sono giri per ${quando}, dalle 9:30.`,
    /** Il titolo di un giro per tema: il dato nudo. */
    titoloTema: (tema, citta) => ({
        insider: `Da insider a ${citta}`,
        food: `Dove si mangia a ${citta}`,
        cultura: `Cultura a ${citta}`,
        romance: `Panorami a ${citta}`,
        nature: `Verde a ${citta}`,
    }[tema] || `Un giro a ${citta}`),
};
