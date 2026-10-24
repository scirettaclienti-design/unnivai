// VERITA-TESTI — punti 2, 3 e 4: il caricamento non nomina cose che non fa; «Si comincia da qui» solo se è vero;
// la durata ha un solo formato e una sola fonte.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { render, screen } from '@testing-library/react';
import { stopData, ganciValidi, PRIMA_TAPPA_MAX_M } from '../../lib/stopPhrases';
import { QuickPathSummary } from '../../components/Map/QuickPathSummary';
import { displayedTourMinutes, formatEstimate } from '../../lib/tourTiming';

describe('punto 2 — il testo del caricamento', () => {
    const src = fs.readFileSync('src/pages/AiItinerary.jsx', 'utf8');
    const caricamento = src.slice(src.indexOf('Sto preparando il tuo giro') - 200, src.indexOf('Sto preparando il tuo giro') + 1500);
    it('non nomina guide locali, meteo o «gemme nascoste»', () => {
        expect(src).toContain('Sto preparando il tuo giro');
        expect(caricamento).not.toMatch(/guide locali|meteo|gemme/i);
        expect(src).not.toMatch(/consultando le guide locali|Selezione gemme nascoste/);
    });
    it('dice solo cose che il motore fa: preferenze, posti aperti, ordine a piedi', () => {
        expect(caricamento).toContain('Le tue preferenze');
        expect(caricamento).toContain("Posti aperti all'ora giusta");
        expect(caricamento).toContain('Ordine a piedi');
    });
});

describe('punto 3 — «Si comincia da qui» solo entro 150 m dall’utente', () => {
    const stop = { place_id: 'p1', title: 'Piazza Duomo', types: ['tourist_attraction'] };
    const gancio = (distanzaUtenteM) => ganciValidi(stopData({ stop, primo: true, distanzaUtenteM })).has('prima');
    it('a 100 m e a 150 m sì', () => { expect(gancio(100)).toBe(true); expect(gancio(PRIMA_TAPPA_MAX_M)).toBe(true); });
    it('a 151 m e a 2 km no', () => { expect(gancio(151)).toBe(false); expect(gancio(2000)).toBe(false); });
    it('senza posizione dell’utente no', () => { expect(gancio(null)).toBe(false); expect(gancio(undefined)).toBe(false); });
    it('una tappa che non è la prima non lo dice mai', () => {
        expect(ganciValidi(stopData({ stop, primo: false, distanzaUtenteM: 10 })).has('prima')).toBe(false);
    });
});

describe('punto 4 — la durata è una sola', () => {
    const t0 = new Date('2026-10-25T08:30:00Z').getTime();
    const steps = [
        { title: 'A', scheduledTime: new Date(t0).toISOString(), stayMinutes: 30 },
        { title: 'B', scheduledTime: new Date(t0 + 120 * 60000).toISOString(), stayMinutes: 90 },
    ];
    it('il riepilogo scrive la stessa stringa dell’intestazione (formatEstimate sulle stesse tappe)', () => {
        const attesa = formatEstimate(displayedTourMinutes(steps));
        expect(attesa).toBe('circa 3h 30min');
        render(<QuickPathSummary tourData={{ title: 'Giro', city: 'Catania', steps, duration_minutes: 999 }} choices={{}} onViewMap={() => {}} onHome={() => {}} />);
        expect(screen.getByText(attesa)).toBeInTheDocument();
        expect(screen.queryByText('3h 30m')).toBeNull();
    });
});
