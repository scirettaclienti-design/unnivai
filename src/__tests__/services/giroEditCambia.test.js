// GIRO-EDIT — «Cambia»: una sola ricerca mirata vicino alla tappa, scelta dal testo e dal DNA, mai oltre 500 m, solo posti aperti a
// quell'ora; senza risultato la tappa resta. 0 $: la rete è finta (`cerca`).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/dnaRegistro', () => ({ logDnaEvent: vi.fn() }));

import { logDnaEvent } from '@/lib/dnaRegistro';
import { leggiTestoDelCambio, scegliSostituta, cambiaTappa, RAGGIO_CAMBIO_M, MESSAGGIO_NIENTE_DI_ADATTO, COSTO_CAMBIO_USD } from '@/services/cambiaTappaService';
import { cambiaNelGiorno, togliDalGiorno } from '@/services/giroEditAzioni';
import { ricalcolaGiorno, chiaveTappa } from '@/lib/giroEdit';
import { stopClockLabel } from '@/lib/stopMoments';

const ore = (da = '0700', a = '2300') => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
const LAT = 37.5, LNG = 15.08;
const at = (nordM, estM = 0) => ({ latitude: LAT + nordM / 111000, longitude: LNG + estM / 88000 });
const posto = (id, name, types, primary, pos, extra = {}) => ({ place_id: id, name, types, primaryType: primary, ...at(...pos), rating: 4.6, user_ratings_total: 300, opening_hours: ore(), ...extra });
const T = (hhmm) => new Date(`2026-10-27T${hhmm}:00+01:00`).getTime();

const tappaDi = (p, moment) => ({ title: p.name, place_id: p.place_id, moment, latitude: p.latitude, longitude: p.longitude, lat: p.latitude, lng: p.longitude, types: p.types, primaryType: p.primaryType, opening_hours: p.opening_hours });
const MUSEO = posto('m1', 'Museo Civico', ['museum'], 'museum', [0, 0]);
const TRATTORIA = posto('t1', 'Trattoria Sorano', ['restaurant', 'food'], 'restaurant', [200, 0]);
const CHIESA = posto('c1', 'Chiesa di San Nicolò', ['church', 'place_of_worship'], 'church', [400, 0]);
const FONTANA = posto('f1', 'Fontana Vecchia', ['tourist_attraction'], 'tourist_attraction', [600, 0]);

const giro = () => ricalcolaGiorno([tappaDi(MUSEO, 'mattina'), tappaDi(TRATTORIA, 'pranzo'), tappaDi(CHIESA, 'pomeriggio'), tappaDi(FONTANA, 'pomeriggio')], { inizioMs: T('09:30') });

// i candidati della ricerca, attorno alla chiesa (400 m a nord): [nord, est] in metri dal punto zero
const GIARDINO_VICINO = posto('g1', 'Giardino Bellini', ['park'], 'park', [520, 20]);
const GIARDINO_LONTANO = posto('g2', 'Parco Lontano', ['park'], 'park', [1200, 0]);
const GIARDINO_CHIUSO = posto('g3', 'Giardino Chiuso', ['park'], 'park', [450, 10], { opening_hours: ore('0900', '1200') });
const GIARDINO_BASSO = posto('g4', 'Giardino Mediocre', ['park'], 'park', [430, 10], { rating: 3.4, user_ratings_total: 12 });
const STREET = posto('s1', 'Arancine da Totò', ['meal_takeaway', 'restaurant', 'food'], 'meal_takeaway', [440, 20]);

beforeEach(() => vi.clearAllMocks());

describe('«Cambia» — il testo dell\'utente', () => {
    it('legge le richieste della scheda: street food, più tranquillo, un parco', () => {
        expect(leggiTestoDelCambio('un posto di street food')).toMatchObject({ id: 'street-food', kind: 'FOOD', esplicita: true });
        expect(leggiTestoDelCambio('qualcosa di più tranquillo')).toMatchObject({ id: 'tranquillo', kind: 'NATURA', esplicita: false });
        expect(leggiTestoDelCambio('un parco')).toMatchObject({ id: 'verde' });
    });
    it('un testo che la tabella non conosce va a Google com\'è; un testo vuoto cerca lo stesso tipo di posto', () => {
        expect(leggiTestoDelCambio('zzz qualcosa di strano').id).toBe('testo');
        expect(leggiTestoDelCambio('', { types: ['church'], primaryType: 'church' }).id).toBe('chiesa');
    });
});

