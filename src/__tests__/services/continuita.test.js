// CONTINUITA' — il motore intero (generateItinerary): nessun buco non dichiarato
// oltre 45 minuti fra due tappe, e ogni tappa ha il suo orario, anche dopo un tempo libero.
//
// Scenario: spiagge a Cabras (pathType custom, interesse Natura). Il mercoledi' 14/10/2026
// alle 14:00 il pomeriggio e' lungo 210 minuti → 2 tappe da 30 minuti: prima di CONTINUITA'
// restavano oltre due ore vuote fino all'aperitivo delle 18:00, senza nessuna riga.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { remainingGaps, GAP_MAX_MINUTES } from '../../lib/continuity';
import { romeParts } from '../../lib/tourWindow';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close) => ({ open: { day, time: open }, close: { day, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const place = (id, i, periods) => ({
    place_id: id, name: `Spiaggia ${id}`, geometry: { location: { lat: aKm(0.5 + i * 0.3), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL',
    types: ['establishment', 'natural_feature', 'point_of_interest'],
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const APERTE = (n) => Array.from({ length: n }, (_, i) => place(`s${i}`, i, tutti('0000', '2359')));
const INTENT = { queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });

// il modello sceglie i posti nell'ordine dato, ognuno nel momento indicato (o senza momento)
const routeFetch = (results, scelte) => {
    let n = 0;
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            if (n++ === 0) return ai(INTENT);
            return ai({ days: [{ day: 1, stops: (scelte || results.map(p => ({ place_id: p.place_id }))).map(s => ({ ...s, description: 'x' })) }] });
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? results : [] }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        return { ok: false, status: 404, json: async () => ({}) };
    });
};
const genera = async (results, ora, prefs = { interests: ['Natura'] }, scelte = null) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results, scelte));
    return aiRecommendationService.generateItinerary('Cabras', prefs, 'le spiagge piu belle', {}, '', CABRAS, { pathType: 'custom' });
};
const righe = (r) => r.days[0].stops;
const vere = (r) => righe(r).filter(s => !s.tempoLibero);
const libere = (r) => righe(r).filter(s => s.tempoLibero);
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('un pomeriggio con ore vuote viene riempito', () => {
    it('9 posti aperti, ritmo Attivo (default): il pomeriggio prende piu\' di 2 tappe e fra una tappa e l\'altra non restano buchi', async () => {
        const r = await genera(APERTE(9), '14:00');
        expect(r._source).toBe('google-first');
        const pom = vere(r).filter(s => s.moment === 'pomeriggio');
        expect(pom.length).toBeGreaterThan(2);
        expect(libere(r)).toHaveLength(0);
        expect(remainingGaps(righe(r))).toEqual([]);
        // il rapporto lo dice
        expect(r._momentReport.continuita.aggiunte.length).toBeGreaterThan(0);
        expect(r._momentReport.continuita.dichiarati).toEqual([]);
    });
    it('al massimo 8 tappe al giorno anche quando il buco c\'e\' ancora (il resto e\' tempo libero)', async () => {
        const r = await genera(APERTE(14), '09:30', { interests: ['Natura'], duration: '1 Giorno' });
        expect(vere(r).length).toBeLessThanOrEqual(8);
        expect(remainingGaps(righe(r))).toEqual([]);
    });
});

describe('un buco che non si riempie viene dichiarato, con la sua fascia', () => {
    it('3 soli posti: il pomeriggio ne prende 2, l\'aperitivo 1; le 2 ore vuote in mezzo sono una riga di tempo libero con la fascia', async () => {
        const r = await genera(APERTE(3), '14:00');
        const tl = libere(r);
        expect(tl.length).toBeGreaterThan(0);
        for (const t of tl) {
            expect(t.description).toMatch(/^Tempo libero:/);
            expect(t.stayMinutes).toBeGreaterThan(GAP_MAX_MINUTES);   // la fascia: quanto dura
            expect(t.scheduledTime).toBeTruthy();                      // e da che ora
        }
        expect(remainingGaps(righe(r))).toEqual([]);
        expect(r._momentReport.continuita.dichiarati.length).toBe(tl.length);
    });
    it('ritmo Rilassato: nessuna tappa in piu\' (e\' la scelta dell\'utente), i buchi sono dichiarati', async () => {
        const r = await genera(APERTE(9), '14:00', { interests: ['Natura'], pace: 'Rilassato' });
        expect(r._momentReport.continuita.aggiunte).toEqual([]);
        expect(vere(r).filter(s => s.moment === 'pomeriggio')).toHaveLength(1);
        expect(libere(r).length).toBeGreaterThan(0);
        expect(remainingGaps(righe(r))).toEqual([]);
    });
    it('un buco di 45 minuti o meno non ha nessuna riga', async () => {
        const r = await genera(APERTE(9), '14:00');
        for (const g of [...Array(righe(r).length - 1).keys()]) {
            const a = righe(r)[g]; const b = righe(r)[g + 1];
            const fine = new Date(a.scheduledTime).getTime() + (a.stayMinutes ?? 0) * 60000;
            expect((new Date(b.scheduledTime).getTime() - fine) / 60000 - (b.travelMinutesFromPrev ?? 0)).toBeLessThanOrEqual(GAP_MAX_MINUTES + 1);
        }
    });
});

