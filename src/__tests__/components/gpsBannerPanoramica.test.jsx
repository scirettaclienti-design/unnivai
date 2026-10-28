// Il banner della posizione nella panoramica: non con il puntino utente visibile, e un permesso negato si dice una volta sola. 0 $.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ city: { gpsActive: false, gpsCoords: null, requestGPS: () => {} } }));
vi.mock('@/context/CityContext', () => ({ useCity: () => h.city }));
vi.mock('../../context/CityContext', () => ({ useCity: () => h.city }));

import GpsActivationBanner from '@/components/GpsActivationBanner';
import { dimenticaBannerNegato } from '@/hooks/useGeoPermesso';

const permesso = (stato) => Object.defineProperty(global.navigator, 'permissions', {
    configurable: true, value: { query: vi.fn().mockResolvedValue({ state: stato, addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
});
beforeEach(() => { dimenticaBannerNegato(); });
afterEach(() => { cleanup(); try { delete global.navigator.permissions; } catch { /* jsdom */ } });

describe('banner posizione nella panoramica', () => {
    it('con il puntino utente sulla mappa (posizioneNota) non compare, anche se il browser non dice niente', async () => {
        permesso('prompt');
        render(<GpsActivationBanner posizioneNota />);
        await new Promise(r => setTimeout(r, 30));
        expect(screen.queryByText('Attiva la tua posizione')).toBeNull();
    });
    it('permesso negato: la prima apertura lo dice, la seconda no', async () => {
        permesso('denied');
        const a = render(<GpsActivationBanner />);
        expect(await screen.findByText('Attiva la tua posizione')).toBeInTheDocument();
        a.unmount();
        render(<GpsActivationBanner />);
        await new Promise(r => setTimeout(r, 30));
        expect(screen.queryByText('Attiva la tua posizione')).toBeNull();
    });
    it('se il permesso torna concesso e poi viene negato di nuovo, il banner si rimostra una volta', async () => {
        permesso('denied');
        let r = render(<GpsActivationBanner />); await screen.findByText('Attiva la tua posizione'); r.unmount();
        permesso('granted');
        r = render(<GpsActivationBanner />); await waitFor(() => expect(screen.queryByText('Attiva la tua posizione')).toBeNull()); r.unmount();
        permesso('denied');
        render(<GpsActivationBanner />);
        expect(await screen.findByText('Attiva la tua posizione')).toBeInTheDocument();
    });
});
