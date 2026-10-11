// T1 — La citta' e il giorno scritti nel testo vincono sulla posizione.
//
// Caso reale (telefono di Ivano): posizione Troina, testo "Domani Roma in una
// giornata da Romano" → il tour usciva a Troina, oggi. Questi test non chiamano
// ne' il modello ne' Google: fetch e' finto e risponde per percorso.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { aiRecommendationService, resolveTextDestination } from '@/services/aiRecommendationService';
import { confirmCityFromText } from '@/services/cityCenterService';
import { resolveTourWindow, romeDate } from '@/lib/tourWindow';
import { isStreetMention, sameCity, DESTINATION_UNSURE_NOTE } from '@/lib/textDestination';

const TROINA = 'Troina';

// Il traduttore risponde con `citta`; il proxy dei luoghi con `place`.
const fakeNet = ({ citta = null, place = null, placeStatus = 'OK' } = {}) => {
    const calls = { ai: 0, places: 0 };
    const fn = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            calls.ai++;
            return {
                ok: true,
                json: async () => ({ choices: [{ message: { content: JSON.stringify({
                    queries: ['trattoria tipica', 'piazza storica'], categoria: 'misto',
                    oggetto_umano: 'un giro', citta, vincoli: { tempo: null, escludi: [], note: null },
                }) } }] }),
            };
        }
        if (u.includes('findplacefromtext')) {
            calls.places++;
            return { ok: true, json: async () => ({ status: placeStatus, candidates: place ? [place] : [] }) };
        }
        throw new Error(`rete non prevista: ${u}`);
    });
    vi.stubGlobal('fetch', fn);
    return calls;
};

const ROMA = { name: 'Roma', types: ['locality', 'political'], geometry: { location: { lat: 41.9028, lng: 12.4964 } } };
const CATANIA = { name: 'Catania', types: ['locality', 'political'], geometry: { location: { lat: 37.5079, lng: 15.083 } } };

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
// NON vi.restoreAllMocks(): toglierebbe anche i finti di Supabase del setup
// (getSession) e il traduttore fallirebbe. Si ripristinano solo le spie di qui.
const spies = [];
const spyInner = (value) => {
    const s = vi.spyOn(aiRecommendationService, '_generateItinerary').mockResolvedValue(value);
    spies.push(s);
    return s;
};
afterEach(() => {
    vi.unstubAllGlobals();
    while (spies.length) spies.pop().mockRestore();
});

describe('T1 — regole pure', () => {
    it('"via Roma" e "piazza Roma" sono strade, non Roma', () => {
        expect(isStreetMention('un giro in via Roma', 'Roma')).toBe(true);
        expect(isStreetMention('aperitivo in piazza Roma stasera', 'Roma')).toBe(true);
        expect(isStreetMention('Domani Roma in una giornata da romano', 'Roma')).toBe(false);
        expect(isStreetMention('da via Roma fino a Roma centro', 'Roma')).toBe(false);
        // "da romano" non e' "Roma": confine di parola.
        expect(isStreetMention('una giornata da romano', 'Roma')).toBe(false);
        // la citta' non compare (dedotta da un luogo): non e' una strada.
        expect(isStreetMention('voglio vedere il Colosseo', 'Roma')).toBe(false);
    });

    it('sameCity ignora maiuscole, accenti e spazi', () => {
        expect(sameCity(' roma ', 'Roma')).toBe(true);
        expect(sameCity('Forlì', 'forli')).toBe(true);
        expect(sameCity('Roma', 'Troina')).toBe(false);
        expect(sameCity('', '')).toBe(false);
    });
});

describe('T1 — dove si fa il tour', () => {
    it('Troina + "Domani Roma in una giornata da romano" → Roma, con UNA ricerca', async () => {
        const calls = fakeNet({ citta: 'Roma', place: ROMA });
        const d = await resolveTextDestination('Domani Roma in una giornata da romano', TROINA);
        expect(d.fromText).toBe(true);
        expect(d.city).toBe('Roma');
        expect(d.cityCenter.latitude).toBeCloseTo(41.9028, 3);
        expect(d.note).toBe('Tour a Roma (dal tuo testo)');
        expect(calls).toEqual({ ai: 1, places: 1 });
    });

    it('"una giornata a Catania" → Catania', async () => {
        fakeNet({ citta: 'Catania', place: CATANIA });
        const d = await resolveTextDestination('una giornata a Catania', TROINA);
        expect(d.city).toBe('Catania');
        expect(d.note).toBe('Tour a Catania (dal tuo testo)');
    });

    it('testo senza citta\' → posizione, nessuna ricerca, nessuna riga', async () => {
        const calls = fakeNet({ citta: null });
        const d = await resolveTextDestination('un giro tra trattorie e belvedere', TROINA);
        expect(d).toMatchObject({ city: TROINA, fromText: false, note: null });
        expect(calls.places).toBe(0);
    });

    it('"un giro in via Roma" a Troina → Troina, anche se il modello dice Roma', async () => {
        const calls = fakeNet({ citta: 'Roma', place: ROMA });
        const d = await resolveTextDestination('un giro in via Roma', TROINA);
        expect(d).toMatchObject({ city: TROINA, fromText: false, note: null });
        expect(calls.places).toBe(0);
    });

    it('citta\' non riconosciuta → posizione con la riga onesta', async () => {
        // Google torna un'altra cosa (una via, non un comune).
        fakeNet({ citta: 'Rocca Zzz', place: { name: 'Via Rocca', types: ['route'], geometry: { location: { lat: 1, lng: 1 } } } });
        const d = await resolveTextDestination('domani a Rocca Zzz', TROINA);
        expect(d).toMatchObject({ city: TROINA, fromText: false, note: DESTINATION_UNSURE_NOTE });
        expect(DESTINATION_UNSURE_NOTE).toBe('Non ho riconosciuto la città: uso la tua posizione');
    });

    it('ricerca senza risultati o proxy giu\' → posizione con la riga onesta', async () => {
        fakeNet({ citta: 'Roma', place: null, placeStatus: 'ZERO_RESULTS' });
        expect((await resolveTextDestination('domani Roma', TROINA)).note).toBe(DESTINATION_UNSURE_NOTE);
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (String(url).includes('openai-proxy')) {
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ queries: ['piazza'], citta: 'Roma' }) } }] }) };
            }
            throw new TypeError('Failed to fetch');
        }));
        window.localStorage.clear();
        expect((await resolveTextDestination('domani Roma', TROINA)).note).toBe(DESTINATION_UNSURE_NOTE);
    });

    it('la citta\' del testo uguale alla posizione → nessuna ricerca, nessuna riga', async () => {
        const calls = fakeNet({ citta: 'troina', place: null });
        const d = await resolveTextDestination('domani Troina con calma', TROINA);
        expect(d).toMatchObject({ city: TROINA, fromText: false, note: null });
        expect(calls.places).toBe(0);
    });

    it('confirmCityFromText: un nome che Google chiama in altro modo non e\' sicuro', async () => {
        fakeNet({ place: { ...ROMA, name: 'Romagnano Sesia' } });
        expect((await confirmCityFromText('Roma')).sure).toBe(false);
    });
});

