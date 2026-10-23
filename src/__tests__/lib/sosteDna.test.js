// DNA-3b — le soste del DNA negli spazi liberi, e le esclusioni come filtro duro. 0 $: casi sintetici, nessuna rete.
// Regola e corrispondenze: src/lib/sosteDna.js e docs/prove/2026-10-22-dna-3b.md.
import { describe, it, expect } from 'vitest';
import {
    numeroSoste, categorieDelleSoste, motivoNessunaSosta, aggiungiSosteDna, sistemazione, DEVIAZIONE_MAX_KM, CORRISPONDENZE,
} from '@/lib/sosteDna';
import { richiestaEsplicita, filtraEsclusi, notaEsclusioni, categoriaEsclusa, haCategoriePrecise } from '@/lib/richiestaEsplicita';
import { mapCandidateToCoreCategories } from '@/services/candidateScoring';

const ore = (da = '0700', a = '2300') => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
const LAT = 37.5, LNG = 15.08;
// ~1 grado di latitudine = 111 km: spostamenti in metri
const at = (nordM, estM = 0) => ({ latitude: LAT + nordM / 111000, longitude: LNG + estM / 88000 });
const posto = (id, name, types, primary, pos, extra = {}) => ({ place_id: id, name, types, primaryType: primary, ...at(...pos), rating: 4.6, user_ratings_total: 300, opening_hours: ore(), ...extra });

const MUSEO = posto('m1', 'Museo Civico', ['museum'], 'museum', [0, 0]);
const TRATTORIA = posto('t1', 'Trattoria Sorano', ['restaurant', 'food'], 'restaurant', [400, 0]);
const CAFFE = posto('k1', 'Caffè Storico Vittoria', ['cafe', 'food'], 'cafe', [200, 20]);
const PASTICCERIA = posto('k2', 'Pasticceria Savia', ['bakery', 'food'], 'bakery', [220, -30]);
const GELATERIA = posto('k3', 'Gelateria del Corso', ['ice_cream_shop', 'food'], 'ice_cream_shop', [210, 10]);
const GIARDINO = posto('g1', 'Giardino Bellini', ['park'], 'park', [190, 15]);
const BELVEDERE = posto('g2', 'Belvedere di Carminello', ['observation_deck'], 'observation_deck', [230, 0]);
const LIBRERIA = posto('l1', 'Libreria Antica Vittoria', ['book_store', 'store'], 'book_store', [200, -10]);
const CAFFE_LONTANO = posto('k9', 'Caffè Lontano', ['cafe'], 'cafe', [200, 900]);
const CHIESA = posto('c1', 'Chiesa di San Nicolò', ['church', 'place_of_worship'], 'church', [150, 0]);

const mattina = { key: 'mattina', label: 'Mattina', start: new Date('2026-10-14T07:30:00Z'), end: new Date('2026-10-14T10:30:00Z') };
const pomeriggio = { key: 'pomeriggio', label: 'Pomeriggio', start: new Date('2026-10-14T12:30:00Z'), end: new Date('2026-10-14T16:00:00Z') };
const pranzo = { key: 'pranzo', label: 'Pranzo', start: new Date('2026-10-14T10:30:00Z'), end: new Date('2026-10-14T12:30:00Z') };
// un museo (60 min) da 08:00 locale, poi il pranzo alle 12:30 locale: ~90 minuti liberi
const sched = (extra = []) => ({
    days: [[
        { candidate: MUSEO, moment: mattina, start: new Date('2026-10-14T07:30:00Z'), waitMinutesBefore: 0, source: 'modello', trace: {} },
        { candidate: TRATTORIA, moment: pranzo, start: new Date('2026-10-14T10:30:00Z'), waitMinutesBefore: 85, source: 'modello', trace: {} },
        ...extra,
    ]],
    tolte: [],
});
const POOL = [MUSEO, TRATTORIA, CAFFE, PASTICCERIA, GELATERIA, GIARDINO, BELVEDERE, LIBRERIA, CHIESA];
const dna = (pesi, share) => ({ ...pesi, _share: share });
const vuota = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'Una giornata a Catania', pathType: 'custom' });
const run = (o) => aggiungiSosteDna({ sched: sched(), pool: POOL, richiesta: vuota, categorieDi: mapCandidateToCoreCategories, ...o });
const titoli = (s) => s.days[0].map(x => x.candidate.name);

