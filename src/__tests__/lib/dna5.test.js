// DNA-5 — il DNA impara il ritmo (soste e km dai giri veri), la compagnia (testo, Gruppo, Profilo, scelte) e ordina Per Te; il
// riquadro dice un fatto vero dell'utente. 0 $: dati finti (scripts/prova-dna5/utenti.js), nessuna rete.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { UTENTI, preferenzeDi, giroFinto } from '../../../scripts/prova-dna5/utenti.js';
import {
    valoreTappaRaggiunta, leggiValoreTappa, giriDalRegistro, ritmoAppreso, ritmoDelGiro, FATTORE_RITMO, TAPPE_PER_TE,
} from '@/lib/dnaRitmo';
import { compagniaDalTesto, compagniaDelGiro, bonusCompagnia, fuoriPerTe, REGOLE_COMPAGNIA } from '@/lib/compagniaDna';
import { giroDnaPerMotore, dnaGiroDaApprendimento, tracciatoGiroDna } from '@/lib/giroDna';
import { ordinaPerTe, punteggioPerTe } from '@/lib/perTeDna';
import { righeDnaDelGiro, rigaRitmo, rigaCompagnia } from '@/lib/dnaDelGiro';
import { stayInMoment, computeStopTimings } from '@/lib/tourTiming';
import { buildDaySkeleton } from '@/lib/daySkeleton';
import { aggiungiSosteDna } from '@/lib/sosteDna';
import { placeKind } from '@/lib/placeKind';
import { richiestaEsplicita } from '@/lib/richiestaEsplicita';
import { mapCandidateToCoreCategories } from '@/services/candidateScoring';
import { prepareHomePools } from '@/services/aiRecommendationService';
import { buildSeed, parseSeed, seedFoodPrefs } from '@/lib/foodPrefs';

const MUSEO = { title: 'Museo Civico', types: ['museum'], primaryType: 'museum', latitude: 41.9, longitude: 12.48 };
const PARCO = { title: 'Villa Borghese', types: ['park'], primaryType: 'park', latitude: 41.91, longitude: 12.49 };
const TRATTORIA = { title: 'Trattoria', types: ['restaurant', 'food'], primaryType: 'restaurant', latitude: 41.9, longitude: 12.47 };
const BAR = { title: 'Cocktail bar', types: ['bar'], primaryType: 'cocktail_bar', latitude: 41.9, longitude: 12.47 };
const ZOO = { title: 'Bioparco', types: ['zoo'], primaryType: 'zoo', latitude: 41.92, longitude: 12.48 };
const CHIESA = { title: 'San Luigi', types: ['church', 'place_of_worship'], primaryType: 'church', latitude: 41.9, longitude: 12.475 };
const dnaGiroDi = (u) => dnaGiroDaApprendimento({ righeRegistro: u.registro, onboardingPrefs: u.onboardingPrefs, ...preferenzeDi(u) });

