// C8a — la sera e il Veloce: le parti pure.
//   · la sosta del drink dipende dal momento (45 min; 60 con ritmo Rilassato; il bar di giorno resta 20);
//   · la passeggiata fra il drink e la cena (momento facoltativo, solo all'aperto);
//   · il Percorso Veloce da 18:00: drink, passeggiata e cena facoltativa;
//   · mai uno scheletro vuoto.
// Istanti con offset di Roma esplicito: la CI gira in UTC. Mercoledi' 14 ottobre 2026.
import { describe, it, expect } from 'vitest';
import {
    stayInMoment, stayOf, computeStopTimings, APERITIVO_STAY_MINUTES, APERITIVO_STAY_RELAX_MINUTES,
} from '@/lib/tourTiming';
import { buildDaySkeleton, addEveningWalk, WALK_CATEGORIES } from '@/lib/daySkeleton';
import { resolveTourWindow } from '@/lib/tourWindow';
import { momentAdmits, isWalkPlace, isOutdoorWalk } from '@/lib/mealRules';

const at = (hhmm) => new Date(`2026-10-14T${hhmm}:00+02:00`);
const quick = (hhmm, duration = 'Veloce') => resolveTourWindow({ text: '', requestTime: at(hhmm), pathType: 'quick', duration });
const custom = (text, hhmm, duration = '') => resolveTourWindow({ text, requestTime: at(hhmm), pathType: 'custom', duration });
const keys = (sk, i = 0) => sk.days[i].moments.map(m => m.key);
const hhmm = (d) => d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

const COCKTAIL_BAR = { primaryType: 'cocktail_bar', types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'] };
const CAFFE = { primaryType: 'cafe', types: ['cafe', 'food'] };
const RISTORANTE = { primaryType: 'italian_restaurant', types: ['italian_restaurant', 'restaurant', 'food'] };
const MUSEO = { primaryType: 'museum', types: ['museum'] };
const PARCO = { primaryType: 'park', types: ['park', 'point_of_interest'] };

describe('C8a — la sosta del drink dipende dal momento', () => {
    it('un bar di giorno resta 20 minuti (le durate C6a non cambiano)', () => {
        expect(stayOf(COCKTAIL_BAR)).toBe(20);
        expect(stayInMoment(COCKTAIL_BAR, null)).toBe(20);
        expect(stayInMoment(COCKTAIL_BAR, { key: 'pomeriggio' })).toBe(20);
        expect(stayInMoment(CAFFE, { key: 'mattina' })).toBe(20);
    });
    it('all\'aperitivo un bar dura 45 minuti, 60 con ritmo Rilassato', () => {
        expect(stayInMoment(COCKTAIL_BAR, { key: 'aperitivo', sostaAperitivo: APERITIVO_STAY_MINUTES })).toBe(45);
        expect(stayInMoment(COCKTAIL_BAR, { key: 'aperitivo', sostaAperitivo: APERITIVO_STAY_RELAX_MINUTES })).toBe(60);
        expect(stayInMoment(CAFFE, { key: 'aperitivo', sostaAperitivo: 45 })).toBe(45);
    });
    it('le altre durate non cambiano nemmeno all\'aperitivo (ristorante 75, museo 60, parco 30)', () => {
        const m = { key: 'aperitivo', sostaAperitivo: 45 };
        expect(stayInMoment(RISTORANTE, m)).toBe(75);
        expect(stayInMoment(MUSEO, m)).toBe(60);
        expect(stayInMoment(PARCO, m)).toBe(30);
    });
    it('computeStopTimings: la tappa d\'aperitivo porta la sua sosta, le altre no', () => {
        const stops = [
            { ...COCKTAIL_BAR, latitude: 37.5, longitude: 15.08, moment: 'aperitivo', sostaAperitivo: 45 },
            { ...COCKTAIL_BAR, latitude: 37.501, longitude: 15.08, moment: 'pomeriggio' },
        ];
        const { stops: t } = computeStopTimings(stops);
        expect(t.map(s => s.stayMinutes)).toEqual([45, 20]);
    });
    it('lo scheletro scrive la sosta sull\'aperitivo: 45, e 60 con Rilassato', () => {
        const att = buildDaySkeleton({ window: custom('stasera', '18:00'), pace: 'Attivo' });
        const ril = buildDaySkeleton({ window: custom('stasera', '18:00'), pace: 'Rilassato' });
        expect(att.days[0].moments.find(m => m.key === 'aperitivo').sostaAperitivo).toBe(45);
        expect(ril.days[0].moments.find(m => m.key === 'aperitivo').sostaAperitivo).toBe(60);
        expect(att.days[0].moments.find(m => m.key === 'cena').sostaAperitivo).toBeUndefined();
    });
});

describe('C8a — la passeggiata fra il drink e la cena', () => {
    it('aperitivo 18:00 e cena 20:00 (restano 75 minuti): un momento passeggiata dopo il drink, facoltativo, solo all\'aperto', () => {
        const sk = addEveningWalk(buildDaySkeleton({ window: custom('stasera', '18:00') }));
        expect(keys(sk)).toEqual(['aperitivo', 'passeggiata', 'cena']);
        const w = sk.days[0].moments[1];
        expect(w).toMatchObject({ opzionale: true, soloCategorie: true, stops: 1, viewKey: 'aperitivo' });
        expect(w.categories).toEqual(WALK_CATEGORIES);
        // finisce 20 minuti prima della cena: una passeggiata che non ci sta non fa slittare la cena
        expect(hhmm(w.end)).toBe('19:40');
        expect(sk.days[0].totalStops).toBe(3);
    });
    it('se restano 30 minuti o meno non c\'è passeggiata (aperitivo chiesto per nome a 19:15: drink fino alle 20:00)', () => {
        const text = 'un aperitivo e poi cena';
        const sk = addEveningWalk(buildDaySkeleton({ window: custom(text, '19:15'), text }));
        expect(keys(sk)).toEqual(['aperitivo', 'cena']);
    });
    it('"aperitivo e cena" a 19:30: l\'aperitivo chiesto entra anche se la finestra lo sfiora (30 minuti)', () => {
        const senza = buildDaySkeleton({ window: custom('cena', '19:30', 'Mezza Giornata'), text: 'cena' });
        expect(keys(senza)).toEqual(['cena']);
        const con = buildDaySkeleton({ window: custom('aperitivo e cena', '19:30', 'Mezza Giornata'), text: 'aperitivo e cena' });
        expect(keys(con)).toEqual(['aperitivo', 'cena']);
    });
    it('una giornata intera ha la passeggiata solo fra aperitivo e cena, e non conta nelle 8 tappe', () => {
        const sk = addEveningWalk(buildDaySkeleton({ window: custom('domani', '10:00', '1 Giorno'), pace: 'Attivo' }));
        expect(keys(sk)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'passeggiata', 'cena']);
        expect(sk.days[0].moments.filter(m => m.key === 'passeggiata')).toHaveLength(1);
    });
    it('con ritmo Rilassato il drink dura 60 minuti: restano 60, la passeggiata c\'e\' ancora', () => {
        const sk = addEveningWalk(buildDaySkeleton({ window: custom('stasera', '18:00'), pace: 'Rilassato' }));
        expect(keys(sk)).toEqual(['aperitivo', 'passeggiata', 'cena']);
    });
    it('un posto per la passeggiata non e\' mai un bar, un ristorante, un museo', () => {
        expect(isWalkPlace(PARCO)).toBe(true);
        expect(isWalkPlace({ types: ['tourist_attraction'] })).toBe(true);
        expect(isWalkPlace(COCKTAIL_BAR)).toBe(false);
        expect(isWalkPlace(RISTORANTE)).toBe(false);
        expect(isWalkPlace(MUSEO)).toBe(false);
        expect(momentAdmits(COCKTAIL_BAR, { key: 'passeggiata' })).toBe(false);
        expect(momentAdmits(PARCO, { key: 'passeggiata' })).toBe(true);
        // neppure una richiesta esplicita di ristoranti la apre ai locali
        expect(momentAdmits(RISTORANTE, { key: 'passeggiata', esplicitoPasti: true })).toBe(false);
    });
});

