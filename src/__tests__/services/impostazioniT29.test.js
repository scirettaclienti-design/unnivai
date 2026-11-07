import { describe, it, expect, vi } from 'vitest';
import { foodPrefBonus, resolveFoodPrefs, hierarchyPromptBlock, BUDGET_BONUS } from '../../lib/foodPrefs';
import { chipDegliInteressi, postoDelChip, bonusInteressi, ricercheDegliInteressi, ricercaDelBudget, bonusUmore, rigaInteressi, BONUS_INTERESSE, RICERCHE_INTERESSI_MAX } from '../../lib/interessiGiro';
import { buildSelectorSystemPrompt, candidateMatchesIntentCategoria, maxTokensSelettore } from '../../services/aiRecommendationService';
import { giroDnaPerMotore, dnaGiroDaApprendimento } from '../../lib/giroDna';
import { repairMomentSelection } from '../../services/momentSelection';

// T29 IMPOSTAZIONI-VERIFICA — ogni impostazione cambia il giro. I difetti misurati a selettore spento (Roma e Catania): i chip Interessi con
// una frase erano giri IDENTICI, Medio e Lusso erano il giro senza budget, il Gruppo di Al volo non arrivava al motore, con «storia» il filtro di
// categoria lasciava 1 posto su 38, le spinte del merito non arrivavano al riparatore.

const trattoria = (prezzo) => ({ name: 'Da Enzo', types: ['restaurant'], price_level: prezzo });
const isMeal = (c) => (c.types || []).includes('restaurant');

describe('budget: sceglie, non solo esclude', () => {
    it('ogni budget del modulo spinge i locali della sua fascia', () => {
        const fp = (b) => resolveFoodPrefs({ wizardBudget: b });
        expect(foodPrefBonus(trattoria(1), fp('Economico'), isMeal)).toBeCloseTo(BUDGET_BONUS);
        expect(foodPrefBonus(trattoria(2), fp('Economico'), isMeal)).toBe(0);
        expect(foodPrefBonus(trattoria(2), fp('Medio'), isMeal)).toBeCloseTo(BUDGET_BONUS);
        expect(foodPrefBonus(trattoria(3), fp('Lusso'), isMeal)).toBeCloseTo(BUDGET_BONUS);
        expect(foodPrefBonus(trattoria(4), fp('Lusso'), isMeal)).toBeCloseTo(BUDGET_BONUS);
        expect(foodPrefBonus(trattoria(2), fp('Lusso'), isMeal)).toBe(0);
    });
    it('senza budget nessuna spinta; un posto che non e\' un pasto non conta', () => {
        expect(foodPrefBonus(trattoria(3), resolveFoodPrefs({}), isMeal)).toBe(0);
        expect(foodPrefBonus({ types: ['museum'], price_level: 3 }, resolveFoodPrefs({ wizardBudget: 'Lusso' }), isMeal)).toBe(0);
    });
    it('il selettore vede il prezzo e la fascia scelta; senza budget il prompt non cambia', () => {
        const fp = resolveFoodPrefs({ wizardBudget: 'Lusso' });
        const base = { city: 'Roma', timeContext: 'ora', prefs: {}, aiProfile: '', cityCenter: null, userPrompt: 'x', intent: null, candidates: [{ place_id: 'a', name: 'A', price_level: 3, types: [] }] };
        const con = buildSelectorSystemPrompt({ ...base, foodPrefs: fp });
        expect(con).toMatch(/"price_level": 3/);
        expect(con).toMatch(/price_level 3 o 4/);
        expect(buildSelectorSystemPrompt(base)).not.toMatch(/price_level/);
        expect(hierarchyPromptBlock(resolveFoodPrefs({}))).not.toMatch(/Budget scelto/);
    });
    it('una ricerca sola, solo per il budget del modulo e solo se la fascia manca', () => {
        const fascia = (c) => c.price_level >= 3;
        const lusso = resolveFoodPrefs({ wizardBudget: 'Lusso' });
        expect(ricercaDelBudget(lusso, [trattoria(2), trattoria(3)], fascia)).toMatchObject({ customKind: 'FOOD' });
        expect(ricercaDelBudget(lusso, [trattoria(3), trattoria(3), trattoria(4)], fascia)).toBeNull();
        expect(ricercaDelBudget(resolveFoodPrefs({ wizardBudget: 'Medio' }), [], fascia)).toBeNull();
        expect(ricercaDelBudget(resolveFoodPrefs({ onboarding: { dieta: [], budget: '€€€', stile: null } }), [], fascia)).toBeNull();
    });
});

