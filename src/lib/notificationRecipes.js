// Gate Q — NOTIFICATION_ENGINE_VERSION rimosso.
//
// Era una costante stringa esportata usata come marker di validita' N.0.
// Chiunque poteva importarla e scriverla a mano dentro un push locale
// (esattamente cosa ha fatto il branch night che generava
// "Bastano 30 secondi! #DoveVAI"). Sostituita da signature opaca calcolata
// in src/lib/aiNotificationFactory.js: il marker deriva dal contenuto +
// un salt privato di modulo. Non e' replicabile fuori dalla fabbrica.
//
// Regola locked: "un marker di verita' che chiunque puo' scriversi da solo
// non e' un marker: e' una convenzione".

// Blocco 2.1 FASE 1 — Ricette contesto → query Places.
//
// Dizionario slot × weatherClass → { categoria, query, kind }.
// - categoria: etichetta interna per prompt/debug ("aperitivo_terrazza")
// - query: string usata come customQuery in Places textsearch
// - kind: 'FOOD' | 'CULTURA' | 'NATURA' | 'RELAX' per applyQualityThreshold
//
// Regola locked: nessuna categoria per slot=`night` (silenzio notturno,
// gestito a monte in useUserNotifications).

export const NOTIFICATION_RECIPES = {
    morning: {
        sereno:  { categoria: 'passeggiata_mattina', query: 'caffè storico centro passeggiata',       kind: 'FOOD'    },
        pioggia: { categoria: 'museo_coperto',       query: 'museo palazzo storico interni',          kind: 'CULTURA' },
        caldo:   { categoria: 'passeggiata_mattina', query: 'caffè storico centro passeggiata',       kind: 'FOOD'    },
        freddo:  { categoria: 'colazione_caldo',     query: 'caffè bar colazione tipica',             kind: 'FOOD'    },
    },
    midday: {
        sereno:  { categoria: 'pranzo_tipico', query: 'trattoria pranzo cucina locale osteria',       kind: 'FOOD' },
        pioggia: { categoria: 'pranzo_coperto', query: 'trattoria interni cucina casalinga',         kind: 'FOOD' },
        caldo:   { categoria: 'pranzo_ombra',   query: 'osteria dehors ombra piatti freddi',         kind: 'FOOD' },
        freddo:  { categoria: 'pranzo_caldo',   query: 'trattoria zuppa pasta al forno',             kind: 'FOOD' },
    },
    afternoon: {
        sereno:  { categoria: 'arte_camminata', query: 'museo galleria palazzo storico',             kind: 'CULTURA' },
        pioggia: { categoria: 'museo_coperto',  query: 'museo palazzo storico interni',              kind: 'CULTURA' },
        caldo:   { categoria: 'museo_coperto',  query: 'museo palazzo storico interni climatizzato', kind: 'CULTURA' },
        freddo:  { categoria: 'arte_camminata', query: 'museo galleria palazzo storico',             kind: 'CULTURA' },
    },
    evening: {
        sereno:  { categoria: 'aperitivo_terrazza',      query: 'cocktail bar terrazza panorama vista', kind: 'FOOD' },
        pioggia: { categoria: 'ristorante_atmosfera',    query: 'ristorante tipico atmosfera intima',   kind: 'FOOD' },
        caldo:   { categoria: 'aperitivo_terrazza',      query: 'cocktail bar terrazza aperitivo',      kind: 'FOOD' },
        freddo:  { categoria: 'bar_intimo',              query: 'wine bar enoteca cucina serale',       kind: 'FOOD' },
    },
    // night intenzionalmente vuoto: nessuna ricetta = nessuna notifica.
};

/**
 * Classifica il meteo in una delle 4 classi accettate dalle ricette.
 * Gate O.2: se ne' temperatura ne' condizione sono disponibili, ritorna null
 * (nessun valore-ponte "22°C sereno" cablato). Il chiamante sa che non deve
 * generare notifica finche' il meteo reale non arriva.
 * @param {number} temperatureC — es. 24 (opzionale)
 * @param {string} condition — es. 'sunny', 'rainy', 'cloudy' (opzionale)
 * @returns {'sereno'|'pioggia'|'caldo'|'freddo'|null}
 */
export function computeWeatherClass(temperatureC, condition) {
    const cond = String(condition || '').toLowerCase();
    const hasCond = cond.length > 0;
    const hasTemp = Number.isFinite(temperatureC);

    if (!hasCond && !hasTemp) return null;

    // Pioggia ha priorità: se piove, non ci interessa se fa caldo/freddo.
    if (hasCond && /(rain|drizzle|storm|snow|piog|nuv|temp)/.test(cond)) return 'pioggia';
    if (hasTemp && temperatureC >= 28) return 'caldo';
    if (hasTemp && temperatureC <= 12) return 'freddo';
    return 'sereno';
}

/**
 * Ricetta per (slot, weatherClass). Ritorna null se non definita
 * (es. slot='night' o combinazione mancante → nessuna notifica).
 */
export function getRecipe(slot, weatherClass) {
    return NOTIFICATION_RECIPES[slot]?.[weatherClass] || null;
}
