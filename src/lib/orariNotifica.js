/**
 * Una notifica non mostra mai un orario già passato: «chiude alle 13:00» alle 17:41 è falso.
 * Funzioni pure, sul minuto del giorno (ora locale dell'utente).
 */

const aMinuti = (h, m = 0) => Number(h) * 60 + Number(m);
/** 'HH:MM' → minuti dalla mezzanotte, o null. */
export const minutiDa = (hhmm) => {
    const x = String(hhmm || '').match(/^(\d{1,2})[:.](\d{2})$/);
    return x ? aMinuti(x[1], x[2]) : null;
};

/**
 * La chiusura di oggi è ancora davanti a noi? Una chiusura dopo mezzanotte (fino alle 05:59)
 * è quella di stanotte: è nel futuro se ora è sera.
 */
export function chiusuraFutura(hhmm, adessoMin) {
    const c = minutiDa(hhmm);
    if (c === null || !Number.isFinite(adessoMin)) return false;
    if (c < 6 * 60 && adessoMin >= 6 * 60) return true;
    return c > adessoMin;
}

/**
 * Gli orari scritti nel testo che sono già passati (per frase; una frase che parla di
 * «domani» non conta). Riconosce «alle 13», «alle 13:00», «fino alle 19.30», «ore 9».
 * @returns {string[]} gli orari passati, come scritti
 */
export function orariPassatiNelTesto(testo, adessoMin) {
    const passati = [];
    if (!Number.isFinite(adessoMin)) return passati;
    for (const frase of String(testo || '').split(/(?<=[.!?])\s+/)) {
        if (/\bdomani\b/i.test(frase)) continue;
        for (const m of frase.matchAll(/\b(?:alle|le|ore|fino alle)\s+(\d{1,2})(?:[:.](\d{2}))?(?!\d)/gi)) {
            const h = Number(m[1]);
            if (h > 24) continue;
            const t = aMinuti(h, m[2] || 0);
            if (t <= adessoMin && !(t < 6 * 60 && adessoMin >= 6 * 60)) passati.push(m[0]);
        }
    }
    return passati;
}