describe('interessi: i chip di Su misura', () => {
    const museo = { types: ['art_museum', 'museum'], primaryType: 'art_museum' };
    const parco = { types: ['park'], primary_type: 'city_park' };
    const statua = { types: ['monument', 'tourist_attraction'] };
    it('valgono solo in Su misura e solo se hanno un tipo di posto', () => {
        expect(chipDegliInteressi({ interests: ['Arte', 'Vita Notturna', 'boh'] }, 'custom')).toEqual(['arte', 'vita notturna']);
        expect(chipDegliInteressi({ interests: ['Natura', 'Parchi e Verde'] }, 'quick')).toEqual([]);
        expect(chipDegliInteressi({ interests: ['Arte'] }, undefined)).toEqual([]);
    });
    it('Arte e Storia sono due chip diversi', () => {
        expect(postoDelChip(museo, 'arte')).toBe(true);
        expect(postoDelChip(statua, 'arte')).toBe(false);
        expect(postoDelChip(statua, 'storia')).toBe(true);
        expect(postoDelChip(parco, 'natura')).toBe(true);
    });
    it('conta il tipo principale: il Foro Romano non e\' un museo d\'arte, una pasticceria non e\' shopping', () => {
        expect(postoDelChip({ types: ['tourist_attraction', 'museum'], primaryType: 'historical_landmark' }, 'arte')).toBe(false);
        expect(postoDelChip({ types: ['pastry_shop', 'store'], primary_type: 'pastry_shop' }, 'shopping')).toBe(false);
    });
    it('una spinta sola, anche con due chip', () => {
        expect(bonusInteressi({ types: ['museum', 'monument'] }, ['arte', 'storia'])).toBe(BONUS_INTERESSE);
        expect(bonusInteressi(parco, ['arte'])).toBe(0);
    });
    it('la ricerca del chip parte solo se mancano posti del suo tipo, una per giro', () => {
        expect(ricercheDegliInteressi(['arte'], [museo, museo])).toEqual([]);
        expect(ricercheDegliInteressi(['arte'], [museo]).map(r => r.chip)).toEqual(['arte']);
        expect(ricercheDegliInteressi(['arte', 'storia', 'natura', 'shopping'], [])).toHaveLength(RICERCHE_INTERESSI_MAX);
        expect(ricercheDegliInteressi(['vita notturna'], [])).toEqual([]);
    });
    it('il selettore legge i chip', () => {
        expect(rigaInteressi([])).toBe('');
        const p = buildSelectorSystemPrompt({ city: 'Roma', timeContext: 'ora', prefs: {}, aiProfile: '', cityCenter: null, userPrompt: 'x', intent: null, candidates: [], chipInteressi: ['arte', 'natura'] });
        expect(p).toMatch(/interessi scelti: arte, natura/);
    });
    it('in Al volo un posto trovato dalla ricerca dell\'umore ha la spinta', () => {
        expect(bonusUmore({ _ricerca: 'parco' })).toBe(BONUS_INTERESSE);
        expect(bonusUmore({})).toBe(0);
    });
});

