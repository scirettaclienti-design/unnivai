// BORGO-FIX — le sei decisioni di Ivano (task BORGO-COMPLETO, fase 2), una per una, sulle funzioni pure del motore.
import { describe, it, expect } from 'vitest';
import { isOrganizzazione, isNaturaDaFuori, NOTA_NATURA_NOTTE, chiedeGiornata, isNaturaOPanorama, NATURA_DENTRO_KM } from '@/lib/borgoConfini';
import { candidateMomentCategories, bucketCandidates, isBarOrPub, WALK_NATURA_BORGO_MINUTES, MAX_WALK_MINUTES, flattenSkeleton } from '@/services/momentSelection';
import { passesQualityThreshold, selectScoredCandidatePool, QUALITY_THRESHOLDS } from '@/services/candidateScoring';
import { buildDaySkeleton, addEveningWalk } from '@/lib/daySkeleton';
import { romeDate } from '@/lib/tourWindow';

const troina = { latitude: 37.784, longitude: 14.6 };
const posto = (name, types, extra = {}) => ({ place_id: `id-${name}`, name, types, primaryType: types[0], rating: 4.5, user_ratings_total: 50, ...extra });

describe('BORGO-FIX decisione 2 — i tipi di natura della ricerca nuova hanno una categoria di momento', () => {
    it('scenic_spot e observation_deck sono punti panoramici e natura; sentieri, riserve, parchi e giardini sono natura', () => {
        expect([...candidateMomentCategories(posto('Monte Muganà', ['scenic_spot', 'point_of_interest']))]).toEqual(expect.arrayContaining(['punti panoramici', 'natura']));
        expect([...candidateMomentCategories(posto('Belvedere', ['observation_deck']))]).toEqual(expect.arrayContaining(['punti panoramici', 'natura']));
        for (const t of ['hiking_area', 'nature_preserve', 'national_park', 'state_park', 'garden']) {
            expect(candidateMomentCategories(posto('X', [t])).has('natura'), t).toBe(true);
        }
    });
    it('Monte Muganà sta nel pomeriggio (natura) e nella passeggiata', () => {
        const moments = [{ id: 'g1-pomeriggio', key: 'pomeriggio', categories: ['cultura', 'natura', 'shopping', 'passeggiata'] }, { id: 'g1-passeggiata', key: 'passeggiata', categories: ['punti panoramici', 'passeggiata', 'natura'] }];
        const b = bucketCandidates(moments, [posto('Monte Muganà', ['scenic_spot', 'point_of_interest', 'establishment'])]);
        expect(b.get('g1-pomeriggio').map(c => c.name)).toEqual(['Monte Muganà']);
        expect(b.get('g1-passeggiata').map(c => c.name)).toEqual(['Monte Muganà']);
    });
});

describe('BORGO-FIX decisione 6 — un posto con nome da organizzazione non e\' una tappa', () => {
    it('Azienda Speciale Silvo Pastorale (park) e Cammina con Turi (soli tipi generici) sono organizzazioni; un monte, un rudere e una chiesa no', () => {
        expect(isOrganizzazione(posto('Azienda Speciale Silvo Pastorale', ['park', 'point_of_interest', 'establishment']))).toBe(true);
        expect(isOrganizzazione(posto('Cammina con Turi - Escursioni Nebrodi con Salvo Di Vincenzo', ['point_of_interest', 'establishment']))).toBe(true);
        expect(isOrganizzazione(posto('Monte Muganà', ['scenic_spot', 'point_of_interest']))).toBe(false);
        expect(isOrganizzazione(posto('Ruderi Monastero Nuovo', ['point_of_interest']))).toBe(false);
        expect(isOrganizzazione(posto('Chiesa di San Silvestro Monaco Basiliano', ['point_of_interest', 'establishment']))).toBe(false);
        // un ristorante «Agenzia del Gusto» non e' natura e ha tipi specifici: non si giudica qui
        expect(isOrganizzazione(posto('Agenzia del Gusto', ['restaurant', 'food']))).toBe(false);
    });
});

describe('BORGO-FIX decisione 5 — nel borgo bastano 5 recensioni per natura e panorami', () => {
    const belvedere = posto('Belvedere della Piazza Conte Ruggero', ['scenic_spot'], { rating: 5, user_ratings_total: 8 });
    it('con borgoNatura il belvedere passa; senza (isSmallTown: 10 recensioni) no; un bar con 8 recensioni resta fuori anche nel borgo', () => {
        expect(passesQualityThreshold(belvedere, 'Troina')).toBe(false);
        expect(passesQualityThreshold(belvedere, 'Troina', { borgoNatura: isNaturaOPanorama })).toBe(true);
        expect(passesQualityThreshold(posto('Bar', ['bar'], { rating: 5, user_ratings_total: 8 }), 'Troina', { borgoNatura: isNaturaOPanorama })).toBe(false);
        expect(QUALITY_THRESHOLDS.borgoNatura.minReviews).toBe(5);
        expect(selectScoredCandidatePool([belvedere], { city: 'Troina', borgoNatura: isNaturaOPanorama }).map(c => c.name)).toEqual([belvedere.name]);
        expect(selectScoredCandidatePool([belvedere], { city: 'Troina' })).toEqual([]);
    });
});

