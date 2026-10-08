// P7b — Primo accesso e vincoli a tavola.
//
// Tre cose diverse, trattate in modo diverso:
//   • VINCOLI (dieta, budget) → filtri di CODICE, mai affidati al modello.
//       dieta  → la ricerca del cibo fatta dal codice include il criterio
//                ("vegetariano", "vegano", "senza glutine", "halal"), e un posto
//                dove mangiare entra nel pool SOLO se e' arrivato da una ricerca
//                con quel criterio. A schermo una riga onesta: "Locali cercati
//                come vegetariani: verifica sul posto." Mai "e' vegetariano".
//       budget → fuori i locali con price_level sopra il tetto; price_level
//                sconosciuto ammesso, con priorita' piu' bassa.
//   • GUSTI (stile a tavola) → una spinta nel punteggio, mai un'esclusione.
//   • GERARCHIA delle fonti: testo scritto → wizard → DNA → primo accesso →
//     base. Una fonte piu' bassa non scavalca mai una piu' alta.
//
// Modulo puro (nessun import di servizi): il predicato "e' un posto dove
// mangiare" arriva da chi chiama (isMealPlace di momentSelection), per non
// creare cicli fra candidateScoring, momentSelection e questo file.

// ─── Vocabolario ─────────────────────────────────────────────────────────────
// P7b2 — `opzione`: come la dieta entra nella ricerca. Si AGGIUNGE alla
// richiesta ("trattoria romana" → "trattoria romana con opzioni vegetariane"),
// non la sostituisce: le parole di cucina e stile restano.
// `parole`: se la richiesta nomina gia' la dieta, non si ripete.
export const DIETE = {
    vegetariano:   { label: 'Vegetariano',   criterio: 'vegetariano',   opzione: 'vegetariane',   come: 'come vegetariani',          parole: ['vegetarian', 'veggie'] },
    vegano:        { label: 'Vegano',        criterio: 'vegano',        opzione: 'vegane',        come: 'come vegani',               parole: ['vegan'] },
    senza_glutine: { label: 'Senza glutine', criterio: 'senza glutine', opzione: 'senza glutine', come: 'con opzioni senza glutine', parole: ['senza glutine', 'gluten', 'celiac'] },
    halal:         { label: 'Halal',         criterio: 'halal',         opzione: 'halal',         come: 'come halal',                parole: ['halal'] },
};

// Tetto di price_level di Google (0 gratis … 4 molto caro) per ogni budget.
// € esclude 3-4; €€ esclude 4; €€€ non esclude niente.
export const BUDGET_MAX_PRICE_LEVEL = { '€': 2, '€€': 3, '€€€': 4 };

// Il wizard di "Crea il tuo percorso" (AiItinerary): fino al P7b ignorato.
export const WIZARD_BUDGET = { Economico: '€', Medio: '€€', Lusso: '€€€' };

export const STILI = {
    autore:    { label: "Cucina d'autore" },
    trattoria: { label: 'Trattoria' },
    street:    { label: 'Street food' },
};

export const FONTI = ['testo', 'wizard', 'dna', 'primo accesso', 'base'];

const uniq = (arr) => [...new Set(arr)];
const asDieta = (arr) => uniq((Array.isArray(arr) ? arr : []).filter(d => DIETE[d]));
const asBudget = (b) => (BUDGET_MAX_PRICE_LEVEL[b] ? b : null);
const asStile = (s) => (STILI[s] ? s : null);