describe('ritmo nel prompt del selettore', () => {
    it('il ritmo Intenso del modulo (con la maiuscola) arriva', () => {
        const p = buildSelectorSystemPrompt({ city: 'Roma', timeContext: 'ora', prefs: { pace: 'Intenso' }, aiProfile: '', cityCenter: null, userPrompt: 'x', intent: null, candidates: [] });
        expect(p).toMatch(/con qualche mezzo/);
    });
});

describe('durata 2-3 Giorni', () => {
    it('il selettore ha i token per tutte le tappe; un giorno resta a 1000', () => {
        expect(maxTokensSelettore(Array(6).fill({ stops: 2 }))).toBe(1000);
        expect(maxTokensSelettore(Array(18).fill({ stops: 2 }))).toBe(2360);
        expect(maxTokensSelettore()).toBe(1000);
    });
});

describe('categoria: storia, arte e cultura sono una famiglia', () => {
    it('un monumento con tourist_attraction e museum resta in «storia» e in «arte»', () => {
        const arco = { types: ['historical_landmark', 'monument', 'tourist_attraction', 'museum', 'point_of_interest'] };
        expect(candidateMatchesIntentCategoria(arco, 'storia')).toBe(true);
        expect(candidateMatchesIntentCategoria(arco, 'arte')).toBe(true);
        expect(candidateMatchesIntentCategoria(arco, 'cultura')).toBe(true);
    });
    it('un ristorante o un parco restano fuori', () => {
        expect(candidateMatchesIntentCategoria({ types: ['restaurant', 'food'] }, 'storia')).toBe(false);
        expect(candidateMatchesIntentCategoria({ types: ['park'] }, 'storia')).toBe(false);
        expect(candidateMatchesIntentCategoria({ types: ['museum', 'tourist_attraction'] }, 'natura')).toBe(false);
    });
});

describe('gruppo e ritmo di Al volo', () => {
    it('senza ritmo scelto il gruppo In famiglia ha il passo Tranquillo, come in Su misura', () => {
        const dna = dnaGiroDaApprendimento({}, { scelto: '', gruppo: 'In famiglia' });
        const g = giroDnaPerMotore(dna, { pace: '', group: 'In famiglia' });
        expect(g.famiglia).toBe(true);
        expect(g.passo).toBe('rilassato');
        expect(g.sostaPasto).toEqual({ pranzo: 75, cena: 75 });
    });
    it('Con gli amici e In coppia hanno i loro pasti', () => {
        expect(giroDnaPerMotore(dnaGiroDaApprendimento({}, { gruppo: 'Con gli amici' }), {}).sostaPasto.cena).toBe(90);
        expect(giroDnaPerMotore(dnaGiroDaApprendimento({}, { gruppo: 'In coppia' }), {}).sostaPasto.cena).toBe(90);
    });
});

describe('la spinta arriva al riparatore', () => {
    const ora = (h) => new Date(`2026-11-05T${String(h).padStart(2, '0')}:00:00+01:00`);
    const posto = (id, lat, extra = {}) => ({ place_id: id, name: id, latitude: lat, longitude: 12.48, rating: 4.5, user_ratings_total: 500, types: ['museum'], ...extra });
    const moments = [{ id: 'g1-mattina', key: 'mattina', label: 'Mattina', dayIndex: 0, start: ora(10), end: ora(12), minutes: 120, stops: 1, categories: ['musei'] }];
    const candidati = [posto('primo', 41.9, { rating: 4.8 }), posto('secondo', 41.9002, { rating: 4.2 })];
    const scelto = (spinta) => repairMomentSelection({ moments, buckets: new Map([['g1-mattina', candidati]]), aiStops: [], pool: candidati, dnaWeights: {}, spinta })
        .plan[0].stops[0].candidate.place_id;
    it('senza spinta vince il merito, con la spinta il posto spinto', () => {
        expect(scelto(null)).toBe('primo');
        expect(scelto((c) => (c.place_id === 'secondo' ? BONUS_INTERESSE : 0))).toBe('secondo');
    });
});