describe('DNA-3b — quante soste e di cosa', () => {
    it('numero secondo la fiducia: 0 → 0, poca (0,15) → 1, media (0,25) → 1, alta (0,45) → 2', () => {
        expect([0, 0.15, 0.25, 0.45].map(numeroSoste)).toEqual([0, 1, 1, 2]);
    });
    it('le categorie sono le 2 piu\' forti che hanno una corrispondenza; sotto 0,20 non contano', () => {
        expect(categorieDelleSoste(dna({ food: 1, natura: 0.5, cultura: 0.4 }, 0.45))).toEqual(['food', 'natura']);
        expect(categorieDelleSoste(dna({ nightlife: 1, food: 0.6, natura: 0.5 }, 0.45))).toEqual(['food']); // nightlife non ha sosta; natura e' terza
        expect(categorieDelleSoste(dna({ food: 0.1 }, 0.45))).toEqual([]);
    });
    it('corrispondenze dichiarate: food, natura, cultura', () => {
        expect(Object.keys(CORRISPONDENZE)).toEqual(['food', 'natura', 'cultura']);
        expect(CORRISPONDENZE.food.ammette(CAFFE, 600)).toBe(true);
        expect(CORRISPONDENZE.food.ammette(PASTICCERIA, 600)).toBe(true);
        expect(CORRISPONDENZE.food.ammette(GELATERIA, 600)).toBe(false); // il gelato solo dalle 14:30
        expect(CORRISPONDENZE.food.ammette(GELATERIA, 15 * 60)).toBe(true);
        expect(CORRISPONDENZE.food.ammette(TRATTORIA, 15 * 60)).toBe(false); // mai un pasto seduto
        expect(CORRISPONDENZE.natura.ammette(GIARDINO)).toBe(true);
        expect(CORRISPONDENZE.natura.ammette(BELVEDERE)).toBe(true);
        expect(CORRISPONDENZE.cultura.ammette(LIBRERIA)).toBe(true);
        expect(CORRISPONDENZE.cultura.ammette(MUSEO)).toBe(false);
    });
});