// ─── Il seme del primo accesso ───────────────────────────────────────────────
//
// onboarding_seed (jsonb) ha due forme:
//   • vecchia: ["food", "arte"]            — solo interessi (array di id CORE)
//   • nuova:   { v: 2, interessi: [...], vincoli: { dieta, budget }, gusti: { stile } }
// [] resta lo "skip esplicito". Chi legge passa sempre da qui.
export const parseSeed = (raw) => {
    if (Array.isArray(raw)) {
        return { interessi: raw.filter(x => typeof x === 'string'), vincoli: { dieta: [], budget: null }, gusti: { stile: null } };
    }
    if (raw && typeof raw === 'object') {
        const interessi = Array.isArray(raw.interessi) ? raw.interessi.filter(x => typeof x === 'string') : [];
        return {
            interessi,
            vincoli: { dieta: asDieta(raw.vincoli?.dieta), budget: asBudget(raw.vincoli?.budget) },
            gusti: { stile: asStile(raw.gusti?.stile) },
        };
    }
    return null;
};

export const buildSeed = ({ interessi = [], dieta = [], budget = null, stile = null } = {}) => ({
    v: 2,
    interessi: uniq(interessi.filter(x => typeof x === 'string')),
    vincoli: { dieta: asDieta(dieta), budget: asBudget(budget) },
    gusti: { stile: asStile(stile) },
});

// Le preferenze a tavola del seme, nella forma che il motore riceve.
export const seedFoodPrefs = (raw) => {
    const s = parseSeed(raw);
    if (!s) return { dieta: [], budget: null, stile: null };
    return { dieta: s.vincoli.dieta, budget: s.vincoli.budget, stile: s.gusti.stile };
};

// ─── Cosa dice il TESTO scritto ──────────────────────────────────────────────
// Lessico chiuso, a parola intera. Il testo e' la fonte piu' alta: se nomina una
// dieta o un budget vince; se nomina carne o pesce, la dieta vegetariana/vegana
// del primo accesso non si applica a quella richiesta (l'utente ha chiesto
// altro, e lo ha scritto).
const parola = (w) => new RegExp(`(^|[^a-zà-ù])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zà-ù])`, 'i');
const TESTO_DIETA = {
    vegetariano: ['vegetariano', 'vegetariana', 'vegetariani', 'vegetariane', 'veggie'],
    vegano: ['vegano', 'vegana', 'vegani', 'vegane', 'vegan'],
    senza_glutine: ['senza glutine', 'gluten free', 'celiaco', 'celiaca', 'celiaci'],
    halal: ['halal'],
};
const TESTO_CARNE_PESCE = ['pesce', 'carne', 'bistecca', 'fiorentina', 'salumi', 'frutti di mare', 'sushi', 'crudo', 'porchetta', 'pollo', 'vaccinara', 'amatriciana', 'carbonara'];
const TESTO_MAIALE = ['maiale', 'porchetta', 'salumi', 'guanciale', 'carbonara', 'amatriciana'];
const TESTO_BUDGET = {
    '€': ['economico', 'economica', 'economici', 'low cost', 'spendere poco', 'spendendo poco', 'poco costoso', 'budget basso', 'a buon mercato'],
    '€€€': ['lusso', 'stellato', 'stellati', 'gourmet', 'alta cucina', 'fine dining'],
};

export const textFoodSignals = (userPrompt) => {
    const t = String(userPrompt || '').toLowerCase();
    if (!t.trim()) return { dieta: [], budget: null, carneOPesce: false, maiale: false };
    const dieta = Object.entries(TESTO_DIETA).filter(([, ws]) => ws.some(w => parola(w).test(t))).map(([d]) => d);
    const budget = Object.entries(TESTO_BUDGET).find(([, ws]) => ws.some(w => parola(w).test(t)))?.[0] || null;
    return {
        dieta,
        budget,
        carneOPesce: TESTO_CARNE_PESCE.some(w => parola(w).test(t)),
        maiale: TESTO_MAIALE.some(w => parola(w).test(t)),
    };
};

