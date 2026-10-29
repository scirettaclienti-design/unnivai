import { describe, it, expect } from 'vitest';
import { curiositaDellaCitta, CURIOSITA } from '@/lib/vociTesti';

describe('curiosità: ognuna porta la sua città', () => {
    it('ogni curiosità ha una città e un testo', () => {
        for (const c of CURIOSITA) { expect(c.citta).toBeTruthy(); expect(c.testo).toBeTruthy(); }
    });
    it('Roma sì, Catania no, città ignota no; maiuscole e accenti non contano', () => {
        expect(curiositaDellaCitta('Roma').join(' ')).toMatch(/nasoni/);
        expect(curiositaDellaCitta(' roma ')).toHaveLength(1);
        expect(curiositaDellaCitta('Catania')).toEqual([]);
        expect(curiositaDellaCitta('')).toEqual([]);
        expect(curiositaDellaCitta(null)).toEqual([]);
        expect(curiositaDellaCitta(undefined)).toEqual([]);
    });
    it('nessuna curiosità di Roma compare per un\'altra città, qualunque sia', () => {
        for (const citta of ['Catania', 'Milano', 'Roma Termini', 'Ro']) expect(curiositaDellaCitta(citta)).toEqual([]);
    });
});