describe('DNA-3b — le soste negli spazi liberi', () => {
    it('utente nuovo (fiducia 0): nessuna sosta, giro identico', () => {
        const s = sched();
        const r = aggiungiSosteDna({ sched: s, pool: POOL, dnaWeights: dna({ food: 1 }, 0), richiesta: vuota });
        expect(r.sched).toBe(s);
        expect(r.report.aggiunte).toEqual([]);
        expect(r.report.motivo).toBe('fiducia del DNA 0');
    });

    it('food alta: una sosta di cibo fra il museo e il pranzo (caffè o pasticceria, mai il gelato di mattina), 15–30 min, deviazione ≤ 300 m', () => {
        const r = run({ dnaWeights: dna({ food: 1 }, 0.45) });
        expect(r.report.aggiunte.length).toBeGreaterThanOrEqual(1);
        const x = r.report.aggiunte[0];
        expect(['Caffè Storico Vittoria', 'Pasticceria Savia']).toContain(x.nome);
        expect(x.minuti).toBeGreaterThanOrEqual(15);
        expect(x.minuti).toBeLessThanOrEqual(30);
        expect(x.deviazioneM).toBeLessThanOrEqual(DEVIAZIONE_MAX_KM * 1000);
        expect(titoli(r.sched).indexOf(x.nome)).toBe(1); // dopo il museo, prima del pranzo
    });

    it('la tappa dopo non slitta: stesso orario, attesa ridotta della sosta e del cammino', () => {
        const r = run({ dnaWeights: dna({ food: 1 }, 0.45) });
        const pranzoDopo = r.sched.days[0].find(x => x.candidate.name === 'Trattoria Sorano');
        expect(pranzoDopo.start.toISOString()).toBe('2026-10-14T10:30:00.000Z');
        expect(pranzoDopo.waitMinutesBefore).toBeLessThan(85);
    });

    it('fiducia alta (2 soste) con DNA food + natura: una per categoria, due posti diversi', () => {
        const r = run({ dnaWeights: dna({ food: 1, natura: 0.8 }, 0.45), alBuio: () => false });
        const cats = r.report.aggiunte.map(x => x.categoria).sort();
        expect(r.report.aggiunte.length).toBe(2);
        expect(cats).toEqual(['food', 'natura']);
    });

    it('fiducia poca o media: al massimo 1 sosta', () => {
        expect(run({ dnaWeights: dna({ food: 1, natura: 0.8 }, 0.15) }).report.aggiunte.length).toBe(1);
        expect(run({ dnaWeights: dna({ food: 1, natura: 0.8 }, 0.25) }).report.aggiunte.length).toBe(1);
    });

    it('natura alta: un giardino o un belvedere di giorno; al buio nessuno; «da fuori» nessuno', () => {
        const w = dna({ natura: 1 }, 0.25);
        const giorno = run({ dnaWeights: w, alBuio: () => false });
        expect(giorno.report.aggiunte.length).toBe(1);
        expect(['Giardino Bellini', 'Belvedere di Carminello']).toContain(giorno.report.aggiunte[0].nome);
        expect(run({ dnaWeights: w, alBuio: () => true }).report.aggiunte).toEqual([]);
        expect(run({ dnaWeights: w, alBuio: () => false, daFuori: () => true }).report.aggiunte).toEqual([]);
    });

    it('cultura alta: una libreria o una bottega storica', () => {
        const r = run({ dnaWeights: dna({ cultura: 1 }, 0.25) });
        expect(r.report.aggiunte.map(x => x.nome)).toEqual(['Libreria Antica Vittoria']);
    });

    it('un posto fuori strada (deviazione > 300 m) non entra; un posto chiuso non entra; senza orario il cibo non entra', () => {
        const solo = (c) => aggiungiSosteDna({ sched: sched(), pool: [MUSEO, TRATTORIA, c], dnaWeights: dna({ food: 1 }, 0.45), richiesta: vuota, categorieDi: mapCandidateToCoreCategories });
        expect(solo(CAFFE_LONTANO).report.aggiunte).toEqual([]);
        expect(solo({ ...CAFFE, opening_hours: ore('1500', '2300') }).report.aggiunte).toEqual([]);
        expect(solo({ ...CAFFE, opening_hours: undefined }).report.aggiunte).toEqual([]);
        expect(solo(CAFFE).report.aggiunte.length).toBe(1);
    });

    it('se l\'attesa non basta (la sosta + il cammino non ci stanno) nessuna sosta', () => {
        const stretto = sched();
        stretto.days[0][1] = { ...stretto.days[0][1], start: new Date('2026-10-14T08:45:00Z'), waitMinutesBefore: 5 }; // il museo finisce alle 09:30 locale (07:30Z + 60)... il pranzo e' subito dopo
        expect(aggiungiSosteDna({ sched: stretto, pool: POOL, dnaWeights: dna({ food: 1 }, 0.45), richiesta: vuota, categorieDi: mapCandidateToCoreCategories }).report.aggiunte).toEqual([]);
    });

    it('mai due volte lo stesso posto e mai un posto gia\' nel giro', () => {
        const r = run({ dnaWeights: dna({ food: 1 }, 0.45) });
        const nomi = titoli(r.sched);
        expect(new Set(nomi).size).toBe(nomi.length);
    });

    it('lo schedule di partenza non cambia (si restituisce una copia)', () => {
        const s = sched();
        const prima = JSON.stringify(s.days[0].map(x => [x.candidate.name, x.waitMinutesBefore]));
        run({ sched: s, dnaWeights: dna({ food: 1 }, 0.45) });
        expect(JSON.stringify(s.days[0].map(x => [x.candidate.name, x.waitMinutesBefore]))).toBe(prima);
    });

    it('sistemazione: calcolo diretto (orario d\'inizio dopo il museo + cammino)', () => {
        const [a, b] = sched().days[0];
        const sis = sistemazione(a, CAFFE, b);
        expect(sis).not.toBeNull();
        expect(sis.stay).toBe(20);
        expect(new Date(sis.start).toISOString().slice(11, 16)).toBe('08:33'); // 07:30Z + 60 min di museo + 3 min di cammino
    });
});

