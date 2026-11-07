import { describe, it, expect } from 'vitest';
import { riduciMovimento, inizializzaMovimento } from '@/lib/movimento';

describe('movimento', () => {
    it('riduciMovimento legge la preferenza e non rompe senza matchMedia', () => {
        expect(riduciMovimento({ matchMedia: () => ({ matches: true }) })).toBe(true);
        expect(riduciMovimento({ matchMedia: () => ({ matches: false }) })).toBe(false);
        expect(riduciMovimento({})).toBe(false);
        expect(riduciMovimento({ matchMedia: () => { throw new Error('x'); } })).toBe(false);
    });

    it('segna la pagina nascosta e la toglie quando torna visibile', () => {
        let stato = 'visible';
        const ascoltatori = [];
        const radice = { attrs: new Set(), setAttribute(n) { this.attrs.add(n); }, removeAttribute(n) { this.attrs.delete(n); } };
        const doc = {
            documentElement: radice,
            get visibilityState() { return stato; },
            addEventListener: (_t, f) => ascoltatori.push(f),
            removeEventListener: (_t, f) => ascoltatori.splice(ascoltatori.indexOf(f), 1),
        };
        const stop = inizializzaMovimento(doc);
        expect(radice.attrs.has('data-pagina-nascosta')).toBe(false);
        stato = 'hidden'; ascoltatori.forEach(f => f());
        expect(radice.attrs.has('data-pagina-nascosta')).toBe(true);
        stato = 'visible'; ascoltatori.forEach(f => f());
        expect(radice.attrs.has('data-pagina-nascosta')).toBe(false);
        stop();
        expect(ascoltatori.length).toBe(0);
    });
});