describe('una tappa in piu\' non e\' mai un altro pasto', () => {
    const ristorante = (id, i) => ({
        place_id: id, name: `Trattoria ${id}`, geometry: { location: { lat: aKm(0.5 + i * 0.3), lng: CABRAS.longitude } },
        rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types: ['restaurant', 'food', 'point_of_interest', 'establishment'],
        opening_hours: { open_now: true, periods: tutti('0000', '2359') },
    });
    it('"nei ristoranti tipici": ogni momento ha solo ristoranti → il buco non si riempie con un altro ristorante, si dichiara', async () => {
        const rist = Array.from({ length: 9 }, (_, i) => ristorante(`r${i}`, i));
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T14:00:00+02:00'));
        let n = 0;
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                if (n++ === 0) return ai({ queries: ['trattoria'], categoria: 'cibo', oggetto_umano: 'trattorie', vincoli: { tempo: null, escludi: [], note: null } });
                return ai({ days: [{ day: 1, stops: rist.map(p => ({ place_id: p.place_id })) }] });
            }
            if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? rist : [] }) };
            return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        }));
        const r = await aiRecommendationService.generateItinerary('Cabras', { interests: ['Cibo'] }, 'nei ristoranti tipici', {}, '', CABRAS, { pathType: 'custom' });
        expect(r._source).toBe('google-first');
        const pom = vere(r).filter(s => s.moment === 'pomeriggio');
        expect(pom.length).toBeLessThanOrEqual(2);                       // quanti ne voleva lo scheletro, non uno di piu'
        expect(r._momentReport.continuita.aggiunte).toEqual([]);
        expect(libere(r).length).toBeGreaterThan(0);                     // il buco e' dichiarato
        expect(remainingGaps(righe(r))).toEqual([]);
    });
});

describe('ogni tappa ha il suo orario, anche dopo un tempo libero', () => {
    // tutto il mattino chiuso: la mattina e' tempo libero, le tappe cominciano dopo (come crea-firenze-arte)
    const dalle13 = (id, i) => place(id, i, tutti('1300', '2300'));
    it('tempo libero in testa al giorno: le tappe dopo hanno l\'orario, e il primo e\' quello del suo momento', async () => {
        const r = await genera([dalle13('a', 0), dalle13('b', 1), dalle13('c', 2), dalle13('d', 3)], '09:30', { interests: ['Natura'], duration: '1 Giorno' });
        expect(righe(r)[0].tempoLibero).toBe(true);
        expect(righe(r)[0].stayMinutes).toBeGreaterThan(GAP_MAX_MINUTES);
        for (const s of righe(r)) expect(s.scheduledTime, `${s.title} senza orario`).toBeTruthy();
        const prima = vere(r)[0];
        expect(ora(prima)).toBe('14:30');
        expect(remainingGaps(righe(r))).toEqual([]);
    });
    it('una tappa dopo il tempo libero chiusa a quell\'ora viene sostituita, e quella che la sostituisce ha l\'orario', async () => {
        // x chiude alle 14:40: alle 14:30 la sosta di 30 minuti non ci sta; il modello la sceglie lo stesso
        const x = place('x', 0, tutti('1300', '1440'));
        const y = dalle13('y', 1);
        const z = dalle13('z', 2);
        const w = dalle13('w', 3);
        const r = await genera([x, y, z, w], '09:30', { interests: ['Natura'], duration: '1 Giorno' }, [
            { place_id: 'x', moment: 'g1-pomeriggio' }, { place_id: 'y', moment: 'g1-pomeriggio' }, { place_id: 'z', moment: 'g1-aperitivo' },
        ]);
        expect(righe(r)[0].tempoLibero).toBe(true);
        const ids = vere(r).map(s => s.place_id);
        expect(ids).not.toContain('x');
        expect(ids.length).toBeGreaterThan(0);
        for (const s of vere(r)) expect(s.scheduledTime, `${s.title} senza orario`).toBeTruthy();
    });
});
