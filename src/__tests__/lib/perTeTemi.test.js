// PER-TE-TRE (T27) — l'ordine dei temi secondo il DNA e il gruppo di tappe dentro il tetto.
import { describe, it, expect } from 'vitest';
import { ordineTemi, temiDaComporre, gruppoDelTema, stessoPosto, tappeDelTemaMinime, PASSIONI_MINIME } from '@/lib/perTeTemi';
import { kmTratto, TETTO_PIEDI_KM } from '@/lib/tettoCammino';
import { TESTI_PER_TE } from '@/lib/testiHome';

const C = { latitude: 41.9, longitude: 12.5 };
const posto = (id, kmNord, extra = {}) => ({ place_id: id, name: id, types: ['park'], latitude: C.latitude + kmNord * 0.009, longitude: C.longitude, ...extra });
const start = new Date('2026-11-06T10:00:00+01:00');

describe('ordineTemi — i temi seguono il DNA', () => {
    it('il DNA di Ivano: natura, cibo, cultura, poi il resto', () => {
        expect(ordineTemi({ natura: 0.46, food: 0.39, cultura: 0.2, _share: 0.45 })).toEqual(['nature', 'food', 'cultura', 'romance']);
    });
    it('senza fiducia i pesi non contano: l’ordine di difetto', () => {
        expect(ordineTemi({ natura: 0.9, _share: 0 })).toEqual(['cultura', 'food', 'nature', 'romance']);
        expect(ordineTemi(null)).toEqual(['cultura', 'food', 'nature', 'romance']);
    });
    it('due categorie dello stesso tema ne portano uno; chi non ha un tema non ne porta', () => {
        expect(ordineTemi({ arte: 0.5, cultura: 0.4, nightlife: 0.9, _share: 0.3 }).slice(0, 2)).toEqual(['cultura', 'food']);
    });
    it('le passioni che contano sono tre', () => { expect(PASSIONI_MINIME).toBe(3); });
    it('temiDaComporre: i temi già serviti restano fuori, l’ordine resta quello del DNA', () => {
        expect(temiDaComporre(['insider', 'cultura', 'romance'], ['nature', 'food', 'cultura', 'romance'])).toEqual(['nature', 'food']);
    });
});

describe('gruppoDelTema — le regole del motore non si allentano', () => {
    it('sceglie tappe legate entro il tetto, anche se le prime per merito stanno lontane', () => {
        const g = gruppoDelTema({ tema: [posto('lontano', 8), posto('a', 0), posto('b', 0.5), posto('c', 1), posto('d', 1.5)], start });
        expect(g.map(c => c.place_id)).toEqual(['a', 'b', 'c', 'd']);
        for (let i = 1; i < g.length; i++) expect(kmTratto(g[i - 1], g[i])).toBeLessThanOrEqual(TETTO_PIEDI_KM);
    });
    it('parchi tutti oltre il tetto: nessun gruppo, mai un tratto lungo per fare numero', () => {
        expect(gruppoDelTema({ tema: [posto('a', 0), posto('b', 3), posto('c', 6)], start })).toBeNull();
    });
    it('un posto chiuso all’arrivo non entra', () => {
        const chiuso = posto('chiuso', 0.3, { openingPeriods: Array.from({ length: 7 }, (_, day) => ({ open: { day, time: '2000' }, close: { day, time: '2200' } })) });
        const g = gruppoDelTema({ tema: [posto('a', 0), chiuso, posto('b', 0.6), posto('c', 1)], start });
        expect(g.map(c => c.place_id)).not.toContain('chiuso');
    });
    it('la regola del chiamante vale (pasti, dolci, buio)', () => {
        const g = gruppoDelTema({ tema: [posto('a', 0), posto('vietato', 0.2), posto('b', 0.5), posto('c', 0.9)], start, valido: (c) => (c.place_id === 'vietato' ? 'pasto fuori fascia' : null) });
        expect(g.map(c => c.place_id)).toEqual(['a', 'b', 'c']);
    });
    it('riempie attorno con gli altri temi, ma sotto il minimo del tema non c’è giro', () => {
        const altri = [posto('x', 0.3), posto('y', 0.6), posto('z', 0.9)];
        expect(gruppoDelTema({ tema: [posto('a', 0)], altri, start, minTema: 2 })).toBeNull();
        const cibo = gruppoDelTema({ tema: [posto('a', 0)], altri, start, minTema: tappeDelTemaMinime('food') });
        expect(cibo.map(c => c.place_id)).toEqual(['a', 'x', 'y', 'z']);
    });
    it('sotto le 3 tappe non è un giro', () => {
        expect(gruppoDelTema({ tema: [posto('a', 0), posto('b', 0.4)], start })).toBeNull();
    });
    it('i posti già usati in un altro tour non tornano', () => {
        const g = gruppoDelTema({ tema: [posto('a', 0), posto('b', 0.4), posto('c', 0.8), posto('d', 1.2)], start, escludi: new Set(['a']) });
        expect(g.map(c => c.place_id)).not.toContain('a');
    });
    it('due schede dello stesso posto contano una', () => {
        const g = gruppoDelTema({ tema: [posto('Villa Doria Pamphili', 0), posto('Ingresso di Villa Pamphili', 0.2), posto('Pioppo Nero', 0.5), posto('Vascello', 0.9)], start });
        expect(g.map(c => c.place_id)).toEqual(['Villa Doria Pamphili', 'Pioppo Nero', 'Vascello']);
    });
});

describe('stessoPosto', () => {
    it.each([
        ['Ingresso di Villa Pamphili', 'Villa Doria Pamphili'],
        ['Galleria Colonna', 'Galleria del Cardinale Colonna'],
        ['Casa Natale di Vincenzo Bellini', 'Museo Vincenzo Bellini'],
        ['Passeggiata del Gianicolo', 'Terrazza Panoramica Passeggiata del Gianicolo'],
    ])('%s = %s', (a, b) => expect(stessoPosto({ name: a }, { title: b })).toBe(true));
    it.each([
        ['Chiesa della Badia di Sant’Agata', 'Cattedrale di Sant’Agata'],
        ['Villa Borghese', 'Villa Sciarra'],
        ['Museo', 'Galleria'],
    ])('%s ≠ %s', (a, b) => expect(stessoPosto({ name: a }, { name: b })).toBe(false));
});

describe('la riga di una passione senza proposta', () => {
    it('dice quale e dove, e tace se non manca niente', () => {
        expect(TESTI_PER_TE.passioneMancante(['nature'], 'Catania')).toBe('Per la natura, a Catania, adesso non ho un giro a piedi che regga.');
        expect(TESTI_PER_TE.passioneMancante(['nature', 'food'], 'Roma')).toBe('Per la natura e il cibo, a Roma, adesso non ho un giro a piedi che regga.');
        expect(TESTI_PER_TE.passioneMancante([], 'Roma')).toBeNull();
    });
});
