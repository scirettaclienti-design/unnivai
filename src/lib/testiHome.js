// PER-TE-TRE (T27) — i testi della home e dell'elenco di Per Te, in un file solo (sul modello di testiAccount.js).
// Le route e i nomi interni restano quelli di sempre: qui cambiano solo le parole a schermo.
export const TESTI_HOME = {
    /** Il primo ingresso: «Crea il tuo Percorso» (/ai-itinerary). */
    suMisura: {
        etichetta: 'Gratis',
        titolo: 'Su misura',
        sottotitolo: 'Scrivi cosa cerchi. Città, gusti, budget, ritmo: il giro lo costruiamo da qui.',
    },
    /** Il secondo ingresso: il «Quiz Veloce» (/quick-path). */
    alVolo: {
        titolo: 'Al volo',
        sottotitolo: 'Tre scelte e sei in strada.',
    },
    /** La scheda che si apre su Con Guida e Sorprendimi: prima diceva «Su misura per te», che ora è il nome del primo ingresso. */
    creaIlTuoTour: {
        titolo: 'Crea il tuo Tour',
        etichetta: 'Con una guida o a sorpresa',
    },
    vediTutte: 'Vedi tutte',
};

const NOME_PASSIONE = { nature: 'la natura', food: 'il cibo', cultura: 'la cultura', romance: 'i panorami' };

export const TESTI_PER_TE = {
    titolo: 'Per Te',
    titoloSenzaGusti: 'Esperienze Uniche',
    tornaAllaHome: 'Torna alla home',
    /** Una passione del DNA senza una proposta: lo si dice. */
    passioneMancante: (temi, citta) => {
        const nomi = (temi || []).map(t => NOME_PASSIONE[t]).filter(Boolean);
        if (nomi.length === 0) return null;
        const elenco = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`;
        return `Per ${elenco}, a ${citta || 'qui'}, adesso non ho un giro a piedi che regga.`;
    },
    /** L'elenco di «Vedi tutte» senza niente di pronto per questa fascia del giorno. */
    vuoto: {
        titolo: 'Niente di pronto per adesso.',
        testo: 'Le proposte nascono sulla home: aprila e le trovi qui.',
    },
};
