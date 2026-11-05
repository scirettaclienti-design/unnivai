// LANCIO-ONBOARDING — un giro con due categorie scrive due righe tour_completed (una per categoria, DNA-1:
// i pesi leggono la categoria riga per riga), ma è UN giro per il Profilo e per la fiducia del DNA.
// Caso vero del 05/11 (PASSI-IVANO): Catania 7/7, righe «cultura» e «food» nello stesso istante.
import { describe, it, expect } from 'vitest';
import { righeDelGesto } from '../../lib/dnaRegistro';
import { contatoriDalRegistro, meteDalRegistro } from '../../lib/dnaProfilo';
import { pesiDaEventi } from '../../services/preferenceEngine';

const ORA = '2026-11-05T14:29:56.492Z';
const TOUR = 'ai-itinerary-1793888924947';

const registro = righeDelGesto('tour_completed', { categories: ['cultura', 'food'], city: 'Catania', tourId: TOUR, value: '7/7' })
    .map((r, i) => ({ ...r, id: `r${i}`, created_at: ORA }));

describe('Un giro con più categorie conta una volta', () => {
    it('il registro ha una riga per categoria (formato di DNA-1, non un doppione)', () => {
        expect(registro).toHaveLength(2);
        expect(registro.map(r => r.category).sort()).toEqual(['cultura', 'food']);
        expect(new Set(registro.map(r => `${r.tour_id}|${r.value}|${r.created_at}`)).size).toBe(1);
    });

    it('il Profilo conta 1 giro, con le due categorie e 7 tappe su 7', () => {
        expect(contatoriDalRegistro(registro).giri).toBe(1);
        const [meta] = meteDalRegistro(registro);
        expect(meta.categorie.sort()).toEqual(['cultura', 'food']);
        expect(meta.tappeTotali).toBe(7);
    });

    it('la fiducia del DNA conta 1 evento, mentre i pesi salgono su entrambe le categorie', () => {
        const r = pesiDaEventi(registro, [], ORA);
        expect(r.eventi).toBe(1);
        expect(r.pesi.cultura).toBeGreaterThan(0);
        expect(r.pesi.food).toBeGreaterThan(0);
    });
});
