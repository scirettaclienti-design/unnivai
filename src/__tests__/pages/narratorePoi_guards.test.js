// Gate NARRATORE/POI — Fase 2a: guard dei consumatori di generateItinerary.
//
// Il motore restituisce, in due rami distinti (aiRecommendationService.js:1183-1193
// e :1211-1223), un payload onesto quando non ha tappe da servire:
//   { days: [{ stops: [] }], _source: 'no-results', _query, _categoria, _oggetto_umano }
//
// Il tranello è che `days` ha length 1: un check su `days.length === 0` non
// scatta mai. Due consumatori su quattro ci cascavano — SurpriseTour navigava
// su un tour a zero tappe, regenerateDay sostituiva il giorno visualizzato con
// uno vuoto.
//
// Le due funzioni testate qui sono quelle che girano in produzione (stesso
// pattern di getTourRenderState, Gate E-1): il componente le chiama e applica
// la decisione, non ne ha una sua.

import { describe, it, expect } from 'vitest';
import { getSurpriseOutcome } from '../../pages/SurpriseTour';
import { shouldReplaceDay } from '../../pages/AiItinerary';

// Payload reale del motore, copiato dalla forma di aiRecommendationService.js:1186-1192.
const NO_RESULTS = {
    days: [{ stops: [] }],
    _source: 'no-results',
    _query: ['spiagge Ippocampo'],
    _categoria: 'natura',
    _oggetto_umano: 'spiagge',
};

// Tour valido a una tappa (caso Gate I _singleStop: 1 posto vero > 0 posti).
const TOUR_OK = {
    days: [{
        day: 1,
        title: 'Un pomeriggio a Ippocampo',
        stops: [{ title: 'Torre Capitania', description: 'Il mare si sente prima di vederlo', latitude: 41.5, longitude: 15.9 }],
    }],
    _source: 'google-first',
    _singleStop: true,
};

describe('Gate NARRATORE/POI Fase 2a — SurpriseTour.getSurpriseOutcome', () => {
    it("payload onesto { days: [{ stops: [] }] } → 'empty', nessuna navigazione", () => {
        expect(getSurpriseOutcome(NO_RESULTS)).toBe('empty');
    });

    it("tour valido → 'ready' (NON-REGRESSIONE: il guard non deve bloccare i tour buoni)", () => {
        expect(getSurpriseOutcome(TOUR_OK)).toBe('ready');
    });

    it("tour valido a più tappe → 'ready' (NON-REGRESSIONE)", () => {
        expect(getSurpriseOutcome({
            days: [{ stops: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }],
        })).toBe('ready');
    });

    it("il check storico su days.length NON avrebbe intercettato il payload onesto", () => {
        // È la ragione per cui il guard esiste: days.length vale 1, non 0.
        expect(NO_RESULTS.days.length).toBe(1);
        expect(getSurpriseOutcome(NO_RESULTS)).not.toBe('ready');
    });

    it("assenza di risposta o days vuoto → 'error' (comportamento storico preservato)", () => {
        expect(getSurpriseOutcome(null)).toBe('error');
        expect(getSurpriseOutcome(undefined)).toBe('error');
        expect(getSurpriseOutcome({})).toBe('error');
        expect(getSurpriseOutcome({ days: [] })).toBe('error');
    });

    it("stops assente o non-array → 'empty', non un crash", () => {
        expect(getSurpriseOutcome({ days: [{}] })).toBe('empty');
        expect(getSurpriseOutcome({ days: [{ stops: null }] })).toBe('empty');
        expect(getSurpriseOutcome({ days: [{ stops: 'niente' }] })).toBe('empty');
    });
});

describe('Gate NARRATORE/POI Fase 2a — AiItinerary.shouldReplaceDay', () => {
    it('nuovo giorno con stops: [] → NON sostituire (il giorno vecchio resta)', () => {
        expect(shouldReplaceDay(NO_RESULTS.days[0])).toBe(false);
    });

    it('nuovo giorno valido → sostituire (NON-REGRESSIONE: la rigenerazione deve funzionare)', () => {
        expect(shouldReplaceDay(TOUR_OK.days[0])).toBe(true);
    });

    it('{ stops: [] } è truthy: è il motivo per cui `if (newDay)` non bastava', () => {
        const emptyDay = NO_RESULTS.days[0];
        expect(Boolean(emptyDay)).toBe(true);      // il vecchio check passava
        expect(shouldReplaceDay(emptyDay)).toBe(false); // il nuovo no
    });

    it('giorno assente o malformato → NON sostituire', () => {
        expect(shouldReplaceDay(undefined)).toBe(false);
        expect(shouldReplaceDay(null)).toBe(false);
        expect(shouldReplaceDay({})).toBe(false);
        expect(shouldReplaceDay({ stops: null })).toBe(false);
    });
});