describe('T1 — il motore genera nella citta\' del testo', () => {
    it('generateItinerary custom: _generateItinerary riceve Roma e il centro di Roma, il risultato porta destination', async () => {
        fakeNet({ citta: 'Roma', place: ROMA });
        const inner = spyInner({ days: [{ day: 1, stops: [] }] });
        const troinaCenter = { latitude: 37.78, longitude: 14.6, radiusKm: 5 };
        const r = await aiRecommendationService.generateItinerary(
            TROINA, {}, 'Domani Roma in una giornata da romano', {}, '', troinaCenter, { pathType: 'custom' },
        );
        const [city, , prompt, , , center, opts] = inner.mock.calls[0];
        expect(city).toBe('Roma');
        expect(prompt).toBe('Domani Roma in una giornata da romano');
        expect(center.latitude).toBeCloseTo(41.9028, 3);
        // il traduttore non si richiama: l'intent viaggia, col biglietto della generazione
        expect(opts.presetIntent?.citta).toBe('Roma');
        expect(opts.quotaTicket?.purpose).toBe('generation');
        expect(r.destination).toMatchObject({ city: 'Roma', fromText: true, note: 'Tour a Roma (dal tuo testo)' });
    });

    it('generateItinerary custom senza citta\' nel testo: resta Troina col suo centro', async () => {
        fakeNet({ citta: null });
        const inner = spyInner({ days: [] });
        const troinaCenter = { latitude: 37.78, longitude: 14.6, radiusKm: 5 };
        const r = await aiRecommendationService.generateItinerary(TROINA, {}, 'un giro in via Roma', {}, '', troinaCenter, { pathType: 'custom' });
        expect(inner.mock.calls[0][0]).toBe(TROINA);
        expect(inner.mock.calls[0][5]).toBe(troinaCenter);
        expect(r.destination).toMatchObject({ city: TROINA, fromText: false, note: null });
    });

    it('Per Te / Veloce / Sorprendimi (niente pathType custom): nessun traduttore in anticipo, nessun destination', async () => {
        const calls = fakeNet({ citta: 'Roma', place: ROMA });
        const inner = spyInner({ days: [] });
        const r = await aiRecommendationService.generateItinerary(TROINA, {}, 'Domani Roma', {}, '', null, {});
        expect(inner.mock.calls[0][0]).toBe(TROINA);
        expect(calls).toEqual({ ai: 0, places: 0 });
        expect(r.destination).toBeUndefined();
    });
});

describe('T1 — il giorno scritto nel testo', () => {
    // Sabato 10/10/2026, 20:57 a Roma.
    const sabatoSera = romeDate({ y: 2026, m: 10, d: 10 }, { h: 20, m: 57 });

    it('"Domani Roma in una giornata da romano" → domenica 11/10 dalle 9:30', () => {
        const w = resolveTourWindow({ text: 'Domani Roma in una giornata da romano', requestTime: sabatoSera, pathType: 'custom' });
        expect(w.date).toBe('2026-10-11');
        expect(w.start.getTime()).toBe(romeDate({ y: 2026, m: 10, d: 11 }, { h: 9, m: 30 }).getTime());
    });

    it('"martedi a Catania" → il prossimo martedi\'', () => {
        const w = resolveTourWindow({ text: 'martedì a Catania', requestTime: sabatoSera, pathType: 'custom' });
        expect(w.date).toBe('2026-10-13');
    });

    it('la pagina passa pathType custom: la finestra legge il testo', () => {
        const src = readFileSync(join(process.cwd(), 'src/pages/AiItinerary.jsx'), 'utf8');
        expect(src).toContain("pathType: 'custom'");
    });
});

describe('T1 — la pagina usa la citta\' del tour', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/AiItinerary.jsx'), 'utf8');
    it('mostra la riga in testa al tour', () => {
        expect(src).toContain('data-destination-note');
        expect(src).toContain('tourDestination.note');
    });
    it('mappa e rigenerazione usano citta\' e centro del tour, non la posizione', () => {
        expect(src).toContain('cityCenter: tourCenter');
        expect(src).toContain('city: tourCity');
        expect(src).toMatch(/resolveCityCenter\(tourCity\)/);
    });
});
