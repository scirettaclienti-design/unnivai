import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { applyGeoSanity, QUALITY_THRESHOLDS } from '@/services/placesDiscoveryService';

// Gate INTENT — taglio di sanita' geografica (28/08).
// Places textsearch usa location+radius come BIAS, non come vincolo: con il nome
// della localita' dentro la query testuale, per un borgo con nome commerciale
// comune tornano omonimi da tutta Italia. Device Ippocampo: 185, 279, 513, 532 km.

const REPO = process.cwd();
const readSrc = (rel) => readFileSync(join(REPO, 'src', rel), 'utf8');

// Centro di riferimento: Ippocampo (Manfredonia, FG).
const CENTRO = { lat: 41.5900, lng: 15.8800 };

// Costruisce un candidato nella forma GREZZA di Places textsearch.
const poi = (name, lat, lng, extra = {}) => ({
    name,
    geometry: { location: { lat, lng } },
    rating: 4.5,
    user_ratings_total: 2000,
    business_status: 'OPERATIONAL',
    types: ['restaurant'],
    ...extra,
});

// Sposta di N km verso nord (1 grado lat = 111.19 km).
const aNordDi = (km) => CENTRO.lat + km / 111.19;

describe('applyGeoSanity — il taglio', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it('un omonimo a 513 km viene tagliato', () => {
        const pool = [
            poi('Abbazia San Leonardo', aNordDi(13.5), CENTRO.lng),
            poi("L'Ippocampo", aNordDi(513), CENTRO.lng),
        ];
        const out = applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(out).toHaveLength(1);
        expect(out[0].name).toBe('Abbazia San Leonardo');
    });

    // L'asserzione che protegge il confine fra "rumore" e "decisione di prodotto".
    it('un POI a 21 km NON viene tagliato: sopra il raggio massimo, sotto la sanita\'', () => {
        // Museo Archeologico Ipogei era a 21.9 km. Sta sopra R_wider (12 km borgo,
        // 20 km citta') ma DEVE arrivare ad applyRadiusFilter, che e' chi decide.
        const pool = [poi('Museo Archeologico Ipogei', aNordDi(21.9), CENTRO.lng)];
        const out = applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(out).toHaveLength(1);
    });

    it('il confine si comporta come dichiarato: 99 passa, 101 no', () => {
        const pool = [poi('a 99 km', aNordDi(99), CENTRO.lng), poi('a 101 km', aNordDi(101), CENTRO.lng)];
        const out = applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(out.map(p => p.name)).toEqual(['a 99 km']);
    });

    it('i quattro omonimi del giro device spariscono, i tre POI veri restano', () => {
        const pool = [
            poi('Abbazia San Leonardo', aNordDi(13.5), CENTRO.lng),
            poi('Parco Basiliche di Siponto', aNordDi(12.0), CENTRO.lng),
            poi('Museo Archeologico Ipogei', aNordDi(21.9), CENTRO.lng),
            poi("L'Ippocampo", aNordDi(185), CENTRO.lng),
            poi('Ristorante Pizzeria Ippocampo', aNordDi(279), CENTRO.lng),
            poi("L'Ippocampo 2", aNordDi(513), CENTRO.lng),
            poi("L'Ippocampo 3", aNordDi(532), CENTRO.lng),
        ];
        const out = applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(out).toHaveLength(3);
        expect(out.every(p => !p.name.toLowerCase().includes('ippocampo'))).toBe(true);
    });
});

