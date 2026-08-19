/**
 * Gate F38 — il centro della mappa è uno stato derivato dalla città.
 *
 * Difetto osservato (device, 5deca9c): header "Manfredonia", mappa su Roma.
 * Causa strutturale: `defaultCenter` di @vis.gl/react-google-maps è
 * UNCONTROLLED — letto solo al mount. La mappa montava prima di conoscere il
 * centro, quindi montava sul default hardcoded (41.9028, 12.4964) e da lì la
 * si poteva muovere solo con flyTo imperativi che si sovrascrivevano fra loro.
 *
 * `resolveMapCenter` è la catena di precedenza estratta come funzione pura,
 * stesso pattern di getTourRenderState (Gate E-1), getSurpriseOutcome
 * (Gate NARRATORE/POI) e resolvePoiPhoto (Gate FOTO).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveMapCenter, resolveCenterStatus } from '@/lib/mapCenter';

const SRC = resolve(__dirname, '..');
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
const read = (rel) => stripComments(readFileSync(resolve(SRC, rel), 'utf8'));

const TOUR = { latitude: 45.4, longitude: 9.19 };
const PASSED = { latitude: 43.77, longitude: 11.25 };
const MANUAL = { latitude: 41.63, longitude: 15.92 };
const GPS = { latitude: 41.60, longitude: 15.88 };
const CITY = { latitude: 41.6277, longitude: 15.9169 };   // Manfredonia

describe('F38 — precedenza del centro mappa', () => {
    it('1. il tour attivo vince su tutto', () => {
        const { center, source } = resolveMapCenter({
            tourCenter: TOUR, passedCenter: PASSED, manualCenter: MANUAL,
            gpsCenter: GPS, cityCenter: CITY, isManual: true,
        });
        expect(center).toEqual(TOUR);
        expect(source).toBe('tour');
    });

    it('2. il centro passato dal router batte scelta manuale, GPS e città', () => {
        const { source } = resolveMapCenter({
            passedCenter: PASSED, manualCenter: MANUAL, gpsCenter: GPS, cityCenter: CITY,
        });
        expect(source).toBe('passed');
    });

    it('3. la scelta dall\'autocomplete batte GPS e città', () => {
        const { center, source } = resolveMapCenter({
            manualCenter: MANUAL, gpsCenter: GPS, cityCenter: CITY,
        });
        expect(center).toEqual(MANUAL);
        expect(source).toBe('manual');
    });

    it('4. con isManual la città geocodata batte il GPS', () => {
        // La scelta esplicita dell'utente non deve essere scavalcata dal GPS.
        const { center, source } = resolveMapCenter({
            gpsCenter: GPS, cityCenter: CITY, isManual: true,
        });
        expect(center).toEqual(CITY);
        expect(source).toBe('city');
    });

    it('5. senza isManual il GPS reale batte la città', () => {
        const { center, source } = resolveMapCenter({ gpsCenter: GPS, cityCenter: CITY });
        expect(center).toEqual(GPS);
        expect(source).toBe('gps');
    });

    it('5b. senza GPS si ricade sulla città geocodata', () => {
        const { center, source } = resolveMapCenter({ cityCenter: CITY });
        expect(center).toEqual(CITY);
        expect(source).toBe('city');
    });

    it('6. senza nessuna sorgente il centro è null — MAI Roma', () => {
        const { center, source } = resolveMapCenter({});
        expect(center).toBeNull();
        expect(source).toBeNull();
        // la prova che conta: nessuna coordinata romana esce da qui
        expect(JSON.stringify(resolveMapCenter({}))).not.toContain('41.9028');
        expect(JSON.stringify(resolveMapCenter({}))).not.toContain('12.4964');
    });

    it('isManual senza città geocodata non ricade sul GPS né su Roma', () => {
        // Caso reale: città scelta a mano, geocode ancora in volo.
        // Meglio "non lo so ancora" che il GPS di un'altra città.
        const { center, source } = resolveMapCenter({ gpsCenter: GPS, isManual: true });
        expect(center).toBeNull();
        expect(source).toBeNull();
    });
});

describe('F38 — i tre stati', () => {
    it('resolved quando un centro esiste', () => {
        expect(resolveCenterStatus({ center: CITY })).toBe('resolved');
    });

    it('pending mentre il GPS cerca o il contesto carica', () => {
        expect(resolveCenterStatus({ center: null, isLocating: true })).toBe('pending');
        expect(resolveCenterStatus({ center: null, userContextLoading: true })).toBe('pending');
    });

    it('unavailable a boot finito senza centro: stato onesto, non Roma', () => {
        expect(resolveCenterStatus({ center: null })).toBe('unavailable');
    });

    it('un centro risolto vince sul pending: niente flash dello spinner', () => {
        expect(resolveCenterStatus({ center: CITY, isLocating: true })).toBe('resolved');
    });
});

describe('F38 — le superfici che producevano Roma', () => {
    it('GoogleMapContainer non ha più il default hardcoded 41.9028/12.4964', () => {
        const src = read('components/Map/GoogleMapContainer.jsx');
        expect(src).not.toContain('41.9028');
        expect(src).not.toContain('12.4964');
    });

    it('la riga DEMO_CITIES[x] || DEMO_CITIES[\'Roma\'] non esiste più nell\'app', () => {
        for (const f of ['pages/MapPage.jsx', 'pages/AiItinerary.jsx']) {
            expect(read(f)).not.toContain("DEMO_CITIES['Roma']");
        }
    });

    it('MapPage non importa più DEMO_CITIES', () => {
        expect(read('pages/MapPage.jsx')).not.toContain("from '../data/demoData'");
    });

    it('la mappa monta solo a centro risolto', () => {
        const src = read('pages/MapPage.jsx');
        expect(src).toContain("centerStatus === 'resolved' && (");
        expect(src).toContain('initialCenter={mapCenter}');
    });

    it('lo stato unavailable parla senza scusarsi e senza promettere', () => {
        const src = read('pages/MapPage.jsx');
        expect(src).toContain('Dimmi tu dove.');
        expect(src).toContain('Scegli una città dalla barra qui sopra e apro la mappa lì.');
        // "Non so ancora dove sei" metteva l'app in posizione di scusa, e
        // "ancora" prometteva che l'avrebbe saputo. Non è la voce del prodotto.
        expect(src).not.toContain('Non so ancora dove sei');
    });

    it('la selezione autocomplete scrive stato, non solo un flyTo', () => {
        const src = read('pages/MapPage.jsx');
        expect(src).toContain('setManualCenter({ latitude: selection.lat, longitude: selection.lng })');
    });

    it('isLocating ha un timeout duro: nessuno stato non-uscibile (regola #7)', () => {
        const src = read('pages/MapPage.jsx');
        expect(src).toContain('clearTimeout(hardTimeout)');
        expect(src).toContain('}, 8000);');
    });

    it('DIFF 2 — il guard del geocoder chiude lo spinner prima di uscire', () => {
        const src = read('components/Map/CitySearchBar.jsx');
        // il return nudo dopo setIsLoading(true) non deve più esistere
        expect(src).not.toMatch(/if \(!geocoder\.current\) return;/);
        expect(src).toContain('setIsLoading(false);\n            setInputValue(\'\');\n            return;');
    });
});