describe('«Cambia» — la scelta', () => {
    const tappa = giro().stops[2];
    const lettura = leggiTestoDelCambio('qualcosa di più tranquillo');
    it('sceglie un posto vero, aperto, entro 500 m; scarta il lontano, il chiuso, il sotto soglia', () => {
        const r = scegliSostituta({ candidati: [GIARDINO_LONTANO, GIARDINO_CHIUSO, GIARDINO_BASSO, GIARDINO_VICINO], tappa, giorno: giro().stops, lettura, city: 'Catania' });
        expect(r.scelto.place_id).toBe('g1');
        expect(r.distanzaM).toBeLessThanOrEqual(RAGGIO_CAMBIO_M);
        expect(r.scartati['oltre i 500 m']).toBe(1);
        expect(r.scartati['chiuso o senza orario a quell\'ora']).toBe(1);
        expect(r.scartati['sotto la soglia di qualita\'']).toBe(1);
    });
    it('non ripete un posto già nel giro', () => {
        const r = scegliSostituta({ candidati: [posto('t1', 'Trattoria Sorano', ['park'], 'park', [410, 0])], tappa, giorno: giro().stops, lettura, city: 'Catania' });
        expect(r.scelto).toBeNull();
    });
    it('il DNA decide a parità: con la natura forte vince il parco, con il cibo forte il caffè', () => {
        const caffe = posto('k1', 'Caffè Storico', ['cafe', 'food'], 'cafe', [430, 0], { rating: 4.6 });
        const parco = posto('g9', 'Parco Etneo', ['park'], 'park', [430, 0], { rating: 4.6 });
        const l = { esplicita: true };
        const conNatura = scegliSostituta({ candidati: [caffe, parco], tappa, giorno: [], lettura: l, dnaWeights: { natura: 0.9, food: 0.1 }, city: 'Catania' });
        const conFood = scegliSostituta({ candidati: [caffe, parco], tappa, giorno: [], lettura: l, dnaWeights: { natura: 0.1, food: 0.9 }, city: 'Catania' });
        expect(conNatura.scelto.place_id).toBe('g9');
        expect(conFood.scelto.place_id).toBe('k1');
    });
    it('chiesto uno street food nel pomeriggio, lo street food entra (la richiesta vince sulle fasce dei pasti)', () => {
        const l = leggiTestoDelCambio('un posto di street food');
        const r = scegliSostituta({ candidati: [STREET], tappa, giorno: [], lettura: l, city: 'Catania' });
        expect(r.scelto?.place_id).toBe('s1');
        // senza la richiesta, un pasto da asporto nel pomeriggio non entra
        const senza = scegliSostituta({ candidati: [STREET], tappa, giorno: [], lettura: leggiTestoDelCambio('qualcosa di più tranquillo'), city: 'Catania' });
        expect(senza.scelto).toBeNull();
    });
});

describe('«Cambia» — una sola ricerca, e se non trova la tappa resta', () => {
    it('fa UNA ricerca (raggio 500 m, costo dichiarato) e restituisce la tappa nuova', async () => {
        const cerca = vi.fn().mockResolvedValue([GIARDINO_VICINO]);
        const tappa = giro().stops[2];
        const r = await cambiaTappa({ tappa, giorno: giro().stops, testo: 'qualcosa di più tranquillo', city: 'Catania', cerca });
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(cerca.mock.calls[0][4]).toBe(500);
        expect(r.ok).toBe(true);
        expect(r.stop.title).toBe('Giardino Bellini');
        expect(r.report.ricerche).toBe(1);
        expect(r.report.costoMassimoUsd).toBe(COSTO_CAMBIO_USD);
    });
    it('senza risultato lo dice in una riga e non cambia niente', async () => {
        const cerca = vi.fn().mockResolvedValue([]);
        const r = await cambiaTappa({ tappa: giro().stops[2], giorno: giro().stops, testo: 'un parco', city: 'Catania', cerca });
        expect(r.ok).toBe(false);
        expect(r.messaggio).toBe(MESSAGGIO_NIENTE_DI_ADATTO);
        expect(cerca).toHaveBeenCalledTimes(1);
    });
    it('una ricerca che fallisce non rompe niente', async () => {
        const cerca = vi.fn().mockRejectedValue(new Error('rete'));
        const r = await cambiaTappa({ tappa: giro().stops[2], giorno: giro().stops, testo: 'un parco', city: 'Catania', cerca });
        expect(r.ok).toBe(false);
        expect(r.messaggio).toMatch(/la tappa resta/);
    });
});

describe('«Togli» e «Cambia» nel giorno, con il DNA', () => {
    it('Cambia: sostituisce solo quella tappa, ricalcola gli orari dopo; nel DNA solo la categoria della tappa nuova, mai il testo', async () => {
        const stops = giro().stops;
        const cerca = vi.fn().mockResolvedValue([GIARDINO_VICINO]);
        const r = await cambiaNelGiorno({ stops, chiave: chiaveTappa(stops[2]), testo: 'qualcosa di più tranquillo SEGRETO', city: 'Catania', cerca });
        expect(r.ok).toBe(true);
        expect(r.stops.map(s => s.title)).toEqual(['Museo Civico', 'Trattoria Sorano', 'Giardino Bellini', 'Fontana Vecchia']);
        expect(r.stops[2].moment).toBe('pomeriggio');
        expect(stopClockLabel(r.stops[3])).not.toBeNull();
        expect(logDnaEvent).toHaveBeenCalledTimes(1);
        const [kind, campi] = logDnaEvent.mock.calls[0];
        expect(kind).toBe('quiz_choice');
        expect(campi.category).toBeTruthy();
        expect(JSON.stringify(logDnaEvent.mock.calls)).not.toMatch(/SEGRETO|tranquillo/);
    });
    it('Cambia senza risultato: nessun evento, nessuna modifica', async () => {
        const stops = giro().stops;
        const r = await cambiaNelGiorno({ stops, chiave: chiaveTappa(stops[2]), testo: 'un parco', city: 'Catania', cerca: vi.fn().mockResolvedValue([]) });
        expect(r.ok).toBe(false);
        expect(r.stops).toBeUndefined();
        expect(logDnaEvent).not.toHaveBeenCalled();
    });
    it('Togli: la tappa è saltata nel DNA (stop_skipped) e gli orari dopo si ricalcolano', () => {
        const stops = giro().stops;
        const r = togliDalGiorno({ stops, chiave: chiaveTappa(stops[2]), city: 'Catania' });
        expect(r.ok).toBe(true);
        expect(r.stops.map(s => s.title)).toEqual(['Museo Civico', 'Trattoria Sorano', 'Fontana Vecchia']);
        expect(logDnaEvent).toHaveBeenCalledWith('stop_skipped', expect.objectContaining({ city: 'Catania', moment: 'pomeriggio' }));
        const dopo = new Date(r.stops[2].scheduledTime).getTime();
        expect(dopo).toBeGreaterThanOrEqual(T('14:30'));
    });
});