/**
 * La gerarchia, applicata. Ogni dimensione prende il valore dalla fonte piu'
 * alta che ne dice qualcosa; una fonte piu' bassa non scavalca mai.
 *   dieta:  testo → primo accesso (il wizard e il DNA non hanno una dieta).
 *           Se il testo chiede carne/pesce (o maiale), la dieta del primo
 *           accesso che lo contraddice non si applica a questa richiesta.
 *   budget: testo → wizard → primo accesso.
 *   stile:  primo accesso (e' un gusto: spinta, non vincolo).
 * @returns {{ dieta: string[], dietaFonte: string|null, budget: string|null,
 *   budgetFonte: string|null, maxPriceLevel: number|null, stile: string|null,
 *   stileFonte: string|null, dietaSospesa: string[] }}
 */
export const resolveFoodPrefs = ({ userPrompt = '', wizardBudget = null, onboarding = null } = {}) => {
    const testo = textFoodSignals(userPrompt);
    const primo = onboarding || { dieta: [], budget: null, stile: null };

    let dieta = [];
    let dietaFonte = null;
    const dietaSospesa = [];
    if (testo.dieta.length > 0) {
        dieta = testo.dieta; dietaFonte = 'testo';
    } else {
        for (const d of asDieta(primo.dieta)) {
            const contraddetta = ((d === 'vegetariano' || d === 'vegano') && testo.carneOPesce) || (d === 'halal' && testo.maiale);
            if (contraddetta) dietaSospesa.push(d); else dieta.push(d);
        }
        if (dieta.length > 0) dietaFonte = 'primo accesso';
    }

    const wizard = WIZARD_BUDGET[wizardBudget] || asBudget(wizardBudget);
    const [budget, budgetFonte] = testo.budget ? [testo.budget, 'testo']
        : wizard ? [wizard, 'wizard']
            : asBudget(primo.budget) ? [primo.budget, 'primo accesso']
                : [null, null];

    const stile = asStile(primo.stile);
    return {
        dieta,
        dietaFonte,
        dietaSospesa,
        budget,
        budgetFonte,
        maxPriceLevel: budget ? BUDGET_MAX_PRICE_LEVEL[budget] : null,
        stile,
        stileFonte: stile ? 'primo accesso' : null,
    };
};

export const hasFoodPrefs = (fp) => !!fp && ((fp.dieta?.length || 0) > 0 || !!fp.budget || !!fp.stile);

export const foodPrefsFingerprint = (fp) => (hasFoodPrefs(fp)
    ? `d:${[...(fp.dieta || [])].sort().join('+')}|b:${fp.budget || '-'}|s:${fp.stile || '-'}`
    : '');

// ─── Dieta: la ricerca del cibo ──────────────────────────────────────────────
export const dietCriteria = (dieta) => asDieta(dieta).map(d => DIETE[d].criterio);

// P7b2 — "con opzioni vegetariane", "con opzioni vegetariane e senza glutine".
export const dietOptionPhrase = (dieta) => {
    const o = asDieta(dieta).map(d => DIETE[d].opzione);
    if (o.length === 0) return '';
    return `con opzioni ${o.length === 1 ? o[0] : `${o.slice(0, -1).join(', ')} e ${o[o.length - 1]}`}`;
};

/**
 * Una query del cibo con la dieta AGGIUNTA come opzione: le parole della
 * richiesta (cucina, stile: "romana", "siciliana", "di pesce", "tipica")
 * restano tutte. Le diete gia' nominate nella query non si ripetono.
 */
export const withDietCriteria = (query, dieta) => {
    const q = String(query || '').trim();
    const mancano = asDieta(dieta).filter(d => !DIETE[d].parole.some(w => q.toLowerCase().includes(w)));
    const frase = dietOptionPhrase(mancano);
    return frase ? `${q} ${frase}` : q;
};

/** La query della ricerca mirata del cibo (base del codice), con la dieta come opzione. */
export const dietFoodQuery = (dieta, base = 'ristorante trattoria') => withDietCriteria(base, dieta);

