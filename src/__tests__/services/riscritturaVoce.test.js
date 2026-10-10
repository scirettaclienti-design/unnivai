// P3d-c — Riscrivere invece di cancellare.
//
// Dopo i filtri della voce (parole vietate, aperture dei sensi, luce/ora) le
// descrizioni svuotate o accorciate vanno al modello in UNA sola chiamata, con
// il motivo di ognuna ("hai usato "magico""), dentro lo stesso biglietto della
// generazione. Il testo nuovo ripassa dagli stessi filtri; se non passa, il
// campo resta vuoto. Mai un secondo giro. In "Per Te" la tappa non si perde.
//
// Rosso sul codice di prima: nessuna chiamata di riscrittura, la descrizione
// restava vuota e in "Per Te" la tappa usciva; "l'unica panchina all'ombra" e
// "Consiglio: entra dal lato" venivano tolte; "ogni angolo racconta una storia"
// passava.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { filterBannedWords } from '../../lib/narrationLight';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `pv-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const LIBERAZIONE = place('Museo Storico della Liberazione', MUSEO, 0.002, 0.000);
const MUSEI = [LIBERAZIONE, place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004), place('Museo Barracco', MUSEO, -0.001, -0.002)];
const TRATTORIE = [place('Armando al Pantheon', RISTO, 0.000, 0.003), place('Da Teo', RISTO, -0.011, 0.001)];
const BARS = [place('Enoteca Il Goccetto', BAR, -0.003, -0.006)];
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['museo', 'trattoria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };

const SELECTOR = { stops: [
    { place_id: LIBERAZIONE.place_id, moment: 'g1-mattina' },
    { place_id: TRATTORIE[0].place_id, moment: 'g1-pranzo' },
    { place_id: MUSEI[1].place_id, moment: 'g1-pomeriggio' },
    { place_id: BARS[0].place_id, moment: 'g1-aperitivo' },
    { place_id: TRATTORIE[1].place_id, moment: 'g1-cena' },
] };


let calls;      // [{ kind, body }]
let rewriteFn;  // (tappe) => payload
const routeFetch = (narrate) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload; let kind;
        if (sys.includes('traduttore di intenti')) { kind = 'traduttore'; payload = INTENT; }
        else if (sys.includes('SEI IL NARRATORE')) {
            kind = 'narratore';
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(narrate) })) };
        } else if (sys.includes('Riscrivi SOLO il campo description')) {
            kind = 'riscrittura';
            const tappe = JSON.parse(user.split('TAPPE:\n')[1]);
            if (rewriteFn === 'errore') return { ok: false, status: 502, json: async () => ({ code: 'OPENAI_ERROR', error: 'x' }) };
            payload = rewriteFn(tappe);
        } else { kind = 'selettore'; payload = SELECTOR; }
        calls.push({ kind, body, user });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query');
        const hit = Object.keys(PERQUERY).find(k => q === `${k} Roma`);
        return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});

const genera = () => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' },
    'Domani voglio vivere Roma da romano', {}, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);
const allStops = (r) => r.days.flatMap(d => d.stops);
const kinds = () => calls.map(c => c.kind);
// P3d-e — testi senza oggetti concreti (cortile, scale…): qui si prova la
// riscrittura P3d-c, non il controllo anti-invenzione (fattiAncorati.test.js).
const BUONA = 'La facciata si vede intera solo dal lato opposto della strada.';
const PULITA = 'La pietra della facciata è chiara.';
const MAGICA = 'Il belvedere regala una vista che appare magica.';

describe('P3d-c — elenco: via i falsi positivi, dentro le frasi generiche', () => {
    it('le frasi buone restano', () => {
        for (const f of ["C'è l'unica panchina all'ombra di tutta la piazza.", 'Consiglio: entra dal lato del giardino.',
            "Esci presto per non perdere l'ultimo autobus.", 'Lì sotto una scoperta archeologica del 1938.', 'Si gusta in piedi al bancone.']) {
            expect(filterBannedWords(f).text, f).toBe(f);
        }
    });

    it('restano vietate le forme da brochure', () => {
        for (const f of ["Un'esperienza unica.", 'Un piatto da non perdere.', 'Assapora la carbonara.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
    });

    it('le frasi generiche vengono tolte', () => {
        for (const f of ['Osserva le statue, ogni angolo racconta una storia.', 'Le pareti raccontano storie di epoche passate.',
            'Le stanze sembrano raccontare storie.', 'Ogni sala è un viaggio nel tempo.', 'Goditi la vista dalla scalinata.',
            'Sentire la crosta sotto le dita è un’esperienza.', 'I dettagli barocchi raccontano molto.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
    });
});

// P3d-j — la riscrittura non esiste piu': il modello sceglie fra opzioni chiuse
// e il codice compone (stopPhrases). Resta qui il controllo dell'elenco.
