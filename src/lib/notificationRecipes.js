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
 * @param {number} temperatureC — es. 24
 * @param {string} condition — es. 'sunny', 'rainy', 'cloudy'
 * @returns {'sereno'|'pioggia'|'caldo'|'freddo'}
 */
export function computeWeatherClass(temperatureC, condition) {
    const cond = String(condition || '').toLowerCase();
    const t = Number.isFinite(temperatureC) ? temperatureC : 22;

    // Pioggia ha priorità: se piove, non ci interessa se fa caldo/freddo.
    if (/(rain|drizzle|storm|snow|piog|nuv|temp)/.test(cond)) return 'pioggia';
    if (t >= 28) return 'caldo';
    if (t <= 12) return 'freddo';
    return 'sereno';
}

/**
 * Ricetta per (slot, weatherClass). Ritorna null se non definita
 * (es. slot='night' o combinazione mancante → nessuna notifica).
 */
export function getRecipe(slot, weatherClass) {
    return NOTIFICATION_RECIPES[slot]?.[weatherClass] || null;
}