// P7b2 — se la richiesta + la dieta trovano pochi locali, si ALLARGA la
// richiesta tenendo la dieta: "ristorante con opzioni vegetariane". Mai una
// ricerca del cibo senza la dieta: il vincolo resta rigido.
export const DIET_MIN_RESULTS = 3;
export const DIET_WIDE_BASE = 'ristorante';
export const dietSearchChain = (query, dieta) => {
    const prima = withDietCriteria(query, dieta);
    const larga = withDietCriteria(DIET_WIDE_BASE, dieta);
    return prima === larga ? [prima] : [prima, larga];
};

/**
 * Esegue la catena: la prima ricerca; se trova meno di DIET_MIN_RESULTS
 * locali, la ricerca allargata, e unisce (senza doppioni). Ogni risultato e'
 * marcato con la dieta e con la ricerca che lo ha trovato (`_ricercaCibo`).
 * @param {(q: string) => Promise<Array>} run - la ricerca (textsearch)
 * @returns {Promise<{ results: Array, ricerche: string[] }>}
 */
export const searchFoodWithDiet = async (run, query, dieta) => {
    const chain = dietSearchChain(query, dieta);
    const seen = new Set();
    const results = [];
    const ricerche = [];
    for (const q of chain) {
        if (ricerche.length > 0 && results.length >= DIET_MIN_RESULTS) break;
        let found;
        if (ricerche.length === 0) {
            found = await run(q); // la prima: un errore arriva a chi chiama (rete giu' non e' "non trovo")
        } else {
            try { found = await run(q); } catch { break; } // l'allargamento non fa cadere quello che c'e'
        }
        ricerche.push(q);
        for (const c of markDietSearched(found, dieta, q)) {
            const id = c.place_id || c.googlePlaceId || c.name;
            if (seen.has(id)) continue;
            seen.add(id);
            results.push(c);
        }
    }
    return { results, ricerche };
};

/** Marca i candidati arrivati da una ricerca con il criterio (e quale ricerca). */
export const markDietSearched = (candidates, dieta, ricerca = null) => (Array.isArray(candidates) ? candidates : [])
    .map(c => ({ ...c, _dietaCercata: asDieta(dieta), ...(ricerca ? { _ricercaCibo: ricerca } : {}) }));

const dietOk = (c, dieta) => {
    const cercata = Array.isArray(c?._dietaCercata) ? c._dietaCercata : [];
    return dieta.every(d => cercata.includes(d));
};

/** La riga onesta a schermo. Mai "e' vegetariano": "cercati come". */
export const dietNoteLine = (dieta) => {
    const ds = asDieta(dieta);
    if (ds.length === 0) return null;
    const parts = ds.map(d => DIETE[d].come);
    const elenco = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
    return `Locali cercati ${elenco}: verifica sul posto.`;
};

// ─── Budget e dieta: il filtro rigido ────────────────────────────────────────
export const priceLevelOf = (c) => (Number.isFinite(c?.price_level) ? c.price_level : null);

export const passesBudget = (c, maxPriceLevel) => {
    if (!Number.isFinite(maxPriceLevel)) return true;
    const pl = priceLevelOf(c);
    return pl === null || pl <= maxPriceLevel;
};

/**
 * Il filtro dei vincoli. Budget: su tutti i candidati con un price_level noto.
 * Dieta: solo sui posti dove mangiare, che restano solo se trovati da una
 * ricerca con il criterio. Restituisce anche cosa ha tolto e perche'.
 */
export const applyFoodConstraints = (candidates, fp, isMeal = () => false) => {
    const tolti = [];
    const list = Array.isArray(candidates) ? candidates : [];
    if (!fp) return { candidates: list, tolti };
    const dieta = asDieta(fp.dieta);
    const out = list.filter(c => {
        if (!passesBudget(c, fp.maxPriceLevel)) {
            tolti.push({ name: c?.name || c?.title, motivo: `price_level ${priceLevelOf(c)} sopra il budget ${fp.budget}` });
            return false;
        }
        if (dieta.length > 0 && isMeal(c) && !dietOk(c, dieta)) {
            tolti.push({ name: c?.name || c?.title, motivo: `non cercato con il criterio "${dietCriteria(dieta).join(', ')}"` });
            return false;
        }
        return true;
    });
    return { candidates: out, tolti };
};