describe('DNA-5 parte 1 — il ritmo dai giri veri', () => {
    it('la riga della tappa raggiunta porta km, sosta prevista e tipo (al massimo 80 caratteri); le righe vecchie non danno numeri', () => {
        const v = valoreTappaRaggiunta({ km: 0.4234, sosta: 60, tipo: 'museo' });
        expect(v).toBe('km=0.42;sosta=60;tipo=museo');
        expect(v.length).toBeLessThanOrEqual(80);
        expect(leggiValoreTappa(v)).toEqual({ km: 0.42, sosta: 60, tipo: 'museo' });
        expect(leggiValoreTappa(null)).toEqual({ km: null, sosta: null, tipo: null });
        expect(leggiValoreTappa('3/5')).toEqual({ km: null, sosta: null, tipo: null });
        expect(valoreTappaRaggiunta({})).toBeNull();
    });
    it('la sosta vera = arrivo dopo − arrivo − cammino (km / 4,5 km/h)', () => {
        const righe = giroFinto('t', '2026-10-01T09:00:00Z', [
            { cat: 'cultura', tipo: 'museo', prevista: 60, vera: 75, km: 0 },
            { cat: 'cultura', tipo: 'chiesa', prevista: 20, vera: 30, km: 0.9 },
        ]);
        const [g] = giriDalRegistro(righe);
        expect(g.tappe.map(t => t.sostaMisurata)).toEqual([75, null]); // l'ultima tappa non ha un arrivo dopo
        expect(g.km).toBe(0.9);
    });
    it('A lento (soste +30%, 0,8 km, 3 tappe) · B veloce (soste −30%, 4,8 km, 6 tappe) · C medio', () => {
        const a = ritmoAppreso(UTENTI.A.registro);
        expect([a.ritmo, a.fattoreSosta, a.kmMedi, a.tappeMedie, a.giri]).toEqual(['lento', 1.3, 0.8, 3, 4]);
        const b = ritmoAppreso(UTENTI.B.registro);
        expect([b.ritmo, b.fattoreSosta, b.kmMedi, b.tappeMedie]).toEqual(['veloce', 0.7, 4.8, 6]);
        expect(ritmoAppreso(UTENTI.C.registro).ritmo).toBe('medio'); // un segnale lento (soste), due medi (km e tappe)
    });
    it('con un giro solo, o con righe senza value, il ritmo non si dice', () => {
        expect(ritmoAppreso(UTENTI.A.registro.filter(r => r.tour_id === 'a1')).ritmo).toBeNull();
        const vecchie = UTENTI.A.registro.map(r => ({ ...r, value: r.kind === 'stop_reached' ? null : r.value }));
        const v = ritmoAppreso(vecchie);
        expect(v.fattoreSosta).toBeNull();
        expect(v.kmMedi).toBeNull();
        expect(v.soste).toBe(0);
        expect(v.ritmo).toBe('lento'); // resta il segnale delle tappe per giro (3)
    });
    it('chi vince: la richiesta → il Profilo → i giri → le scelte passate', () => {
        const appreso = ritmoAppreso(UTENTI.A.registro);
        expect(ritmoDelGiro({ scelto: 'Intenso', profilo: 'lento', appreso, scelte: 'medio' })).toMatchObject({ valore: 'veloce', fonte: 'richiesta', fattoreSosta: 1, passo: null });
        expect(ritmoDelGiro({ profilo: 'veloce', appreso })).toMatchObject({ valore: 'veloce', fonte: 'profilo', fattoreSosta: FATTORE_RITMO.veloce, tappePerTe: TAPPE_PER_TE.veloce });
        expect(ritmoDelGiro({ appreso, scelte: 'veloce' })).toMatchObject({ valore: 'lento', fonte: 'giri', fattoreSosta: 1.3, passo: 'rilassato' });
        expect(ritmoDelGiro({ scelte: { suggerito: 'veloce', conteggi: { veloce: 3, lento: 1 }, totale: 4 } })).toMatchObject({ fonte: 'scelte', quante: { k: 3, tot: 4 } });
        expect(ritmoDelGiro({})).toBeNull();
    });
    it('le soste: il fattore allunga le visite (museo 60 → 80 con 1,3), mai i locali; il pasto segue la compagnia', () => {
        expect(stayInMoment(MUSEO, { fattoreSosta: 1.3 })).toBe(80);
        expect(stayInMoment(MUSEO, { fattoreSosta: 0.7 })).toBe(40);
        expect(stayInMoment(TRATTORIA, { fattoreSosta: 1.3 })).toBe(75);
        expect(stayInMoment(TRATTORIA, { sostaPasto: 90 })).toBe(90);
        expect(stayInMoment(MUSEO, null)).toBe(60); // senza DNA: la tabella di sempre
        const t = computeStopTimings([{ ...MUSEO, fattoreSosta: 1.3 }, { ...TRATTORIA, sostaPasto: 60 }]).stops;
        expect(t.map(s => s.stayMinutes)).toEqual([80, 60]);
    });
    it('lo scheletro: il ritmo del DNA conta le tappe per momento (lento 1, veloce 2), il fattore viaggia coi momenti', () => {
        const window = { windows: [{ date: '2026-11-05', start: new Date('2026-11-05T08:30:00Z'), end: new Date('2026-11-05T21:00:00Z') }] };
        const conta = (o) => buildDaySkeleton({ window, pace: '', ...o }).days[0].moments.filter(m => ['mattina', 'pomeriggio'].includes(m.key)).map(m => m.stops);
        expect(conta({ ritmoDna: 'rilassato' })).toEqual([1, 1]);
        expect(conta({ ritmoDna: 'intenso' })).toEqual([2, 2]);
        const m = buildDaySkeleton({ window, pace: '', fattoreSosta: 1.3, sostaPasto: { pranzo: 60, cena: 90 } }).days[0].moments;
        expect(m.find(x => x.key === 'mattina').fattoreSosta).toBe(1.3);
        expect(m.find(x => x.key === 'pranzo').sostaPasto).toBe(60);
        expect(m.find(x => x.key === 'cena').sostaPasto).toBe(90);
    });
    it('il tetto di 1,2 km fra due tappe resta per ogni ritmo del DNA: il DNA non scrive mai il ritmo della richiesta', () => {
        const g = giroDnaPerMotore(dnaGiroDi(UTENTI.B), {});
        expect(g.passo).toBe('intenso'); // solo per contare le tappe dello scheletro
        expect(Object.keys(g)).not.toContain('pace');
        const motore = readFileSync('src/services/aiRecommendationService.js', 'utf8');
        expect(motore).toContain("maxLegKm: normalizePace(prefs?.pace) === 'intenso' ? null : TETTO_PIEDI_KM"); // Crea: il ritmo chiesto
        expect(motore).toContain('maxLegKm: TETTO_PIEDI_KM, want: quante'); // Per Te: sempre il tetto
        expect(motore).toContain("if (normalizePace(prefs?.pace) !== 'intenso') {"); // l'ultima rete del tetto (tettoNelPiano)
        expect(giroDnaPerMotore(dnaGiroDi(UTENTI.A), { pace: 'Attivo' }).ritmo).toBeNull(); // un ritmo chiesto spegne quello del DNA
    });
});