describe('DNA-3b — la richiesta vince', () => {
    it('food alta + «solo musei»: nessuna sosta', () => {
        const r = richiestaEsplicita({ intent: { categoria: 'cultura', vincoli: { escludi: [] } }, testo: 'solo musei', pathType: 'custom' });
        expect(haCategoriePrecise(r)).toBe(true);
        const out = aggiungiSosteDna({ sched: sched(), pool: POOL, dnaWeights: dna({ food: 1 }, 0.45), richiesta: r });
        expect(out.report.aggiunte).toEqual([]);
        expect(out.report.motivo).toBe('la richiesta ha categorie precise');
    });
    it('il giro e\' di una sola categoria chiesta (Gate RAGGIO-CATEGORIA): nessuna sosta', () => {
        expect(motivoNessunaSosta({ dnaWeights: dna({ food: 1 }, 0.45), richiesta: vuota, categoriaTarget: 'natura' })).toBe('il giro e\' di una sola categoria chiesta');
    });
    it('la richiesta nomina un posto: nessuna sosta', () => {
        const porta = posto('p1', 'Porta Uzeda', ['tourist_attraction'], 'tourist_attraction', [300, 0]);
        const r = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'voglio vedere Porta Uzeda', pathType: 'custom' });
        expect(motivoNessunaSosta({ dnaWeights: dna({ food: 1 }, 0.45), richiesta: r, pool: [...POOL, porta] })).toBe('la richiesta nomina un posto');
    });
    it('«niente ristoranti»/«niente cibo»: nessuna sosta di cibo; «niente chiese»: la libreria resta', () => {
        const noCibo = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'giro in centro, senza ristoranti', pathType: 'custom' });
        expect(categoriaEsclusa(noCibo, 'food')).toBe(true);
        expect(aggiungiSosteDna({ sched: sched(), pool: POOL, dnaWeights: dna({ food: 1 }, 0.45), richiesta: noCibo }).report.aggiunte).toEqual([]);
        const noChiese = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'giro in centro, niente chiese', pathType: 'custom' });
        expect(categoriaEsclusa(noChiese, 'cultura')).toBe(false);
        expect(aggiungiSosteDna({ sched: sched(), pool: POOL, dnaWeights: dna({ cultura: 1 }, 0.25), richiesta: noChiese, categorieDi: mapCandidateToCoreCategories }).report.aggiunte.map(x => x.nome)).toEqual(['Libreria Antica Vittoria']);
    });
    it('un tipo escluso non diventa mai una sosta (niente bar → niente caffè-bar)', () => {
        const r = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: ['bar'] } }, testo: 'giro in centro', pathType: 'custom' });
        const bar = posto('b9', 'Bar Roma', ['bar', 'cafe'], 'cafe', [200, 0]);
        const out = aggiungiSosteDna({ sched: sched(), pool: [MUSEO, TRATTORIA, bar], dnaWeights: dna({ food: 1 }, 0.45), richiesta: r, categorieDi: mapCandidateToCoreCategories });
        expect(out.report.aggiunte).toEqual([]);
    });
});

