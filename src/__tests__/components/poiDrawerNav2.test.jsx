// NAV-2 — il pannello in basso della mappa sta nell'altezza visibile (dvh) e sopra la zona sicura: mai tagliato dalla barra di Safari. 0 $.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/services/placesDiscoveryService', () => ({ placesDiscoveryService: { fetchPlaceDetailsForTour: async () => null } }));

import { POIDetailDrawer } from '@/components/Map/POIDetailDrawer';

describe('POIDetailDrawer', () => {
    it('altezza minima e massima in dvh e padding della zona sicura in basso', () => {
        render(<POIDetailDrawer poi={{ title: 'Fontana dell\'Elefante', latitude: 37.5, longitude: 15.08, type: 'monument' }} onClose={() => {}} />);
        const d = document.querySelector('[data-testid="poi-drawer"]');
        expect(d).not.toBeNull();
        expect(d.style.maxHeight).toBe('82dvh');
        expect(d.style.minHeight).toBe('38dvh');
        expect(d.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
    });
});
