// GIRI-SALVATI — un giro salvato si riapre identico: tappe, orari, soste, tempo libero, modifiche di «Togli» comprese. Nessuna AI (0 $).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// una «tabella» saved_tours in memoria (stesso contratto che usa giriSalvati.js: insert, select/order/limit)
const tabella = [];
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({
            insert: async (riga) => {
                if (tabella.some(r => r.user_id === riga.user_id && r.tour_id === riga.tour_id)) return { error: { code: '23505' } };
                // il vincolo VERO della tabella (migrazione DNA-6): al massimo 30 righe e 20.000 byte (jsonb pesa ~10% piu' del testo)
                if (riga.stops.length > 30 || JSON.stringify(riga.stops).length * 1.1 > 20000) return { error: { code: '23514', message: 'check' } };
                tabella.push({ id: `id-${tabella.length + 1}`, created_at: new Date(2026, 9, 24, 12, tabella.length).toISOString(), ...JSON.parse(JSON.stringify(riga)) });
                return { error: null };
            },
            select: () => ({ order: () => ({ limit: async () => ({ data: [...tabella].reverse(), error: null }) }) }),
        }),
    },
}));
vi.mock('@/lib/dnaRegistro', () => ({ logDnaEvent: vi.fn() }));

import { salvaGiro, leggiGiriSalvati, giroSalvatoComeTour, giroDaSalvare } from '@/lib/giriSalvati';
import { togliDalGiorno, tourConGiorno } from '@/services/giroEditAzioni';
import { chiaveTappa } from '@/lib/giroEdit';

const T = (hhmm) => new Date(`2026-10-25T${hhmm}:00+01:00`).toISOString();
const tappa = (id, nome, ora, extra = {}) => ({
    title: nome, description: `Alle ${ora.replace(/^0/, '')} sei a ${nome}.`, insiderTip: null, types: ['tourist_attraction', 'point_of_interest'], type: 'place',
    latitude: 37.50 + id * 0.001, longitude: 15.08 + id * 0.001, rating: 4.5, googlePlaceId: `p${id}`, place_id: `p${id}`, googlePhoto: `https://foto.example/${id}.jpg`, image: null, city: 'Catania',
    openingPeriods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0800' }, close: { day: d, time: '2200' } })),
    primaryType: 'tourist_attraction', moment: 'mattina', momentLabel: 'Mattina', waitMinutesBefore: 0, stayMinutes: 30, travelMinutesFromPrev: id === 1 ? null : 6,
    priceLevel: null, scheduledTime: T(ora), _tracciato: { scelta: 'modello', motivo: 'diagnosi' }, _comp: { fatti: [] }, ...extra,
});
const GIRO = () => ({
    id: 'giro-1', title: 'Il tuo giro a Catania', city: 'Catania', isAiGenerated: true,
    steps: [
        tappa(1, 'Caffè Puglisi', '09:30', { moment: 'mattina', types: ['cafe', 'food'], primaryType: 'cafe', stayMinutes: 20 }),
        tappa(2, 'Basilica Cattedrale', '10:01'),
        tappa(3, 'Fontana dell’Elefante', '10:40'),
        { tempoLibero: true, place_id: null, title: 'Tempo libero', moment: 'mattina', momentLabel: 'Mattina', description: 'Niente in agenda: cammina dove ti porta la strada.', types: [], latitude: null, longitude: null, lat: null, lng: null, stayMinutes: 95, travelMinutesFromPrev: 0, waitMinutesBefore: 0, scheduledTime: T('11:10') },
        tappa(4, 'Trattoria L’imperiale', '12:45', { moment: 'pranzo', momentLabel: 'Pranzo', stayMinutes: 60 }),
    ],
});
// quello che le schede mostrano di ogni riga: titolo, orario, sosta, momento, testo, tempo libero
const vista = (righe) => righe.map(s => ({ t: s.title, ora: s.scheduledTime, sosta: s.stayMinutes, m: s.moment, d: s.description, tl: !!s.tempoLibero, id: s.place_id ?? null }));

