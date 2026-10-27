// Lo stile della mappa di navigazione è lo stile Google vero (Map ID da variabile d'ambiente), non filtri CSS;
// i tratti del percorso si leggono (≥ 3:1) sopra quello stile.
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import { COLORE_FATTO_NAV, COLORE_RESTO_NAV, ACCENTO_TRATTO, stileTratto } from '@/hooks/useTourRouting';

const lum = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const rapporto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('niente più filtri CSS sulla mappa', () => {
    it('il CSS e il contenitore non hanno più lo stile a filtri', () => {
        expect(fs.readFileSync('src/index.css', 'utf8')).not.toMatch(/data-stile-mappa|\.gm-style canvas\s*\{[^}]*filter/);
        expect(fs.readFileSync('src/components/Map/GoogleMapContainer.jsx', 'utf8')).not.toContain('data-stile-mappa');
        expect(fs.existsSync('src/lib/stileMappa.js')).toBe(false);
    });
    it('il Map ID della navigazione sta nelle variabili d\'ambiente (.env.example), letto solo da import.meta.env', () => {
        const ex = fs.readFileSync('.env.example', 'utf8');
        expect(ex).toMatch(/^VITE_GOOGLE_MAP_ID_NAV=[0-9a-f]{24}$/m);
        const sorgente = fs.readFileSync('src/lib/mapId.js', 'utf8');
        expect(sorgente).toContain('import.meta.env.VITE_GOOGLE_MAP_ID_NAV');
    });
});

describe('quale Map ID usa la mappa', () => {
    afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
    const carica = async (nav) => {
        vi.resetModules();
        vi.unstubAllEnvs();
        vi.stubEnv('VITE_GOOGLE_MAP_ID', 'ID_NORMALE');
        vi.stubEnv('VITE_GOOGLE_MAP_ID_NAV', nav);
        return import('@/lib/mapId');
    };
    it('con la variabile: in navigazione l\'ID della navigazione, altrimenti quello di sempre', async () => {
        const m = await carica('ID_NAV');
        expect(m.mapIdPer({ isNavigating: true })).toBe('ID_NAV');
        expect(m.mapIdPer({ isNavigating: false })).toBe('ID_NORMALE');
        expect(m.mapIdPer({})).toBe('ID_NORMALE');
    });
    it('un mapId passato dal chiamante vince', async () => {
        const m = await carica('ID_NAV');
        expect(m.mapIdPer({ isNavigating: true, mapId: 'ID_CHIAMANTE' })).toBe('ID_CHIAMANTE');
    });
    it('senza la variabile (o vuota) la mappa funziona come oggi, anche in navigazione', async () => {
        const m = await carica('');
        expect(m.MAP_ID_NAV).toBeNull();
        expect(m.mapIdPer({ isNavigating: true })).toBe('ID_NORMALE');
    });
});

describe('lo stile Ossidiana: modalità buio e vista dall\'alto', () => {
    afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
    const carica = async (nav) => {
        vi.resetModules(); vi.unstubAllEnvs();
        vi.stubEnv('VITE_GOOGLE_MAP_ID', 'ID_NORMALE'); vi.stubEnv('VITE_GOOGLE_MAP_ID_NAV', nav);
        return import('@/lib/mapId');
    };
    it('con un giro aperto o in navigazione, con la variabile: colorScheme DARK (l\'inclinazione 0 del prompt Ossidiana e\' annullata: la camera si inclina a 45–55°)', async () => {
        const m = await carica('ID_NAV');
        expect(m.opzioniNavigazione({ isNavigating: true })).toEqual({ colorScheme: 'DARK' });
        expect(m.opzioniNavigazione({ giroAttivo: true })).toEqual({ colorScheme: 'DARK' });
        expect(m.inclinazioneNav).toBeUndefined();
    });
    it('fuori dalla navigazione, o con un mapId imposto, o senza variabile: niente cambia', async () => {
        const m = await carica('ID_NAV');
        expect(m.opzioniNavigazione({ isNavigating: false, giroAttivo: false })).toEqual({});
        expect(m.opzioniNavigazione({ isNavigating: true, mapId: 'ALTRO' })).toEqual({});
        const senza = await carica('');
        expect(senza.opzioniNavigazione({ isNavigating: true })).toEqual({});
    });
    it('la mappa di Esplora (non in navigazione) resta sul Map ID di sempre', async () => {
        const m = await carica('ID_NAV');
        expect(m.mapIdPer({ isNavigating: false })).toBe('ID_NORMALE');
    });
    it('il Map ID della navigazione non è nel codice sorgente (solo in .env.example e su Vercel)', () => {
        const giro = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? giro(`${d}/${e.name}`) : [`${d}/${e.name}`]));
        const trovati = giro('src').filter(f => /\.(jsx?|css)$/.test(f) && !f.includes('__tests__')).filter(f => fs.readFileSync(f, 'utf8').includes('28861a61c07876f889cc6572'));
        expect(trovati).toEqual([]);
    });
});

describe('i tratti si leggono sopra lo stile della navigazione (≥ 3:1)', () => {
    // i colori dello stile «DoveVAI — Navigazione» (canvas, schermata 1): terra, edifici, strade
    const STILE = { terra: '#0F0E0D', edifici: '#171513', strade: '#26231F' };
    const BASE = { outer: { strokeColor: '#5A5048', strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 }, inner: { strokeColor: '#5A5048', strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50 } };
    const colori = {
        fatto: stileTratto('fatto', BASE, { navigazione: true }).inner.icons[0].icon.strokeColor,
        prossimo: stileTratto('prossimo', BASE, { navigazione: true }).inner.strokeColor,
        resto: stileTratto('resto', BASE, { navigazione: true }).inner.strokeColor,
    };
    it('i colori vengono dalle costanti', () => {
        expect(colori).toEqual({ fatto: COLORE_FATTO_NAV, prossimo: ACCENTO_TRATTO, resto: COLORE_RESTO_NAV });
    });
    for (const [stato, colore] of Object.entries(colori)) {
        for (const [fondo, hex] of Object.entries(STILE)) {
            it(`${stato} su ${fondo}`, () => { expect(rapporto(colore, hex)).toBeGreaterThanOrEqual(3); });
        }
    }
    it('fatto (tratteggio), prossimo (pieno spesso) e resto (pieno più sottile) si distinguono anche senza colore', () => {
        const f = stileTratto('fatto', BASE, { navigazione: true }).inner;
        const p = stileTratto('prossimo', BASE, { navigazione: true }).inner;
        const r = stileTratto('resto', BASE, { navigazione: true }).inner;
        expect(f.strokeOpacity).toBe(0); expect(f.icons?.length).toBe(1);
        expect(p.strokeWeight).toBeGreaterThan(r.strokeWeight);
        expect(r.icons).toBeUndefined();
    });
    it('fuori dalla navigazione il resto è quello di sempre', () => {
        expect(stileTratto('resto', BASE)).toEqual(BASE);
    });
});