describe('DNA-5 parte 2 — la compagnia', () => {
    it('dal testo della richiesta', () => {
        expect(compagniaDalTesto('Domani a Roma con i bambini')).toBe('famiglia');
        expect(compagniaDalTesto('una serata in coppia a Napoli')).toBe('coppia');
        expect(compagniaDalTesto('un giro con gli amici')).toBe('amici');
        expect(compagniaDalTesto('da sola a Catania')).toBe('solo');
        expect(compagniaDalTesto('una giornata a Roma')).toBeNull();
    });
    it('chi vince: il testo → il Gruppo scelto → il Profilo → le scelte passate', () => {
        expect(compagniaDelGiro({ testo: 'con i bambini', scelta: 'Coppia', profilo: 'amici' })).toMatchObject({ valore: 'famiglia', fonte: 'testo' });
        expect(compagniaDelGiro({ scelta: 'Coppia', profilo: 'amici' })).toMatchObject({ valore: 'coppia', fonte: 'richiesta' });
        expect(compagniaDelGiro({ profilo: 'famiglia', scelte: 'amici' })).toMatchObject({ valore: 'famiglia', fonte: 'profilo', gruppo: 'Famiglia' });
        expect(compagniaDelGiro({ scelte: { suggerito: 'amici', conteggi: { amici: 3 }, totale: 3 } })).toMatchObject({ valore: 'amici', fonte: 'scelte', quante: { k: 3, tot: 3 } });
        expect(compagniaDelGiro({})).toBeNull();
    });
    it('tipo di tappe: la famiglia spinge parchi e zoo e mette giu\' i bar; la coppia i belvedere', () => {
        expect(bonusCompagnia(PARCO, 'famiglia')).toBeGreaterThan(0);
        expect(bonusCompagnia(ZOO, 'famiglia')).toBeGreaterThan(bonusCompagnia(PARCO, 'famiglia'));
        expect(bonusCompagnia(BAR, 'famiglia')).toBeLessThan(0);
        expect(bonusCompagnia({ title: 'Belvedere del Gianicolo', types: ['tourist_attraction'] }, 'coppia')).toBeGreaterThan(0);
        expect(bonusCompagnia(MUSEO, 'solo')).toBe(0);
        expect(fuoriPerTe(BAR, 'famiglia')).toBe(true);
        expect(fuoriPerTe(BAR, 'amici')).toBe(false);
    });
    it('Per Te: con la famiglia i bar escono dai pool dei temi', () => {
        const pools = prepareHomePools({ food: [{ ...BAR, place_id: 'b1', name: 'Bar' }, { ...TRATTORIA, place_id: 't1', name: 'Trattoria' }] }, null, 'Roma', { compagnia: 'famiglia' });
        expect(pools.food.map(c => c.place_id)).toEqual(['t1']);
    });
    it('soste per mangiare: solo 60, coppia e amici cena 90, famiglia 75 con la merenda', () => {
        expect(REGOLE_COMPAGNIA.solo.sostaPasto).toEqual({ pranzo: 60, cena: 60 });
        expect(REGOLE_COMPAGNIA.coppia.sostaPasto.cena).toBe(90);
        expect(REGOLE_COMPAGNIA.amici.sostaPasto.cena).toBe(90);
        expect(REGOLE_COMPAGNIA.famiglia).toMatchObject({ sostaPasto: { pranzo: 75, cena: 75 }, merenda: true });
        expect(giroDnaPerMotore({ compagnia: { valore: 'famiglia', fonte: 'profilo', gruppo: 'Famiglia' } }, {})).toMatchObject({ merenda: true, gruppo: 'Famiglia' });
        expect(giroDnaPerMotore({ compagnia: { valore: 'coppia', fonte: 'richiesta', gruppo: 'Coppia' } }, { group: 'Coppia' }).gruppo).toBeNull(); // il Gruppo chiesto resta
    });
    it('la merenda: una sosta da forno o gelateria nello spazio libero, con le regole delle soste del DNA', () => {
        const ore = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0700' }, close: { day: d, time: '2300' } })) };
        const p = (id, name, types, primaryType, nordM) => ({ place_id: id, name, types, primaryType, latitude: 37.5 + nordM / 111000, longitude: 15.08, rating: 4.6, user_ratings_total: 300, opening_hours: ore });
        const museo = p('m1', 'Museo Civico', ['museum'], 'museum', 0);
        const tratt = p('t1', 'Trattoria', ['restaurant', 'food'], 'restaurant', 400);
        const caffe = p('k1', 'Caffè Storico', ['cafe', 'food'], 'cafe', 200);
        const forno = p('k2', 'Pasticceria Savia', ['bakery', 'food'], 'bakery', 220);
        const mattina = { key: 'mattina', start: new Date('2026-10-14T07:30:00Z'), end: new Date('2026-10-14T10:30:00Z') };
        const pranzo = { key: 'pranzo', start: new Date('2026-10-14T10:30:00Z'), end: new Date('2026-10-14T12:30:00Z') };
        const sched = { days: [[
            { candidate: museo, moment: mattina, start: new Date('2026-10-14T07:30:00Z'), waitMinutesBefore: 0, trace: {} },
            { candidate: tratt, moment: pranzo, start: new Date('2026-10-14T10:30:00Z'), waitMinutesBefore: 85, trace: {} },
        ]], tolte: [] };
        const richiesta = richiestaEsplicita({ intent: { categoria: 'misto', vincoli: { escludi: [] } }, testo: 'Una giornata a Catania', pathType: 'custom' });
        const r = aggiungiSosteDna({ sched, pool: [museo, tratt, caffe, forno], richiesta, categorieDi: mapCandidateToCoreCategories,
            dnaWeights: { food: 1, _share: 0.1 }, etichetta: 'merenda', soloSe: (c) => ['dolce', 'forno'].includes(placeKind(c).kind) });
        expect(r.report.aggiunte.map(x => x.nome)).toEqual(['Pasticceria Savia']); // il caffe' non e' una merenda
        expect(r.sched.days[0][1].trace.dna.merenda).toBe(true);
    });
});

