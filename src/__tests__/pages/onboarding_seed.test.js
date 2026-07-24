import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Gate SEME (L1) — verifica computeSeed (interno a Onboarding, NON esportato)
// attraverso il suo UNICO punto d'accesso pubblico: il wizard renderizzato.
// Si guida la UI e si legge la chiave localStorage scritta a fine flusso.
//
// Mock SOLO di infrastruttura (non della logica del seme):
// - framer-motion: reso passthrough (animazioni fuori scope, timing = flakiness).
// - react-router-dom: useNavigate stub (nessun router reale necessario).
// - AuthContext: user=null → handleComplete salta l'upsert DB ma scrive comunque
//   il seme in localStorage (sync, prima del navigate).
vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set([
        'initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap',
        'whileFocus', 'whileDrag', 'whileInView', 'transition', 'custom',
        'layout', 'layoutId', 'drag', 'dragConstraints',
    ]);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, {
        get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })),
    });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import Onboarding from '../../pages/Onboarding';

const SEED_KEY = 'unnivai_onboarding_seed_v1';
const readSeed = () => JSON.parse(localStorage.getItem(SEED_KEY));
const clickByText = (text) => fireEvent.click(screen.getByText(text).closest('button'));

// welcome → interessi
const gotoInterests = () => clickByText('Iniziamo!');
// interessi → pronto
const gotoReady = () => clickByText('Continua');
// pronto → salva (handleComplete)
const finish = () => clickByText('Entra in DoveVAI');

beforeEach(() => {
    localStorage.clear();
    navigateMock.mockClear();
});

describe('Gate SEME (L1) — derivazione seme dalle voci INTERESTS (via UI)', () => {
    it('selezione ["cultura"] → seme ["cultura","arte"] (accorpamento)', async () => {
        render(createElement(Onboarding));
        gotoInterests();
        clickByText('Storia e arte'); // voce id "cultura", seeds ['cultura','arte']
        gotoReady();
        finish();

        await waitFor(() => expect(localStorage.getItem(SEED_KEY)).not.toBeNull());
        expect(readSeed().sort()).toEqual(['arte', 'cultura']);
    });

    it('selezione di tutte e 7 le voci → 7 id CORE + arte, deduplicati (8 unici)', async () => {
        render(createElement(Onboarding));
        gotoInterests();
        ['Mangiare e bere', 'Storia e arte', 'Natura e panorami', 'Vita notturna',
            'Camminare e scoprire', 'Ritmo lento', 'Shopping e mercati'].forEach(clickByText);
        gotoReady();
        finish();

        await waitFor(() => expect(localStorage.getItem(SEED_KEY)).not.toBeNull());
        const seed = readSeed();
        expect(seed.slice().sort()).toEqual(
            ['arte', 'avventura', 'cultura', 'food', 'natura', 'nightlife', 'relax', 'shopping']
        );
        // nessun duplicato (la voce "cultura" semina cultura+arte, ma resta unico)
        expect(new Set(seed).size).toBe(seed.length);
    });

    it('path "Salta per ora" → seme [] (chiave presente, distinguibile da assente)', () => {
        render(createElement(Onboarding));
        // "Salta per ora" e' visibile fin dallo step 0
        clickByText('Salta per ora');
        expect(localStorage.getItem(SEED_KEY)).toBe('[]');
        expect(readSeed()).toEqual([]);
    });

    // NOTA onesta: "selezione vuota → []" via handleComplete NON e' raggiungibile
    // dalla UI (il bottone Continua/Entra e' disabilitato senza almeno 1 scelta).
    // Il caso "nessun gusto" e' coperto dal path Salta qui sopra. Analogamente
    // "['cultura','arte'] via UI": la voce 'arte' non esiste come voce a se'
    // (arte e' solo un seed di 'cultura'), quindi il caso non e' producibile —
    // la de-duplicazione cross-voce e' comunque garantita dal Set (test sopra).
});