describe('DNA-3b — le esclusioni sono un filtro duro', () => {
    const noChiese = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: ['chiese'] } }, testo: 'giro in centro', pathType: 'custom' });
    const poolChiese = Array.from({ length: 8 }, (_, i) => posto(`ch${i}`, `Chiesa di San ${i}`, ['church', 'place_of_worship'], 'church', [100 * i, 0]));

    it('«niente chiese» (traduttore o testo): 0 chiese fra i candidati, il resto resta', () => {
        const f = filtraEsclusi([...poolChiese, MUSEO, TRATTORIA], noChiese);
        expect(f.tolti.length).toBe(8);
        expect(f.tenuti.map(c => c.name)).toEqual(['Museo Civico', 'Trattoria Sorano']);
        const dalTesto = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'giro in centro, niente chiese', pathType: 'custom' });
        expect(filtraEsclusi(poolChiese, dalTesto).tenuti).toEqual([]);
    });
    it('«niente chiese» non toglie i musei', () => {
        expect(filtraEsclusi([MUSEO], noChiese).tenuti).toEqual([MUSEO]);
    });
    it('senza esclusioni la lista e\' la stessa di prima (stesso array)', () => {
        const l = [MUSEO, TRATTORIA];
        expect(filtraEsclusi(l, vuota).tenuti).toBe(l);
        expect(filtraEsclusi(l, null).tenuti).toBe(l);
    });
    it('il Quiz scrive da solo le sue esclusioni («non aggiungere ristoranti», «Escludi: chiese, musei»): restano prompt e affinita\' 0, non un filtro', () => {
        const storia = richiestaEsplicita({ intent: { categoria: 'storia', vincoli: { escludi: ['ristoranti', 'bar', 'caffè'] } }, testo: '', pathType: 'quick' });
        expect(storia.vociEscluse).toEqual(expect.arrayContaining(['cibo', 'bar'])); // per il DNA: affinita' 0 e nessuna sosta di cibo
        const natura = richiestaEsplicita({ intent: { categoria: 'natura', vincoli: { escludi: ['chiese', 'musei', 'monumenti storici'] } }, testo: '', pathType: 'quick' });
        const l = [MUSEO, CHIESA, TRATTORIA, CAFFE];
        expect(filtraEsclusi(l, storia).tenuti).toBe(l);
        expect(filtraEsclusi(l, natura).tenuti).toBe(l);
        expect(notaEsclusioni(storia)).toBeNull();
        const sorprendimi = richiestaEsplicita({ intent: { categoria: 'arte', vincoli: { escludi: ['chiese'] } }, testo: '', pathType: undefined });
        expect(filtraEsclusi(l, sorprendimi).tenuti).toBe(l);
    });
    it('in Crea «senza ristoranti» e\' una richiesta dell\'utente: si applica', () => {
        const crea = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'giro in centro, senza ristoranti', pathType: 'custom' });
        expect(filtraEsclusi([MUSEO, TRATTORIA], crea).tenuti.map(c => c.name)).toEqual(['Museo Civico']);
        expect(notaEsclusioni(crea)).toBe('Ho tolto i ristoranti come chiesto: il giro è più corto.');
    });
    it('la riga a schermo, nello stile dell\'app', () => {
        expect(notaEsclusioni(noChiese)).toBe('Ho tolto le chiese come chiesto: il giro è più corto.');
        const due = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: ['chiese', 'musei'] } }, testo: '', pathType: 'custom' });
        expect(notaEsclusioni(due)).toBe('Ho tolto le chiese e i musei come chiesto: il giro è più corto.');
        expect(notaEsclusioni(vuota)).toBeNull();
    });
});

// ─── DNA-3c — la ricerca mirata della sosta: solo nelle condizioni dette ─────────────────────────────────────────────────────────
import { ricercheDellaSosta, spaziLiberi, RAGGIO_RICERCA_M, LIBERO_MIN_RICERCA_MINUTI } from '@/lib/sosteDna';