describe('un giro salvato si riapre identico', () => {
    let fetchSpia;
    beforeEach(() => { tabella.length = 0; fetchSpia = vi.fn(); vi.stubGlobal('fetch', fetchSpia); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('salva, riapre: stesse tappe, stessi orari, stesse soste, stesso tempo libero', async () => {
        const giro = GIRO();
        expect((await salvaGiro('u1', giro, 'crea')).ok).toBe(true);
        const { ok, giri } = await leggiGiriSalvati();
        expect(ok).toBe(true);
        const riaperto = giroSalvatoComeTour(giri[0]);
        expect(riaperto.title).toBe('Il tuo giro a Catania');
        expect(vista(riaperto.steps)).toEqual(vista(giro.steps));
        expect(riaperto.steps.map(s => s.scheduledTime)).toEqual(giro.steps.map(s => s.scheduledTime));
        expect(riaperto.steps.some(s => s.tempoLibero)).toBe(true);
        expect(fetchSpia).not.toHaveBeenCalled(); // nessuna generazione, nessuna chiamata AI
    });

    it('salva, toglie una tappa, salva, riapre: il giro modificato (stesse tappe, stessi orari); l\'originale resta com\'era', async () => {
        const giro = GIRO();
        await salvaGiro('u1', giro, 'crea');
        // «Togli» la Cattedrale (come la scheda: togliDalGiorno + tourConGiorno)
        const r = togliDalGiorno({ stops: giro.steps, chiave: chiaveTappa(giro.steps[1]), city: 'Catania', tourId: 'giro-1' });
        expect(r.ok).toBe(true);
        const modificato = tourConGiorno(giro, r);
        const attese = vista(modificato.steps);
        expect(attese.some(x => x.t === 'Basilica Cattedrale')).toBe(false);
        expect((await salvaGiro('u1', modificato, 'crea')).ok).toBe(true);

        const { giri } = await leggiGiriSalvati();
        expect(giri).toHaveLength(2); // l'originale e la versione modificata
        const [recente, vecchio] = giri;
        expect(vista(giroSalvatoComeTour(recente).steps)).toEqual(attese);
        expect(giroSalvatoComeTour(recente).steps.map(s => s.scheduledTime)).toEqual(modificato.steps.map(s => s.scheduledTime));
        expect(vista(giroSalvatoComeTour(vecchio).steps)).toEqual(vista(giro.steps));
        expect(fetchSpia).not.toHaveBeenCalled();
    });

    it('lo stesso giro salvato due volte non fa un doppione', async () => {
        await salvaGiro('u1', GIRO(), 'crea');
        const r = await salvaGiro('u1', GIRO(), 'crea');
        expect(r).toMatchObject({ ok: true, giaSalvato: true });
        expect(tabella).toHaveLength(1);
    });

    it('non porta nella riga i campi di diagnosi del motore', async () => {
        const riga = giroDaSalvare(GIRO(), 'crea');
        expect(JSON.stringify(riga.stops)).not.toMatch(/_tracciato|_comp|diagnosi/);
        // ma tiene quello che serve alla scheda e a «Togli»/«Cambia»
        expect(riga.stops[0]).toMatchObject({ place_id: 'p1', moment: 'mattina', stayMinutes: 20, types: ['cafe', 'food'] });
        expect(riga.stops[0].openingPeriods).toHaveLength(7);
    });

    it('un giro di 13 tappe con foto e orari di apertura entra nel tetto vero della tabella (30 righe, 20.000 byte)', async () => {
        const grande = { title: 'Giro grande', city: 'Catania', steps: Array.from({ length: 13 }, (_, i) => tappa(i + 1, `Tappa numero ${i + 1} con un nome piuttosto lungo`, `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, { googlePhoto: `https://places.example/photo?ref=${'x'.repeat(380)}`, description: 'Una frase di descrizione lunga abbastanza da pesare. '.repeat(4) })) };
        const riga = giroDaSalvare(grande, 'crea');
        expect(JSON.stringify(riga.stops).length).toBeLessThanOrEqual(17000);
        expect((await salvaGiro('u1', grande, 'crea')).ok).toBe(true);
    });

    it('un giro salvato PRIMA (solo titolo e coordinate) si riapre con quello che ha, senza rompersi', () => {
        const vecchio = { id: 'v1', title: 'Vecchio giro', city: 'Roma', source: 'quiz', stops: [{ title: 'Colosseo', lat: 41.89, lng: 12.49 }, { title: 'Foro', lat: 41.892, lng: 12.485 }] };
        const t = giroSalvatoComeTour(vecchio);
        expect(t.steps.map(s => s.title)).toEqual(['Colosseo', 'Foro']);
        expect(t.steps[0]).toMatchObject({ latitude: 41.89, longitude: 12.49 });
    });
});
