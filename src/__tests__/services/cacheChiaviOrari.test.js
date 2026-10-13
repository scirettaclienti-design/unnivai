// ORARI — col passaggio alla ricerca nuova le chiavi di cache del browser cambiano versione:
// nessuno riceve per 24 ore pool dei posti o giri senza orari (e senza la regola).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(p, 'utf8');

describe('chiavi di cache del browser dopo il passaggio alla ricerca nuova', () => {
    it('i pool dei posti: gg4_ (non piu\' gg1_ ne\' gg2_)', () => {
        const s = src('src/services/placesDiscoveryService.js');
        expect(s).toContain('`gg4_${cityName');
        expect(s).not.toMatch(/`gg[123]_\$\{cityName/);
    });
    it('itinerari e tour Per Te in cache: nuova versione del prefisso', () => {
        const s = src('src/services/aiRecommendationService.js');
        expect(s).toContain("const INSIDER_CACHE_PREFIX = 'unnivai_insiderf14_festivi_';");
        expect(s).not.toContain("'unnivai_insiderf13_tipi_';");
        expect(s).not.toContain("'unnivai_insiderf12_orari_';");
        expect(s).not.toContain("'unnivai_insiderf11_composto_';");
    });
});