describe('DNA-3c — quando si cerca (e quando no)', () => {
    const POOL_SENZA = [MUSEO, TRATTORIA, CHIESA]; // niente caffè, giardini o librerie
    const piano = (share, pesi = { food: 1 }, o = {}) => {
        const s = o.sched || sched();
        const primo = aggiungiSosteDna({ sched: s, pool: o.pool || POOL_SENZA, dnaWeights: dna(pesi, share), richiesta: o.richiesta || vuota, categoriaTarget: o.categoriaTarget || null, categorieDi: mapCandidateToCoreCategories });
        return ricercheDellaSosta({ sched: primo.sched, dnaWeights: dna(pesi, share), richiesta: o.richiesta || vuota, categoriaTarget: o.categoriaTarget || null, primo: primo.report, pool: o.pool || POOL_SENZA });
    };

    it('fiducia media, uno spazio di 85 minuti e niente nel pool: UNA ricerca, centrata fra le due tappe, raggio 300 m', () => {
        const p = piano(0.25);
        expect(p.ricerche).toHaveLength(1);
        const r = p.ricerche[0];
        expect(r.categoria).toBe('food');
        expect(r.raggioM).toBe(300);
        expect(RAGGIO_RICERCA_M).toBe(300);
        expect(r.libero).toBe(85);
        // il punto e' a meta' strada fra il museo (0 m) e la trattoria (400 m a nord)
        expect(Math.round((r.punto.latitude - LAT) * 111000)).toBe(200);
    });
    it('fiducia alta con una sola categoria e un solo spazio: ancora UNA ricerca (la stessa non si fa due volte)', () => {
        expect(piano(0.45).ricerche).toHaveLength(1);
    });
    it('fiducia alta con due categorie: due ricerche, una per categoria', () => {
        const p = piano(0.45, { food: 1, natura: 0.8 });
        expect(p.ricerche.map(r => r.categoria).sort()).toEqual(['food', 'natura']);
    });
    it('fiducia poca o zero: nessuna ricerca', () => {
        expect(piano(0.15).ricerche).toEqual([]);
        expect(piano(0.15).motivo).toMatch(/poca/);
        expect(piano(0).ricerche).toEqual([]);
    });
    it('uno spazio libero sotto i 20 minuti: nessuna ricerca', () => {
        const stretto = sched();
        stretto.days[0][1] = { ...stretto.days[0][1], waitMinutesBefore: 15 };
        expect(LIBERO_MIN_RICERCA_MINUTI).toBe(20);
        expect(spaziLiberi(stretto)).toEqual([]);
        expect(piano(0.45, { food: 1 }, { sched: stretto }).ricerche).toEqual([]);
    });
    it('se nel pool c\'e\' un candidato adatto entro 300 m: nessuna ricerca (la sosta c\'e\' gia\')', () => {
        const p = piano(0.25, { food: 1 }, { pool: [...POOL_SENZA, CAFFE] });
        expect(p.ricerche).toEqual([]);
        expect(p.motivo).toMatch(/gia'/);
    });
    it('la richiesta vince: «solo musei», un posto per nome, una categoria sola, un tipo escluso: nessuna ricerca', () => {
        const musei = richiestaEsplicita({ intent: { categoria: 'cultura', vincoli: { escludi: [] } }, testo: 'solo musei', pathType: 'custom' });
        expect(piano(0.45, { food: 1 }, { richiesta: musei }).ricerche).toEqual([]);
        expect(piano(0.45, { food: 1 }, { categoriaTarget: 'natura' }).ricerche).toEqual([]);
        const noCibo = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'giro in centro, senza ristoranti', pathType: 'custom' });
        expect(piano(0.45, { food: 1 }, { richiesta: noCibo }).ricerche).toEqual([]);
    });
    it('utente nuovo (nessun DNA): nessuna ricerca', () => {
        expect(piano(0, {}).ricerche).toEqual([]);
    });
});
