// NAV-TRATTI — il percorso si legge come una guida: arancione SOLO il tratto verso la prossima tappa, il fatto grigio scuro attenuato,
// il futuro grigio sottile; a ogni arrivo si accende il tratto dopo. Prova la scelta dei tratti (pura) e i colori sui pixel VERI delle mappe.
import { describe, it, expect } from 'vitest';
import { trattiDaDisegnare, primoTrattoVersoProssima, chiaveTratto, stileTratto, ACCENTO_TRATTO, COLORE_FATTO_NAV, COLORE_RESTO_NAV } from '@/hooks/useTourRouting';

// 4 tappe in fila sull'equatore-ish (≈ 111 m ogni 0,001°): T0 → T1 → T2 → T3, e una posizione dell'utente prima di T0
const T = [0, 1, 2, 3].map(i => ({ lat: 37.5, lng: 15.08 + i * 0.002 }));
const U = { lat: 37.5, lng: 15.077 };
const via = (a, b) => [a, { lat: (a.lat + b.lat) / 2 + 0.0001, lng: (a.lng + b.lng) / 2 }, b];
const cacheDi = (n) => { const m = new Map(); for (let k = 0; k + 1 < n; k++) m.set(chiaveTratto(T[k], T[k + 1]), via(T[k], T[k + 1])); return m; };
const stati = (r) => r.map(x => x.stato);

describe('primoTrattoVersoProssima — il percorso dal vivo parte da te?', () => {
    it('tu → tappa 0, prossima = tappa 0: sì', () => {
        expect(primoTrattoVersoProssima([via(U, T[0]), via(T[0], T[1])], { tappe: T, nextIdx: 0 })).toBe(true);
    });
    it('tappe rimaste (parte dalla prossima e va oltre): no', () => {
        expect(primoTrattoVersoProssima([via(T[1], T[2]), via(T[2], T[3])], { tappe: T, nextIdx: 1 })).toBe(false);
    });
    it('senza percorso o senza prossima: no, senza errori', () => {
        expect(primoTrattoVersoProssima([], { tappe: T, nextIdx: 0 })).toBe(false);
        expect(primoTrattoVersoProssima([via(U, T[0])], { tappe: T, nextIdx: 9 })).toBe(false);
        expect(primoTrattoVersoProssima(null, null)).toBe(false);
    });
    it('funziona anche con punti LatLng di Google (lat()/lng())', () => {
        const g = (p) => ({ lat: () => p.lat, lng: () => p.lng });
        expect(primoTrattoVersoProssima([[g(U), g(T[0])]], { tappe: T, nextIdx: 0 })).toBe(true);
    });
});

describe('trattiDaDisegnare — dall\'inizio a ogni arrivo', () => {
    it('INIZIO (verso la tappa 0, percorso da te): il primo tratto è arancione, gli altri futuri', () => {
        const live = [via(U, T[0]), via(T[0], T[1]), via(T[1], T[2]), via(T[2], T[3])];
        expect(stati(trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 0 }, cache: cacheDi(4) }))).toEqual(['prossimo', 'resto', 'resto', 'resto']);
    });
    it('METÀ TRATTO (ancora verso la tappa 0): sempre uno solo arancione, il primo', () => {
        const live = [via({ lat: 37.5, lng: 15.0785 }, T[0]), via(T[0], T[1]), via(T[1], T[2]), via(T[2], T[3])];
        const r = trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 0 }, cache: new Map() });
        expect(stati(r).filter(s => s === 'prossimo')).toHaveLength(1);
        expect(r[0].stato).toBe('prossimo');
    });
    it('DOPO UN ARRIVO (percorso = tappe rimaste da T1): si accende T0→T1 dalla memoria, il resto è futuro', () => {
        const live = [via(T[1], T[2]), via(T[2], T[3])];
        expect(stati(trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 1 }, cache: cacheDi(4) }))).toEqual(['prossimo', 'resto', 'resto']);
    });
    it('dopo il 2° arrivo: T0→T1 è fatto, T1→T2 è il prossimo, T2→T3 futuro', () => {
        const live = [via(T[2], T[3])];
        expect(stati(trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 2 }, cache: cacheDi(4) }))).toEqual(['fatto', 'prossimo', 'resto']);
    });
    it('dopo il primo arrivo il tratto camminato dalla partenza alla tappa 0 resta, come «fatto», prima del prossimo', () => {
        const live = [via(T[1], T[2]), via(T[2], T[3])];
        const r = trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 1 }, cache: cacheDi(4), partenza: via(U, T[0]) });
        expect(stati(r)).toEqual(['fatto', 'prossimo', 'resto', 'resto']);
    });
    it('giro ripreso con il percorso da te e prossima = T2: fatti T0→T1, il prossimo è il TUO tratto (non si disegna due volte T1→T2)', () => {
        const live = [via(U, T[2]), via(T[2], T[3])];
        const r = trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 2 }, cache: cacheDi(4) });
        expect(stati(r)).toEqual(['fatto', 'prossimo', 'resto']);
        expect(r.filter(x => x.stato === 'prossimo')).toHaveLength(1);
    });
    it('prima del primo segnale GPS (percorso = tappe rimaste, prossima = T0): nessun arancione inventato', () => {
        const live = [via(T[0], T[1]), via(T[1], T[2])];
        expect(stati(trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 0 }, cache: new Map() }))).toEqual(['resto', 'resto']);
    });
    it('fuori dalla navigazione (progress null) tutto resta «resto»', () => {
        expect(stati(trattiDaDisegnare({ live: [via(U, T[0]), via(T[0], T[1])], progress: null }))).toEqual(['resto', 'resto']);
    });
    it('ultimo tratto: mai più di un arancione, in nessun momento del giro', () => {
        for (let next = 0; next < 4; next++) {
            const live = next === 0 ? [via(U, T[0]), via(T[0], T[1]), via(T[1], T[2]), via(T[2], T[3])] : T.slice(next).slice(0, -1).map((a, i) => via(a, T[next + i + 1]));
            const r = trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: next }, cache: cacheDi(4) });
            expect(r.filter(x => x.stato === 'prossimo').length).toBeLessThanOrEqual(1);
        }
    });
});

