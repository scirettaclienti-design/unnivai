// NAV-2 — il banner «Attiva la tua posizione» compare solo se la posizione è davvero negata o assente. 0 $.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ city: { gpsActive: false, gpsCoords: null, requestGPS: () => {} } }));
vi.mock('@/context/CityContext', () => ({ useCity: () => h.city }));
vi.mock('../../context/CityContext', () => ({ useCity: () => h.city }));

import GpsActivationBanner from '@/components/GpsActivationBanner';

const permesso = (stato) => {
    Object.defineProperty(global.navigator, 'permissions', {
        configurable: true,
        value: { query: vi.fn().mockResolvedValue({ state: stato, addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
    });
};

beforeEach(() => { h.city = { gpsActive: false, gpsCoords: null, requestGPS: () => {} }; });
afterEach(() => { cleanup(); try { delete global.navigator.permissions; } catch { /* jsdom */ } });

describe('GpsActivationBanner', () => {
    it('permesso già concesso: il banner scompare (posizione attiva, nessun invito)', async () => {
        permesso('granted');
        render(<GpsActivationBanner />);
        await waitFor(() => expect(screen.queryByText('Attiva la tua posizione')).toBeNull());
    });
    it('permesso negato: il banner c\'è', async () => {
        permesso('denied');
        render(<GpsActivationBanner />);
        await waitFor(() => expect(screen.getByText('Attiva la tua posizione')).toBeInTheDocument());
    });
    it('posizione assente (mai chiesta): il banner c\'è', async () => {
        permesso('prompt');
        render(<GpsActivationBanner />);
        expect(await screen.findByText('Attiva la tua posizione')).toBeInTheDocument();
    });
    it('GPS già letto dall\'app: niente banner, qualunque cosa dica il browser', () => {
        h.city = { gpsActive: true, gpsCoords: { lat: 37.5, lon: 15.08 }, requestGPS: () => {} };
        permesso('prompt');
        render(<GpsActivationBanner />);
        expect(screen.queryByText('Attiva la tua posizione')).toBeNull();
    });
});