describe('C8a — un luogo all\'aperto per la passeggiata', () => {
    const luogo = (name, extra = {}) => ({ name, types: ['tourist_attraction', 'point_of_interest'], ...extra });
    it('fontane, porte, ponti, scalinate, piazze, belvedere, lungomari, giardini sono all\'aperto', () => {
        for (const n of ['Fontana dell’Amenano', 'Porta Uzeda', 'Ponte Vecchio', 'Scalinata di Trinità dei Monti', 'Piazza Università', 'Belvedere Tarpeo', 'Lungomare Ognina', 'Villa Bellini', 'Giardino Aretusa']) {
            expect(isOutdoorWalk(luogo(n)), n).toBe(true);
        }
    });
    it('anche dal tipo: sentiero, punto panoramico, piazza, porto turistico', () => {
        for (const t of ['hiking_area', 'scenic_spot', 'observation_deck', 'town_square', 'plaza', 'marina']) {
            expect(isOutdoorWalk({ name: 'Un posto', types: [t] }), t).toBe(true);
        }
    });
    it('un palazzo, un museo, una chiesa, un bar, un ristorante non lo sono', () => {
        expect(isOutdoorWalk(luogo('Palazzo degli Elefanti'))).toBe(false);
        expect(isOutdoorWalk({ name: 'Museo Bellini', types: ['museum'], primaryType: 'museum' })).toBe(false);
        expect(isOutdoorWalk({ name: 'Chiesa della Badia', types: ['church'], primaryType: 'church' })).toBe(false);
        expect(isOutdoorWalk(COCKTAIL_BAR)).toBe(false);
        expect(isOutdoorWalk(RISTORANTE)).toBe(false);
        // un bar che si chiama "Terrazza…" resta un bar
        expect(isOutdoorWalk({ name: 'Terrazza Martini', primaryType: 'cocktail_bar', types: ['cocktail_bar', 'bar'] })).toBe(false);
    });
});

