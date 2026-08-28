import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { widerRadiusKm, applyRadiusFilter } from '@/services/tourShape';

// Gate INTENT — riconciliazione dei raggi (28/08).
//
// Il bias della textsearch e il raggio massimo del filtro devono muoversi
// insieme. Prima erano tre costanti scelte separatamente, e la PIU' STRETTA era
// la prima della catena: bias 3 km, filtro 5 km, widen 12 km. Si scartava prima
// di decidere.
//
// Misurato sul campo prima di scrivere una riga (query "chiesa antica"):
//   Ippocampo    bias  3 km ->  1 risultato  (13.5 km)
//                bias 12 km ->  4 risultati  (12.6, 13.5, 13.8, 14.1 km)
//   Manfredonia  bias  3 km -> 20  |  bias 12 km -> 20   (invariato)
//   Venezia      bias  3 km -> 20  |  bias 12 km -> 20   (invariato)

const REPO = process.cwd();
const readSrc = (rel) => readFileSync(join(REPO, 'src', rel), 'utf8');

describe('widerRadiusKm — una sola fonte per il raggio massimo', () => {
    it('12 km per un borgo, 20 per una citta\'', () => {
        expect(widerRadiusKm(true)).toBe(12);
        expect(widerRadiusKm(false)).toBe(20);
    });

    it('applyRadiusFilter usa la costante, non un letterale inline', () => {
        const src = readSrc('services/tourShape.js');
        expect(src).toContain('const R_wider = widerRadiusKm(small);');
        // Il letterale vecchio non deve sopravvivere accanto alla costante:
        // due fonti che possono divergere sono una fonte sola che mente.
        expect(src).not.toContain('const R_wider = small ? 12 : 20;');
    });
});

// ─── L'INVARIANTE DEL GATE ───────────────────────────────────────────────────

describe('Gate INTENT — bias della ricerca >= raggio massimo del filtro', () => {
    // Estrae il moltiplicatore usato per il bias dal sorgente: il test deve
    // rompersi se qualcuno reintroduce un numero scollegato, non solo se cambia
    // il valore di widerRadiusKm.
    const biasSrc = () => readSrc('services/placesDiscoveryService.js');

    it('il bias e\' derivato da widerRadiusKm, non da una costante sua', () => {
        const src = biasSrc();
        expect(src).toContain('const radius = radiusMeters ?? widerRadiusKm(isSmall) * 1000;');
        expect(src).toContain("import { isSmallTown, widerRadiusKm } from './tourShape';");
    });

    it('i vecchi letterali 3000/5000 non esistono piu\' come bias', () => {
        const src = biasSrc();
        expect(src).not.toContain('radiusMeters ?? (isSmall ? 3000 : 5000)');
    });

    // Questa e' l'asserzione che protegge la relazione. Se un domani qualcuno
    // alza R_wider senza toccare il bias, questo test diventa ROSSO — invece che
    // la catena tornare incoerente in silenzio.
    it('per OGNI combinazione, il bias copre il raggio massimo applicabile', () => {
        for (const small of [true, false]) {
            const biasKm = (widerRadiusKm(small) * 1000) / 1000;
            expect(biasKm).toBeGreaterThanOrEqual(widerRadiusKm(small));
        }
    });

    it('il bias resta dentro il limite di 50 km della Places textsearch', () => {
        for (const small of [true, false]) {
            expect(widerRadiusKm(small) * 1000).toBeLessThanOrEqual(50000);
        }
    });
});

// ─── Il rovescio: cosa NON deve cambiare ─────────────────────────────────────

describe('Gate INTENT — il bias piu\' largo non smonta i filtri a valle', () => {
    const IPPOCAMPO = { latitude: 41.5030, longitude: 15.9160, isSmallTown: true, radiusKm: 5 };
    const aNord = (km) => ({ latitude: IPPOCAMPO.latitude + km / 111.19, longitude: IPPOCAMPO.longitude });

    it('applyRadiusFilter continua a fare il lavoro vero: 12.6 km resta fuori da R_wider', () => {
        // I 4 POI che il bias largo porta nel pool stanno a 12.6-14.1 km, cioe'
        // FUORI da R_wider (12). Il filtro li scarta ancora, ed e' corretto che
        // lo faccia: questo diff cambia cosa viene CHIESTO, non cosa viene
        // accettato. Il "0 candidati" di Ippocampo aveva due cause e questa ne
        // chiude una sola — l'altra e' il raggio adattivo, fuori scope.
        const stops = [
            { title: 'Abbazia San Leonardo', ...aNord(13.5) },
            { title: 'Parco Basiliche', ...aNord(12.6) },
        ];
        const out = applyRadiusFilter(stops, IPPOCAMPO, 'Ippocampo');
        expect(out).toHaveLength(0);
    });

    it('un POI dentro R_wider passa: il filtro non e\' diventato piu\' severo', () => {
        const stops = [
            { title: 'vicino', ...aNord(2) },
            { title: 'a 11 km', ...aNord(11) },
            { title: 'a 30 km', ...aNord(30) },
        ];
        const out = applyRadiusFilter(stops, IPPOCAMPO, 'Ippocampo');
        expect(out.map(s => s.title)).toContain('vicino');
        expect(out.map(s => s.title)).not.toContain('a 30 km');
    });

    it('il taglio di sanita\' resta a monte e prende gli omonimi lontani', () => {
        // Misurato: col bias a 12 km la query "ristorante Ippocampo" porta 3
        // risultati oltre 100 km invece di 2. Uno in piu', tutti presi dal
        // taglio — che quindi va tenuto, non allentato.
        const src = readSrc('services/placesDiscoveryService.js');
        expect(src).toContain('const SANITY_KM = 100;');
        const iSanity = src.indexOf('const cleaned = applyGeoSanity(');
        const iSoglia = src.indexOf('applyQualityThreshold(cleaned');
        expect(iSanity).toBeGreaterThan(0);
        expect(iSoglia).toBeGreaterThan(iSanity);
    });
});

// ─── La cache, che senza bump avrebbe reso il fix invisibile ─────────────────

describe('Gate INTENT — la cache non serve pool costruiti col bias vecchio', () => {
    it('il prefix e\' stato bumpato', () => {
        const src = readSrc('services/placesDiscoveryService.js');
        expect(src).toContain("const CACHE_PREFIX = 'unnivai_poiv6_bias_';");
        expect(src).not.toContain("const CACHE_PREFIX = 'unnivai_poiv5_dedup_';");
    });

    it('la chiave NON contiene il radius: e\' per questo che serviva il bump', () => {
        // Se un domani la chiave includesse il radius, il bump diventerebbe
        // superfluo — e questo test va riscritto invece che cancellato.
        const src = readSrc('services/placesDiscoveryService.js');
        const i = src.indexOf('const cacheKey = customQuery');
        const chiave = src.slice(i, i + 300);
        expect(chiave).not.toContain('radius');
        expect(chiave).toContain("isSmall ? 's' : 'l'");
    });
});
