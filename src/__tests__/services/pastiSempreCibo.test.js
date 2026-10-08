// P3e — Pranzo e cena sono sempre un posto dove mangiare, anche quando
// l'utente sceglie una categoria (Rioni Storici, Natura, una restrizione tipo
// "spiagge"). La categoria scelta vale per tutti gli altri momenti. Se in
// zona non c'e' un posto dove mangiare valido, il pasto si salta: mai un
// luogo non-cibo sotto Pranzo o Cena.
//
// Rosso riprodotto sul codice di prima: con una categoria stretta lo
// scheletro dava a pranzo la stessa categoria degli altri momenti, il bucket
// di pranzo prendeva tutto il pool e la ricerca mirata del cibo veniva
// scartata dal filtro di categoria — Sorprendimi Natura metteva un parco
// sotto "Pranzo".
//
// Luoghi (textsearch) e modello (traduttore + selettore) simulati, come in
// scheletroScelta.test.js; orologio fisso in ora di ROMA esplicita.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { normalizeTour } from '../../services/tourShape';
import { TourStopsByMoment } from '../../components/TourStopsByMoment';
import { QuickPathSummary } from '../../components/Map/QuickPathSummary';
import { stopClockLabel } from '../../lib/stopMoments';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };

let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `pid-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6,
    user_ratings_total: 400,
    business_status: 'OPERATIONAL',
    types,
});
// Il filtro stretto "storia" ammette historical_landmark (church e
// tourist_attraction si leggono come altre categorie concrete).
const LANDMARK = ['historical_landmark', 'point_of_interest', 'establishment'];
// Senza tourist_attraction: il filtro di categoria lo legge come storia.
const PARCO = ['park', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];

const RIONI = [
    place('Basilica di Santa Maria in Trastevere', LANDMARK, -0.006, -0.004),
    place('Chiesa di San Crisogono', LANDMARK, -0.005, -0.002),
    place('Fontana dell\'Acqua Paola', LANDMARK, -0.007, -0.008),
    place('Arco degli Acetari', LANDMARK, 0.001, -0.001),
];
const PARCHI = [
    place('Villa Celimontana', PARCO, -0.010, 0.005),
    place('Orto Botanico di Roma', PARCO, 0.003, -0.008),
    place('Giardino degli Aranci', PARCO, -0.006, 0.002),
];
const TRATTORIE = [
    place('Da Enzo al 29', RISTO, -0.005, -0.003),
    place('Trattoria Da Teo', RISTO, -0.006, -0.001),
];
const FOOD_QUERY = 'trattoria ristorante pizzeria osteria';

// 1ª chiamata al proxy OpenAI = traduttore, 2ª = selettore, 3ª = narratore.
// La textsearch risponde solo alle query note: il resto e' ZERO_RESULTS.
const routeFetch = ({ intent, perQuery, selector }) => {
    const stato = { aiCalls: 0, textsearch: [] };
    const fn = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? intent : selector;
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const q = new URL(u, 'http://x').searchParams.get('query');
            stato.textsearch.push(q);
            const hit = Object.keys(perQuery).find(k => q === `${k} Roma`);
            return hit
                ? { ok: true, json: async () => ({ status: 'OK', results: perQuery[hit] }) }
                : { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

const intentOf = (categoria, queries) => ({
    queries, categoria, oggetto_umano: categoria,
    vincoli: { tempo: null, escludi: ['ristoranti', 'bar'], note: null },
});
// Il modello mette tutto a pranzo: il codice deve rimettere ordine.
const allAtLunch = (places) => ({ stops: places.map(p => ({ place_id: p.place_id, moment: 'g1-pranzo' })) });

const isFood = (s) => (s.types || []).includes('restaurant');
const clock = (s) => stopClockLabel(s);

// Percorso Veloce: stessa firma di QuickPath.jsx (pathType 'quick').
const quick = (prompt, prefs) => aiRecommendationService.generateItinerary(
    'Roma', prefs, prompt, { condition: 'sunny', temperature: 20 }, '', ROMA, { dnaWeights: {}, pathType: 'quick', skipUserQuota: true },
);
// Sorprendimi: stessa firma di SurpriseTour.jsx (nessun pathType).
const surprise = (theme) => aiRecommendationService.generateItinerary(
    'Roma', { interests: [theme], duration: 'Mezza Giornata', budget: 'Medio' },
    `Categoria di oggi: ${theme}.`, {}, '', ROMA, { dnaWeights: {}, skipUserQuota: true },
);

describe('P3e — pranzo e cena sono sempre un posto dove mangiare', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('Percorso Veloce "Medio", Rioni Storici, alle 11:30 → la tappa delle 12:30 è un posto dove mangiare', async () => {
        vi.setSystemTime(new Date('2026-10-08T11:30:00+02:00'));
        const { fn, stato } = routeFetch({
            intent: intentOf('storia', ['chiesa', 'monumento']),
            perQuery: { chiesa: RIONI.slice(0, 2), monumento: RIONI.slice(2), [FOOD_QUERY]: TRATTORIE },
            selector: allAtLunch(RIONI),
        });
        vi.stubGlobal('fetch', fn);

        const result = await quick('A Roma cerco: vicoli, rioni storici e vita di quartiere.', {
            duration: 'Medio', group: 'Solo', interests: ['Città', 'Rioni Storici'],
        });

        const stops = result.days[0].stops;
        const at1230 = stops.find(s => clock(s) === '12:30');
        expect(at1230, JSON.stringify(stops.map(s => [s.title, s.moment, clock(s)]))).toBeTruthy();
        expect(at1230.moment).toBe('pranzo');
        expect(isFood(at1230)).toBe(true);
        // La categoria scelta vale per gli altri momenti: niente cibo fuori dal pasto.
        expect(stops.filter(s => s.moment !== 'pranzo' && s.moment !== 'cena').some(isFood)).toBe(false);
        expect(stops.filter(s => s.moment === 'pranzo').every(isFood)).toBe(true);
        // La ricerca del cibo resta dentro il tetto delle ricerche mirate.
        expect(result._momentReport.ricercheMirate).toContain('food');
        expect(stato.textsearch.filter(q => q === `${FOOD_QUERY} Roma`)).toHaveLength(1);
    });

    it('Sorprendimi Natura → pranzo è cibo, i parchi restano negli altri momenti', async () => {
        vi.setSystemTime(new Date('2026-10-08T11:30:00+02:00'));
        const { fn } = routeFetch({
            intent: intentOf('natura', ['parco']),
            perQuery: { parco: PARCHI, [FOOD_QUERY]: TRATTORIE },
            selector: allAtLunch(PARCHI),
        });
        vi.stubGlobal('fetch', fn);

        const result = await surprise('Natura');

        const stops = result.days[0].stops;
        const lunch = stops.filter(s => s.moment === 'pranzo');
        expect(lunch).toHaveLength(1);
        expect(isFood(lunch[0])).toBe(true);
        expect(stops.filter(s => s.moment !== 'pranzo').length).toBeGreaterThan(0);
        expect(stops.filter(s => s.moment !== 'pranzo').some(isFood)).toBe(false);
    });

    it('nessun ristorante fra i candidati → il Pranzo si salta, nessuna tappa sotto "Pranzo"', async () => {
        vi.setSystemTime(new Date('2026-10-08T11:30:00+02:00'));
        const { fn } = routeFetch({
            intent: intentOf('natura', ['parco']),
            perQuery: { parco: PARCHI }, // la ricerca del cibo non trova niente
            selector: allAtLunch(PARCHI),
        });
        vi.stubGlobal('fetch', fn);

        const result = await surprise('Natura');

        const stops = result.days[0].stops;
        expect(stops.length).toBeGreaterThan(0);
        expect(stops.some(s => s.moment === 'pranzo')).toBe(false);
        expect(result._momentReport.momentiTolti.map(m => m.momento)).toContain('g1-pranzo');
        // A schermo: nessuna intestazione "Pranzo".
        const tour = normalizeTour({ id: 's', title: 't', city: 'Roma', stops }, { cityFallback: 'Roma' });
        const { container } = render(createElement(TourStopsByMoment, { stops: tour.stops }));
        const headers = [...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent);
        expect(headers).not.toContain('Pranzo');
        expect(headers.length).toBeGreaterThan(0);
    });
});

describe('P3e — ogni gruppo di tappe ha la sua intestazione, anche il primo', () => {
    const at = (hhmm) => new Date(`2026-10-08T${hhmm}:00+02:00`).toISOString();
    const tourData = normalizeTour({
        id: 'q', title: 'Roma', city: 'Roma',
        stops: [
            { title: 'Da Enzo al 29', type: 'food', latitude: 41.89, longitude: 12.47, scheduledTime: at('12:30'), moment: 'pranzo', stayMinutes: 60 },
            { title: 'Villa Celimontana', type: 'natura', latitude: 41.88, longitude: 12.49, scheduledTime: at('14:30'), moment: 'pomeriggio', stayMinutes: 45 },
        ],
    });

    it('tour con prima tappa alle 12:30 → "Pranzo" presente e non coperto dalla dissolvenza', () => {
        const { container } = render(createElement(QuickPathSummary, { tourData, choices: {} }));
        const headers = [...container.querySelectorAll('[data-moment-header]')];
        expect(headers.map(h => h.textContent)).toEqual(['Pranzo', 'Pomeriggio']);
        // La prima intestazione sta nei primi 26px della lista: a lista ferma
        // la dissolvenza (trasparente in cima) non deve esserci.
        const scroller = headers[0].closest('[data-top-fade]');
        expect(scroller).not.toBeNull();
        expect(scroller.getAttribute('data-top-fade')).toBe('off');
        expect(scroller.style.maskImage || '').toBe('');
        expect(scroller.style.webkitMaskImage || '').toBe('');
    });

    it('la dissolvenza torna appena la lista scorre, e sparisce tornando in cima', () => {
        const { container } = render(createElement(QuickPathSummary, { tourData, choices: {} }));
        const scroller = container.querySelector('[data-top-fade]');
        scroller.scrollTop = 40;
        fireEvent.scroll(scroller);
        expect(scroller.getAttribute('data-top-fade')).toBe('on');
        expect(scroller.style.maskImage).toContain('transparent 0%');
        scroller.scrollTop = 0;
        fireEvent.scroll(scroller);
        expect(scroller.getAttribute('data-top-fade')).toBe('off');
    });
});