describe('C8a — Percorso Veloce da 18:00: drink + passeggiata + cena', () => {
    const veloce = (hh, duration) => addEveningWalk(buildDaySkeleton({ window: quick(hh, duration), veloce: true }), { veloce: true });

    it('18:00: aperitivo, passeggiata, cena (la cena e\' facoltativa)', () => {
        const sk = veloce('18:00');
        expect(keys(sk)).toEqual(['aperitivo', 'passeggiata', 'cena']);
        const [drink, walk, cena] = sk.days[0].moments;
        expect(drink).toMatchObject({ bevuta: true, soloCategorie: true, sostaAperitivo: 45 });
        expect(drink.categories).toEqual(['bar']);
        expect(walk.opzionale).toBe(true);
        expect(cena).toMatchObject({ opzionale: true, soloAperti: true });
        expect(hhmm(cena.start)).toBe('20:00');
    });
    it('21:25: il drink parte da adesso, la cena e\' attesa dopo drink e passeggiata (non prima delle 22:50), facoltativa e solo se aperta', () => {
        const sk = veloce('21:25');
        expect(keys(sk)).toEqual(['aperitivo', 'passeggiata', 'cena']);
        const [drink, , cena] = sk.days[0].moments;
        expect(hhmm(drink.start)).toBe('21:25');
        expect(hhmm(cena.start)).toBe('22:50');
        expect(cena).toMatchObject({ opzionale: true, soloAperti: true });
    });
    it('21:45 (il caso Catania): non uno scheletro vuoto; la cena non puo\' piu\' cominciare entro le 23:00 → drink + passeggiata', () => {
        const sk = veloce('21:45');
        expect(sk.days[0].moments.length).toBeGreaterThan(0);
        expect(keys(sk)).toEqual(['aperitivo', 'passeggiata']);
    });
    it('21:35: la cena (arrivo stimato 23:00) e\' l\'ultima possibile; 21:36 no', () => {
        expect(keys(veloce('21:30'))).toEqual(['aperitivo', 'passeggiata', 'cena']);
        expect(keys(veloce('21:36'))).toEqual(['aperitivo', 'passeggiata']);
    });
    it('a un tour che parte di sera il drink e\' un bar (niente belvedere); di giorno la tabella resta com\'e\'', () => {
        const sera = addEveningWalk(buildDaySkeleton({ window: custom('stasera', '18:00') }));
        expect(sera.days[0].moments.find(m => m.key === 'aperitivo').categories).toEqual(['bar']);
        const giorno = addEveningWalk(buildDaySkeleton({ window: custom('domani', '10:00', '1 Giorno') }));
        expect(giorno.days[0].moments.find(m => m.key === 'aperitivo').categories).toEqual(['bar', 'punti panoramici']);
    });
    it('23:30: dopo le 22:30 non c\'e\' piu\' una cena; il drink e\' notturno (dopocena) e la passeggiata lo segue', () => {
        const sk = veloce('23:30');
        expect(keys(sk)).toEqual(['dopocena', 'passeggiata']);
        const [drink, walk] = sk.days[0].moments;
        expect(drink.categories).toEqual(['bar', 'vita notturna']);
        expect(drink.sostaAperitivo).toBe(45);
        expect(walk.viewKey).toBe('dopocena');
    });
    it('dopo mezzanotte (00:10) e prima dell\'alba lo scheletro non e\' vuoto', () => {
        const sk = veloce('00:10');
        expect(keys(sk)).toEqual(['dopocena', 'passeggiata']);
    });
    it('ritmo Rilassato: il drink dura 60 minuti', () => {
        const sk = addEveningWalk(buildDaySkeleton({ window: quick('21:45'), pace: 'Rilassato', veloce: true }), { veloce: true });
        expect(sk.days[0].moments[0].sostaAperitivo).toBe(60);
    });
    it('prima delle 18:00 il Veloce resta quello di sempre (15:00: solo il pomeriggio)', () => {
        const sk = veloce('15:00');
        expect(keys(sk)).toEqual(['pomeriggio']);
    });
    it('senza la bandiera del Veloce (Sorprendimi, Crea) lo scheletro serale non cambia', () => {
        const sk = buildDaySkeleton({ window: quick('18:00') });
        expect(keys(sk)).toEqual(['aperitivo']);
    });
});

describe('C8a — mai uno scheletro vuoto', () => {
    it('21:45–23:45 senza il flag del Veloce: il momento sera/notte che contiene la finestra', () => {
        const sk = buildDaySkeleton({ window: quick('21:45') });
        expect(keys(sk)).toEqual(['dopocena']);
        expect(sk.days[0].moments[0].daRiserva).toBe(true);
    });
    it('un momento vero non riceve la riserva (15:00: pomeriggio)', () => {
        const sk = buildDaySkeleton({ window: quick('15:00') });
        expect(sk.days[0].moments[0].daRiserva).toBeUndefined();
    });
});