describe('applyGeoSanity — un predicato che non puo\' decidere non decide', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it('cityCenter assente → ZERO scarti, nessun crash', () => {
        const pool = [poi('a 513 km', aNordDi(513), CENTRO.lng)];
        expect(applyGeoSanity(pool, null, null, 'X')).toHaveLength(1);
        expect(applyGeoSanity(pool, undefined, undefined, 'X')).toHaveLength(1);
        expect(applyGeoSanity(pool, NaN, CENTRO.lng, 'X')).toHaveLength(1);
        expect(applyGeoSanity(pool, CENTRO.lat, NaN, 'X')).toHaveLength(1);
    });

    it('senza centro non logga: non c\'e\' niente da dichiarare', () => {
        applyGeoSanity([poi('a 513 km', aNordDi(513), CENTRO.lng)], null, null, 'X');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('candidato senza coordinate → passa, non si giudica', () => {
        const senzaCoord = { name: 'senza geometry', rating: 4.5, user_ratings_total: 10 };
        const out = applyGeoSanity([senzaCoord], CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(out).toHaveLength(1);
    });

    it('pool vuoto o non-array → ritorna l\'ingresso, senza lanciare', () => {
        expect(applyGeoSanity([], CENTRO.lat, CENTRO.lng, 'X')).toEqual([]);
        expect(applyGeoSanity(null, CENTRO.lat, CENTRO.lng, 'X')).toBeNull();
        expect(applyGeoSanity(undefined, CENTRO.lat, CENTRO.lng, 'X')).toBeUndefined();
    });

    it('non muta il pool in ingresso', () => {
        const pool = [poi('vicino', aNordDi(1), CENTRO.lng), poi('lontano', aNordDi(513), CENTRO.lng)];
        applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(pool).toHaveLength(2);
    });
});

describe('applyGeoSanity — il log e\' una categoria a se\'', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it('logga conteggio e il piu\' lontano, e non usa il marker [Qualita]', () => {
        applyGeoSanity([
            poi('vicino', aNordDi(2), CENTRO.lng),
            poi("L'Ippocampo", aNordDi(185), CENTRO.lng),
            poi('Pizzeria Ippocampo', aNordDi(532), CENTRO.lng),
        ], CENTRO.lat, CENTRO.lng, 'Ippocampo');

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const msg = warnSpy.mock.calls[0][0];
        expect(msg).toContain('[Places] rumore geografico');
        expect(msg).toContain('2 oltre 100 km');
        expect(msg).toContain('Pizzeria Ippocampo');   // il piu' lontano, non il primo
        // Mai fuso col conteggio della soglia: sarebbe un numero che nasconde.
        expect(msg).not.toContain('[Qualita]');
    });

    it('pool pulito → nessun log', () => {
        applyGeoSanity([poi('vicino', aNordDi(2), CENTRO.lng)], CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

// ─── L'effetto sul denominatore, che e' lo scopo del diff ────────────────────

describe('Gate INTENT — il rumore non entra piu\' nel conteggio della soglia', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it('il pool che arriva alla soglia cala esattamente del numero di omonimi', () => {
        const veri = [
            poi('Abbazia San Leonardo', aNordDi(13.5), CENTRO.lng, { rating: 4.6, user_ratings_total: 400 }),
            poi('Parco Basiliche', aNordDi(12.0), CENTRO.lng, { rating: 4.3, user_ratings_total: 250 }),
        ];
        const omonimi = [
            poi("L'Ippocampo", aNordDi(185), CENTRO.lng),
            poi('Pizzeria Ippocampo', aNordDi(279), CENTRO.lng),
            poi("L'Ippocampo 2", aNordDi(513), CENTRO.lng),
            poi("L'Ippocampo 3", aNordDi(532), CENTRO.lng),
        ];
        const pool = [...veri, ...omonimi];
        const out = applyGeoSanity(pool, CENTRO.lat, CENTRO.lng, 'Ippocampo');
        expect(pool.length - out.length).toBe(omonimi.length);
        expect(out).toHaveLength(veri.length);
    });

    it('gli omonimi rubavano anche gli SLOT: sopra soglia FOOD e con qualityScore alto', () => {
        // Il motivo per cui il taglio va PRIMA della soglia e non dopo: questi
        // candidati non solo passavano il filtro qualita', lo passavano MEGLIO
        // dei POI locali, e salivano in cima al ranking.
        const omonimo = poi("L'Ippocampo", aNordDi(513), CENTRO.lng, { rating: 4.6, user_ratings_total: 2000 });
        const t = QUALITY_THRESHOLDS.FOOD.large;
        expect(omonimo.rating).toBeGreaterThanOrEqual(t.minRating);
        expect(omonimo.user_ratings_total).toBeGreaterThanOrEqual(t.minTotal);
        const qs = (c) => c.rating * Math.log(1 + c.user_ratings_total);
        const locale = poi('Abbazia San Leonardo', aNordDi(13.5), CENTRO.lng, { rating: 4.6, user_ratings_total: 400 });
        expect(qs(omonimo)).toBeGreaterThan(qs(locale));
    });
});

// ─── Posizione nella catena e margine dichiarato ─────────────────────────────

describe('Gate INTENT — il taglio sta al posto giusto', () => {
    const src = () => readSrc('services/placesDiscoveryService.js');

    it('gira DOPO le esclusioni hard e PRIMA della soglia qualita\'', () => {
        const s = src();
        const iSanity = s.indexOf('const cleaned = applyGeoSanity(');
        const iSoglia = s.indexOf('const { pois: qualified, scaleLevel } = applyQualityThreshold(cleaned');
        expect(iSanity).toBeGreaterThan(0);
        expect(iSoglia).toBeGreaterThan(iSanity);
        // e riceve l'output dei due filtri hard, non i results grezzi
        const chiamata = s.slice(iSanity, iSoglia);
        expect(chiamata).toContain('.filter(passesHardExclusions)');
        expect(chiamata).toContain('.filter(c => !isCityItself(c, cityName))');
    });

    it('il margine e\' reale: la sanita\' e\' molto sopra il raggio massimo applicabile', () => {
        const s = src();
        expect(s).toContain('const SANITY_KM = 100;');
        // R_wider in applyRadiusFilter: 12 km borgo / 20 km citta'.
        const shape = readSrc('services/tourShape.js');
        expect(shape).toContain('const R_wider = small ? 12 : 20;');
        // Fattore 5 fra il massimo applicabile e la soglia di sanita'.
        expect(100 / 20).toBeGreaterThanOrEqual(5);
    });

    it('il marker del log esiste nel sorgente', () => {
        // grep a stringa fissa: le quadre in regex sarebbero una classe di caratteri.
        expect(src()).toContain('[Places] rumore geografico');
    });
});

// ─── L'interazione col filtro raggio, documentata invece che implicita ───────

describe('Gate INTENT — chi scarta cosa: sanita\' e raggio non si sovrappongono', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    // Questo diff ha cambiato CHI scarta un candidato lontanissimo, non SE viene
    // scartato. Capodimonte (158 km da Ippocampo) era la fixture storica del
    // Gate NOTIFICHE-DISTANZA per provare `applyRadiusFilter`: da oggi non arriva
    // piu' fin li', perche' lo prende prima la sanita' geografica.
    // Le due fixture di quel test sono state spostate a 50 km — dove a decidere
    // e' ancora il raggio — e l'interazione e' asserita qui, esplicitamente,
    // invece di restare una sorpresa per chi leggera' i log.
    const IPPOCAMPO = { lat: 41.6489, lng: 15.9012 };
    const CAPODIMONTE = poi('Museo e Real Bosco di Capodimonte', 40.8672, 14.2503, { rating: 4.6, user_ratings_total: 30000 });

    it('oltre 100 km: decide la SANITA\', il raggio non lo vede mai', () => {
        const out = applyGeoSanity([CAPODIMONTE], IPPOCAMPO.lat, IPPOCAMPO.lng, 'Ippocampo');
        expect(out).toHaveLength(0);
        expect(warnSpy.mock.calls[0][0]).toContain('[Places] rumore geografico');
    });

    it('fra il raggio e i 100 km: la sanita\' NON tocca, decide il raggio', () => {
        const a50 = poi('Santuario lontano', IPPOCAMPO.lat + 50 / 111.19, IPPOCAMPO.lng);
        const out = applyGeoSanity([a50], IPPOCAMPO.lat, IPPOCAMPO.lng, 'Ippocampo');
        expect(out).toHaveLength(1);       // passa: la decisione resta a valle
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