describe('DNA-5 parte 3 — Per Te e il riquadro', () => {
    const tour = (themeType, stops) => ({ themeType, stops });
    const TOURS = [tour('insider', [MUSEO, PARCO]), tour('food', [TRATTORIA, TRATTORIA]), tour('cultura', [MUSEO, CHIESA]), tour('nature', [PARCO, ZOO])];
    it('Per Te in ordine di DNA: le tappe vere × i pesi; l\'insider resta primo', () => {
        const a = ordinaPerTe(TOURS, { pesi: UTENTI.A.pesi, fiducia: 0.45 });
        expect(a.tours.map(t => t.themeType)).toEqual(['insider', 'cultura', 'food', 'nature']);
        const c = ordinaPerTe(TOURS, { pesi: UTENTI.C.pesi, fiducia: 0.45, compagnia: 'famiglia' });
        expect(c.tours.map(t => t.themeType)).toEqual(['insider', 'nature', 'food', 'cultura']);
        expect(punteggioPerTe(tour('food', [TRATTORIA]), {})).toBe(0); // senza DNA e senza compagnia: 0, resta l'ordine del modello
        expect(ordinaPerTe(TOURS, {}).tours).toEqual(TOURS);
    });
    it('DashboardUser ordina con ordinaPerTe (non piu\' con i tag della scheda) e passa ritmo e compagnia', () => {
        const s = readFileSync('src/pages/DashboardUser.jsx', 'utf8');
        expect(s).toContain('ordinaPerTe(finalTours');
        expect(s).toContain('dnaGiro: dnaGiroPerTe');
        expect(s).not.toMatch(/\.sort\(\(a, b\) => getTourAffinity\(b\) - getTourAffinity\(a\)\);\n\s+finalTours = \[\.\.\.head/);
    });
    it('A: un fatto vero dai suoi giri (sosta media nei musei) e il ritmo con la sua fonte', () => {
        const giro = tracciatoGiroDna(giroDnaPerMotore(dnaGiroDi(UTENTI.A), {}));
        const r = righeDnaDelGiro({ pesi: UTENTI.A.pesi, fiducia: 0.45, tappe: [MUSEO, CHIESA], registro: UTENTI.A.registro, giro });
        expect(r).toEqual([
            'Nei tuoi ultimi 4 giri la sosta media nei musei è stata di 78 minuti.',
            'Meno tappe e soste più lunghe: nei tuoi ultimi 4 giri le soste sono durate il 30% più della stima di Unnivai.',
        ]);
    });
    it('B: il ritmo veloce e la compagnia dalle scelte passate', () => {
        const giro = tracciatoGiroDna(giroDnaPerMotore(dnaGiroDi(UTENTI.B), {}));
        expect(rigaRitmo(giro.ritmo)).toBe('Più tappe e soste più corte: nei tuoi ultimi 4 giri le soste sono durate il 30% meno della stima di Unnivai.');
        expect(rigaCompagnia(giro.compagnia)).toBe("Con gli amici: l'hai scelto in 3 richieste su 3.");
        const r = righeDnaDelGiro({ pesi: UTENTI.B.pesi, fiducia: 0.45, tappe: [PARCO], registro: UTENTI.B.registro, giro });
        expect(r[0]).toBe('Nei tuoi ultimi 4 giri la sosta media nel verde è stata di 20 minuti.');
    });
    it('C: la famiglia dal Profilo, la merenda se il giro ce l\'ha', () => {
        const giro = tracciatoGiroDna(giroDnaPerMotore(dnaGiroDi(UTENTI.C), {}));
        const merenda = { title: 'Gelateria del Teatro', types: ['ice_cream_shop'], primaryType: 'ice_cream_shop', scheduledTime: '2026-11-05T15:40:00Z', _tracciato: { dna: { sosta: true, merenda: true } } };
        const r = righeDnaDelGiro({ pesi: UTENTI.C.pesi, fiducia: 0.45, tappe: [PARCO, merenda], registro: UTENTI.C.registro, giro });
        expect(r).toEqual([
            'Nei tuoi ultimi 2 giri la sosta media in gelateria e pasticceria è stata di 24 minuti.', // a parita' di soste misurate, l'ordine alfabetico del tipo
            "In famiglia: l'hai scelto nel Profilo.",
            'Merenda alle 16:40 da Gelateria del Teatro.',
        ]);
    });
    it('righe vecchie (senza soste): quante tappe di quella categoria; mai la frase uguale per tutti', () => {
        const vecchie = UTENTI.A.registro.map(r => ({ ...r, value: r.kind === 'stop_reached' ? null : r.value }));
        const r = righeDnaDelGiro({ pesi: UTENTI.A.pesi, fiducia: 0.45, tappe: [MUSEO], registro: vecchie });
        expect(r).toEqual(['Nei tuoi ultimi 4 giri 12 tappe su 12 erano di storia e cultura.']);
        expect(r.join(' ')).not.toMatch(/gusti più forti/);
    });
});

describe('DNA-5 — il Profilo resta la fonte principale', () => {
    it('ritmo e compagnia stanno nel seme (gusti), un seme senza resta identico a prima', () => {
        expect(buildSeed({ interessi: ['food'], stile: 'street' })).toEqual({ v: 2, interessi: ['food'], vincoli: { dieta: [], budget: null }, gusti: { stile: 'street' } });
        const s = buildSeed({ interessi: ['food'], ritmo: 'lento', compagnia: 'famiglia' });
        expect(parseSeed(s).gusti).toEqual({ stile: null, ritmo: 'lento', compagnia: 'famiglia' });
        expect(seedFoodPrefs(s)).toMatchObject({ ritmo: 'lento', compagnia: 'famiglia' });
        expect(buildSeed({ ritmo: 'boh', compagnia: 'gatti' }).gusti).toEqual({ stile: null });
    });
    it('il Profilo vince su cio\' che si impara: ritmo e compagnia', () => {
        const g = dnaGiroDaApprendimento({ righeRegistro: UTENTI.B.registro, onboardingPrefs: { ritmo: 'lento', compagnia: 'coppia' }, ...preferenzeDi(UTENTI.B) });
        expect(g.ritmo).toMatchObject({ valore: 'lento', fonte: 'profilo' });
        expect(g.compagnia).toMatchObject({ valore: 'coppia', fonte: 'profilo' });
    });
});

describe('T29 — lo stesso tour rifatto sono due percorsi', () => {
    const tappa = (id, ora, km) => ({ id, kind: 'stop_reached', category: 'cultura', tour_id: 'g', value: `km=${km};sosta=30;tipo=museo`, created_at: ora });
    const chiusura = (id, ora) => ({ id, kind: 'tour_completed', category: 'cultura', tour_id: 'g', value: null, created_at: ora });
    const righe = [
        tappa('a', '2026-10-20T10:00:00Z', 0), tappa('b', '2026-10-20T11:00:00Z', 1), chiusura('c', '2026-10-20T11:00:30Z'), chiusura('c2', '2026-10-20T11:00:40Z'),
        tappa('d', '2026-10-24T10:00:00Z', 0), tappa('e', '2026-10-24T11:00:00Z', 1), chiusura('f', '2026-10-24T11:00:30Z'),
    ];
    it('due chiusure dello stesso tour sono due giri, con i loro km e le loro tappe', () => {
        const giri = giriDalRegistro(righe);
        expect(giri).toHaveLength(2);
        expect(giri.map(g => g.tappe.length)).toEqual([2, 2]);
        expect(giri.map(g => g.km)).toEqual([1, 1]);
    });
    it('un tour mai chiuso resta un giro solo', () => {
        expect(giriDalRegistro(righe.filter(r => r.kind === 'stop_reached'))).toHaveLength(1);
    });
    it('il ritmo appreso conta i giri veri', () => {
        expect(ritmoAppreso(righe)?.giri ?? giriDalRegistro(righe).length).toBe(2);
    });
});