// ─── i colori veri delle mappe (misurati sul sito pubblicato, 4 stili: Ossidiana e le 3 fasce) ──────────────────────────────────
// docs/prove/dati/2026-10-27-nav-tratti-misura-<fascia>.json: i pixel della mappa senza il percorso. In tutti e 4 gli stili: terra ~rgb(20-28), edifici
// ~rgb(12-20), strade ~rgb(36-44, 28-36, 20).
const FONDI_VERI = { terra: [28, 28, 20], terraScura: [20, 20, 20], edifici: [12, 12, 12], stradaMattina: [36, 28, 20], strada: [44, 36, 20], stradaNotte: [44, 28, 20] };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const rapporto = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

describe('contrasto sui colori veri delle 4 mappe', () => {
    const BASE = { outer: { strokeColor: '#5A5048' }, inner: { strokeColor: '#5A5048', strokeWeight: 4, strokeOpacity: 0.9 } };
    for (const [nome, fondo] of Object.entries(FONDI_VERI)) {
        it(`prossimo (arancione) su ${nome}: ≥ 3:1`, () => { expect(rapporto(rgb(ACCENTO_TRATTO), fondo)).toBeGreaterThanOrEqual(3); });
        it(`futuro (grigio sottile) su ${nome}: ≥ 3:1`, () => { expect(rapporto(rgb(COLORE_RESTO_NAV), fondo)).toBeGreaterThanOrEqual(3); });
        it(`fatto (grigio scuro attenuato) su ${nome}: distinguibile, ≥ 2:1`, () => { expect(rapporto(rgb(COLORE_FATTO_NAV), fondo)).toBeGreaterThanOrEqual(2); });
    }
    it('gerarchia: il fatto è più scuro del futuro, il futuro più scuro dell\'arancione; il futuro è più sottile del prossimo', () => {
        expect(lum(rgb(COLORE_FATTO_NAV))).toBeLessThan(lum(rgb(COLORE_RESTO_NAV)));
        expect(lum(rgb(COLORE_RESTO_NAV))).toBeLessThan(lum(rgb(ACCENTO_TRATTO)) + 0.5);
        const p = stileTratto('prossimo', BASE, { navigazione: true }).inner, r = stileTratto('resto', BASE, { navigazione: true }).inner;
        expect(r.strokeWeight).toBeLessThan(p.strokeWeight);
        expect(p.strokeColor).toBe(ACCENTO_TRATTO);
    });
    it('i grigi si distinguono fra loro (fatto e futuro ≥ 1,3:1)', () => {
        expect(rapporto(rgb(COLORE_FATTO_NAV), rgb(COLORE_RESTO_NAV))).toBeGreaterThanOrEqual(1.3);
    });
});
