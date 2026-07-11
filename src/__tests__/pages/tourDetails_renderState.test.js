// Gate E-1 — Test della funzione pura getTourRenderState.
//
// Copre la regressione di prod ("TypeError: Cannot read properties of null
// (reading 'id')" al click su un tour dalla Dashboard). Prima di Gate E-1
// il componente aveva un fallbackData mock (tourDetailsMock, ucciso in
// Gate D-1) che manteneva `tour` sempre truthy. Rimuoverlo senza early
// return prima degli accessi a tour.type/tour.steps/tour.id ha causato il
// crash. Ora la funzione pura decide 'skeleton'/'not-found'/'ready' e il
// componente fa early return prima di leggere qualsiasi campo di tour.

import { describe, it, expect } from 'vitest';
import { getTourRenderState } from '../../pages/TourDetails';

describe('Gate E-1 — getTourRenderState', () => {
    it('ready quando c\'è un tour (localTour o queryTour truthy)', () => {
        const state = getTourRenderState({
            hasTour: true,
            isLikelyDbId: true,
            isQueryLoading: false,
            isQueryError: false,
        });
        expect(state).toBe('ready');
    });

    it('skeleton mentre fetching un UUID reale, senza localTour', () => {
        const state = getTourRenderState({
            hasTour: false,
            isLikelyDbId: true,
            isQueryLoading: true,
            isQueryError: false,
        });
        expect(state).toBe('skeleton');
    });

    it('not-found quando id NON è UUID e non c\'è localTour', () => {
        // URL con id sconosciuto (es. "/tour-details/xyz-legacy") → useQuery
        // ha enabled: false → non gira → renderState deve essere not-found.
        const state = getTourRenderState({
            hasTour: false,
            isLikelyDbId: false,
            isQueryLoading: false,
            isQueryError: false,
        });
        expect(state).toBe('not-found');
    });

    it('not-found quando UUID valido ma fetch conclusa senza risultato', () => {
        // getTourById → null → hasTour=false, isQueryLoading=false → not-found.
        const state = getTourRenderState({
            hasTour: false,
            isLikelyDbId: true,
            isQueryLoading: false,
            isQueryError: false,
        });
        expect(state).toBe('not-found');
    });

    it('not-found quando query in errore (rete/RLS)', () => {
        // Mostriamo not-found onesto anche in errore invece che restare in
        // skeleton perpetuo (loading:true a vita se retry disabled).
        const state = getTourRenderState({
            hasTour: false,
            isLikelyDbId: true,
            isQueryLoading: true,
            isQueryError: true,
        });
        expect(state).toBe('not-found');
    });

    it('ready ha priorità: se c\'è un tour, non entra mai in skeleton/not-found', () => {
        // hasTour truthy + isQueryLoading true (ad es. background refresh) →
        // continua a mostrare il tour, non torna a skeleton.
        const state = getTourRenderState({
            hasTour: true,
            isLikelyDbId: true,
            isQueryLoading: true,
            isQueryError: false,
        });
        expect(state).toBe('ready');
    });
});
