// VERITA-TESTI punto 1 — nessuna notifica mostra un orario già passato.
// Caso esatto: sono le 17:41, il locale chiude alle 13:00.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chiusuraFutura, orariPassatiNelTesto, minutiDa } from '../../lib/orariNotifica';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const ADESSO = 17 * 60 + 41;

describe('orariNotifica — funzioni pure', () => {
    it('le 13:00 alle 17:41 non sono una chiusura futura', () => {
        expect(chiusuraFutura('13:00', ADESSO)).toBe(false);
        expect(chiusuraFutura('17:41', ADESSO)).toBe(false);
        expect(chiusuraFutura('17:42', ADESSO)).toBe(true);
        expect(chiusuraFutura('22:30', ADESSO)).toBe(true);
    });
    it('una chiusura dopo mezzanotte (01:00) di sera è ancora davanti', () => {
        expect(chiusuraFutura('01:00', ADESSO)).toBe(true);
    });
    it('orario assente o illeggibile: nessuna chiusura', () => {
        expect(chiusuraFutura(null, ADESSO)).toBe(false);
        expect(minutiDa('boh')).toBeNull();
    });
    it('trova gli orari già passati nel testo', () => {
        expect(orariPassatiNelTesto('Osteria Sotto Casa chiude alle 13:00.', ADESSO)).toHaveLength(1);
        expect(orariPassatiNelTesto('Chiude fino alle 13.', ADESSO)).toHaveLength(1);
        expect(orariPassatiNelTesto('Osteria Sotto Casa chiude alle 19:00.', ADESSO)).toEqual([]);
        expect(orariPassatiNelTesto('Domani apre alle 9.', ADESSO)).toEqual([]);
    });
});

const RISULTATO = (place_id, name) => ({
    place_id, name,
    geometry: { location: { lat: 41.63, lng: 15.917 } },
    rating: 4.4, user_ratings_total: 90, business_status: 'OPERATIONAL',
    types: ['restaurant', 'food'], opening_hours: { open_now: false },
});
const CC = { latitude: 41.63, longitude: 15.917, isSmallTown: true, radiusKm: 5 };
const ORA_17_41 = new Date(2026, 9, 24, 17, 41);

describe('generateWeatherSocialTip — ora finta 17:41, chiusura 13:00', () => {
    beforeEach(() => { vi.clearAllMocks(); try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* jsdom */ } });
    afterEach(() => { vi.unstubAllGlobals(); });

    const prova = async (messaggio) => {
        const bodies = [];
        const oggi = new Date().getDay();
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                bodies.push(JSON.parse(init.body));
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'x', message: messaggio }) } }] }) };
            }
            if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: [RISULTATO('pid-1', 'Osteria Sotto Casa')] }) };
            if (u.includes('details')) {
                return { ok: true, json: async () => ({ status: 'OK', result: { opening_hours: { periods: [{ open: { day: oggi, time: '0900' }, close: { day: oggi, time: '1300' } }] } } }) };
            }
            throw new Error(`fetch inatteso: ${u}`);
        }));
        const r = await aiRecommendationService.generateWeatherSocialTip(
            'Manfredonia', 'Ivano', 'afternoon',
            { temperatureC: 22, condition: 'sunny', cityCenter: CC, userLat: CC.latitude, userLng: CC.longitude, source: 'gps', now: ORA_17_41 },
        );
        return { r, prompt: bodies.map(b => JSON.stringify(b)).join('\n') };
    };

    it('il prompt non riceve la chiusura delle 13:00', async () => {
        const { prompt } = await prova('Osteria Sotto Casa è a due passi da te.');
        expect(prompt).not.toContain('chiude oggi alle 13:00');
        expect(prompt).not.toContain('Osteria Sotto Casa — ');
    });

    it('se il modello scrive comunque «chiude alle 13:00», la notifica si scarta', async () => {
        const { r } = await prova('Osteria Sotto Casa è a due passi da te e chiude alle 13:00.');
        expect(r).toBeNull();
    });
});