describe('BORGO-FIX decisione 4 — nel dopocena del borgo entra un locale con bar o pub fra i tipi', () => {
    const blackWhite = posto('Black & White', ['italian_restaurant', 'irish_pub', 'pub', 'bar', 'restaurant', 'food']);
    const dopocena = { id: 'g1-dopocena', key: 'dopocena', categories: ['bar', 'vita notturna'] };
    it('Black & White (tipo principale ristorante, con pub e bar) sta nel dopocena solo col borgo; in citta\' resta un ristorante', () => {
        expect(isBarOrPub(blackWhite)).toBe(true);
        expect(bucketCandidates([dopocena], [blackWhite], { borgo: true }).get('g1-dopocena').map(c => c.name)).toEqual(['Black & White']);
        expect(bucketCandidates([dopocena], [blackWhite], { borgo: false }).get('g1-dopocena')).toEqual([]);
        // a pranzo resta un ristorante, come sempre; un ristorante senza bar ne' pub non entra nel dopocena nemmeno nel borgo
        expect(bucketCandidates([{ id: 'g1-pranzo', key: 'pranzo', categories: ['cibo'] }], [blackWhite], { borgo: true }).get('g1-pranzo').length).toBe(1);
        expect(bucketCandidates([dopocena], [posto('Trattoria', ['italian_restaurant', 'restaurant', 'food'])], { borgo: true }).get('g1-dopocena')).toEqual([]);
    });
});

describe('BORGO-FIX decisione 3 — la natura «da fuori» di notte, la riserva, la nota, la passeggiata', () => {
    it('un monte, una riserva, un sentiero sono «da fuori»; un belvedere o un giardino in paese no; un parco a 3 km dal centro si\'', () => {
        expect(isNaturaDaFuori(posto('Monte Muganà', ['scenic_spot']), troina)).toBe(true);
        expect(isNaturaDaFuori(posto('Riserva Naturale Orientata', ['park']), troina)).toBe(true);
        expect(isNaturaDaFuori(posto('Sentiero dei Nebrodi', ['hiking_area']), troina)).toBe(true);
        expect(isNaturaDaFuori(posto('Belvedere della Piazza Conte Ruggero', ['scenic_spot'], { latitude: troina.latitude, longitude: troina.longitude }), troina)).toBe(false);
        expect(isNaturaDaFuori(posto('Villa Bellini', ['park'], { latitude: troina.latitude, longitude: troina.longitude }), troina)).toBe(false);
        const borgo = { ...troina, isSmallTown: true, radiusKm: 5 };
        expect(isNaturaDaFuori(posto('Parco delle Rimembranze', ['park'], { latitude: troina.latitude + 0.03, longitude: troina.longitude }), borgo)).toBe(true);
        // in una citta' un parco a 3 km dal centro e' ancora in citta' (Villa Floridiana al Vomero); una spiaggia o un lungomare non sono «da fuori»
        const citta = { ...troina, isSmallTown: false, radiusKm: 10 };
        expect(isNaturaDaFuori(posto('Parco delle Rimembranze', ['park'], { latitude: troina.latitude + 0.02, longitude: troina.longitude }), citta)).toBe(false);
        expect(isNaturaDaFuori(posto('Spiaggia di Is Arutas', ['natural_feature'], { latitude: troina.latitude + 0.02, longitude: troina.longitude }), borgo)).toBe(false);
        expect(NATURA_DENTRO_KM).toEqual({ borgo: 1, citta: 3 });
        // un bar non e' natura: mai «da fuori»
        expect(isNaturaDaFuori(posto('Bar Monte', ['bar']), troina)).toBe(false);
    });
    it('la riserva «mai vuoto» tiene le sue categorie (soloCategorie): un dopocena resta bar e vita notturna anche con la natura chiesta', () => {
        const day = { y: 2026, m: 10, d: 15 };
        const w = { date: '2026-10-15', start: romeDate(day, { h: 23, m: 0 }), end: romeDate(day, { h: 24, m: 0 }) };
        const sk = addEveningWalk(buildDaySkeleton({ window: { windows: [w] }, pace: 'attivo', category: 'natura' }));
        const moments = flattenSkeleton(sk);
        const riserva = moments.find(m => m.daRiserva);
        expect(riserva).toBeTruthy();
        expect(riserva.soloCategorie).toBe(true);
        // le categorie della tabella (dopocena: vita notturna), non «natura»; e' un drink con la sua passeggiata in paese
        expect(riserva.categories).toEqual(['vita notturna']);
        expect(riserva.bevuta).toBe(true);
        expect(moments.some(m => m.key === 'passeggiata')).toBe(true);
        // con anyCategory (la natura vale per tutti i momenti) il bucket del momento di riserva resta quello delle sue categorie
        const b = bucketCandidates([riserva], [posto('Monte Muganà', ['scenic_spot']), posto('Bar Sunshine', ['bar'])], { anyCategory: true });
        expect(b.get(riserva.id).map(c => c.name)).toEqual(['Bar Sunshine']);
    });
    it('la nota di Ivano, alla lettera, con e senza il posto del giorno dopo; «giornata» e «domani» nel testo', () => {
        expect(NOTA_NATURA_NOTTE('Monte Muganà')).toBe('La natura di notte non si vede. Stasera ti porto qui; domattina alle 9 si sale a Monte Muganà.');
        expect(NOTA_NATURA_NOTTE()).toBe('La natura di notte non si vede. Stasera ti porto qui.');
        expect(chiedeGiornata('fammi fare domani una giornata tra natura e luoghi storici')).toBe(true);
        expect(chiedeGiornata('Una giornata a Troina')).toBe(true);
        expect(chiedeGiornata('parchi e giardini')).toBe(false);
        expect(WALK_NATURA_BORGO_MINUTES).toBe(30);
        expect(WALK_NATURA_BORGO_MINUTES).toBeGreaterThan(MAX_WALK_MINUTES);
    });
});
