// Gate INTERESSI-VERI — test di completezza: ogni tema ha una ricerca Google.
//
// Il difetto che chiude: dal Gate P.1 `art` e `walking` non esistevano piu' in
// THEME_TEXTSEARCH, ma derivePrimaryThemes continuava a produrli (e la ricerca
// di riserva puntava a `walking`). Nessun test lo vedeva perche' nessun test
// metteva in fila "temi prodotti" e "temi con una query".
//
// Questo test costruisce l'elenco DAI DATI, non da una lista scritta a mano:
// valori di INTEREST_TO_THEME + mix di riserva + tema di riserva + temi della
// Home. Il giorno in cui qualcuno aggiunge un tema in uno di quei punti senza
// la sua query, diventa rosso da solo.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    derivePrimaryThemes,
    INTEREST_TO_THEME,
    DEFAULT_MIX_THEMES,
} from '../../services/aiRecommendationService';
import {
    THEME_TEXTSEARCH,
    FALLBACK_THEME,
    HOME_THEMES,
    QUALITY_THRESHOLDS,
} from '../../services/placesDiscoveryService';

// Gli interessi che l'utente puo' cliccare in AiItinerary (Percorso B), letti
// dal sorgente: se qualcuno aggiunge un'opzione, entra nel test senza toccarlo.
const aiItinerarySrc = readFileSync(join(process.cwd(), 'src/pages/AiItinerary.jsx'), 'utf8');
const interestsLine = aiItinerarySrc.split('\n').find(l => l.includes("id: 'interests'"));
const SELECTABLE_INTERESTS = [...interestsLine.match(/options:\s*\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

// Tutti i temi che derivePrimaryThemes puo' restituire.
const producibleThemes = () => {
    const out = new Set([...Object.values(INTEREST_TO_THEME), ...DEFAULT_MIX_THEMES]);
    // Anche passando per la funzione vera, non solo per le tabelle.
    for (const key of Object.keys(INTEREST_TO_THEME)) {
        derivePrimaryThemes({ interests: [key] }).forEach(t => out.add(t));
    }
    for (const opt of SELECTABLE_INTERESTS) {
        derivePrimaryThemes({ interests: [opt] }).forEach(t => out.add(t));
    }
    derivePrimaryThemes({}).forEach(t => out.add(t));
    derivePrimaryThemes({ interests: ['qualcosa che nessuno mappa'] }).forEach(t => out.add(t));
    return [...out].sort();
};

const hasSearch = (theme) => {
    const cfg = THEME_TEXTSEARCH[theme];
    return !!cfg
        && typeof cfg.query === 'string' && cfg.query.trim().length > 0
        && Object.prototype.hasOwnProperty.call(QUALITY_THRESHOLDS, cfg.kind);
};

describe('Gate INTERESSI-VERI — completezza temi ↔ ricerche', () => {
    it('legge davvero gli interessi selezionabili di AiItinerary', () => {
        expect(SELECTABLE_INTERESTS).toEqual(['Arte', 'Cibo', 'Storia', 'Natura', 'Shopping', 'Vita Notturna']);
    });

    it('ogni tema che derivePrimaryThemes puo\' produrre ha una ricerca in THEME_TEXTSEARCH', () => {
        const themes = producibleThemes();
        expect(themes.length).toBeGreaterThan(0);
        const senzaRicerca = themes.filter(t => !hasSearch(t));
        expect(senzaRicerca, `temi senza query: ${senzaRicerca.join(', ')}`).toEqual([]);
    });

    it('la ricerca di riserva punta a una chiave che esiste', () => {
        expect(hasSearch(FALLBACK_THEME)).toBe(true);
    });

    it('i temi della Home ("Per Te") hanno tutti una ricerca', () => {
        expect(HOME_THEMES.filter(t => !hasSearch(t))).toEqual([]);
    });

    it('ogni interesse selezionabile produce un tema suo, non cade nel mix di riserva', () => {
        const ignorati = SELECTABLE_INTERESTS.filter(opt => {
            const tokens = String(opt).toLowerCase();
            const mapped = Object.entries(INTEREST_TO_THEME).some(([k]) => tokens === k || tokens.includes(k));
            return !mapped;
        });
        expect(ignorati).toEqual([]);
    });
});
