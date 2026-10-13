// ORARI — col passaggio alla ricerca nuova le chiavi di cache del browser cambiano versione:
// nessuno riceve per 24 ore pool dei posti o giri senza orari (e senza la regola).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(p, 'utf8');

describe('chiavi di cache del browser dopo il passaggio alla ricerca nuova', () => {
    it('i pool dei posti: gg5_ (non piu\' gg1_ ne\' gg2_)', () => {
        const s = src('src/services/placesDiscoveryService.js');
        expect(s).toContain('`gg5_${cityName');
        expect(s).not.toMatch(/`gg[1234]_\$\{cityName/);
    });
    it('itinerari e tour Per Te in cache: nuova versione del prefisso', () => {
        const s = src('src/services/aiRecommendationService.js');
        expect(s).toContain("const INSIDER_CACHE_PREFIX = 'unnivai_insiderf17_sera_';");
        expect(s).not.toContain("'unnivai_insiderf16_composizione_';");
        expect(s).not.toContain("'unnivai_insiderf15_continuita_';");
        expect(s).not.toContain("'unnivai_insiderf13_tipi_';");
        expect(s).not.toContain("'unnivai_insiderf12_orari_';");
        expect(s).not.toContain("'unnivai_insiderf11_composto_';");
    });
});