// ─── Stile a tavola: la spinta ───────────────────────────────────────────────
// Nessuno escluso: si somma al punteggio di Gate MERITO dei soli posti dove
// mangiare. Un price_level sconosciuto, con un budget scelto, vale un po' meno.
export const STILE_BONUS = 0.12;
export const PREZZO_IGNOTO_MALUS = 0.04;

const NOME_TRATTORIA = /\b(osteria|osterie|trattoria|trattorie|hostaria|taverna|fraschetta|bottega)\b/i;
const NOME_STREET = /\b(forno|panificio|street|friggitoria|rosticceria|paninoteca|panino|pizza al taglio|mercato|kebab|arancin|supplì|suppli|tavola calda)\b/i;

export const matchesStile = (c, stile) => {
    const types = Array.isArray(c?.types) ? c.types : [];
    const name = String(c?.name || c?.title || '');
    if (stile === 'autore') return (priceLevelOf(c) ?? 0) >= 3 && (Number(c?.rating) || 0) >= 4.5;
    if (stile === 'trattoria') return NOME_TRATTORIA.test(name);
    if (stile === 'street') return types.includes('meal_takeaway') || types.includes('bakery') || NOME_STREET.test(name);
    return false;
};

export const foodPrefBonus = (c, fp, isMeal = () => false) => {
    if (!fp || !isMeal(c)) return 0;
    let b = 0;
    if (fp.stile && matchesStile(c, fp.stile)) b += STILE_BONUS;
    if (Number.isFinite(fp.maxPriceLevel) && priceLevelOf(c) === null) b -= PREZZO_IGNOTO_MALUS;
    return b;
};

// ─── Il prompt del selettore: la regola, in chiaro ───────────────────────────
export const hierarchyPromptBlock = (fp) => {
    const righe = [
        '\n\nGERARCHIA DELLE FONTI (la regola, dalla piu\' alta alla piu\' bassa):',
        '   1. la richiesta scritta dall\'utente',
        '   2. le scelte del modulo (wizard)',
        '   3. il profilo implicito (DNA)',
        '   4. le risposte del primo accesso',
        '   5. la base',
        '   Una fonte piu\' bassa non scavalca MAI una piu\' alta: se il profilo o il primo',
        '   accesso dicono una cosa e la richiesta scritta un\'altra, vale la richiesta.',
    ];
    if (fp && (fp.dieta?.length || fp.budget)) {
        righe.push('   Dieta e budget sono gia\' applicati dal codice ai candidati qui sotto: non dire mai che un locale "e\' vegetariano", "e\' vegano", "e\' senza glutine" o "e\' halal".');
    }
    if (fp?.stile) {
        righe.push(`   Gusto a tavola (primo accesso, solo una preferenza): ${STILI[fp.stile].label}.`);
    }
    return righe.join('\n');
};

// ─── Cache locale del seme ───────────────────────────────────────────────────
// Stessa chiave di useAILearning/Onboarding (ONBOARDING_SEED_KEY) e della
// pulizia al logout (AuthContext). Serve a chi non ha il hook a portata
// (le notifiche). Illeggibile o assente → nessuna preferenza, mai un default.
const LOCAL_SEED_KEY = 'unnivai_onboarding_seed_v1';
export const readLocalFoodPrefs = () => {
    try {
        const raw = localStorage.getItem(LOCAL_SEED_KEY);
        return raw ? seedFoodPrefs(JSON.parse(raw)) : { dieta: [], budget: null, stile: null };
    } catch {
        return { dieta: [], budget: null, stile: null };
    }
};
