// GUARDIA-PERTINENZA — i 5 controlli di pertinenza di BORGO-DIAGNOSI (scripts/banco/pertinenza.js) sul grezzo del banco:
// funzione pura, le copie dei tipi restano uguali a quelle del motore, la sonda legge l'intento dalla riga di console.
import { describe, it, expect } from 'vitest';
import { controllaPertinenza, tabellaPertinenza, celleRosse, rosseNuove, isNatura, isStoria, famiglieChieste, TIPI_NATURA, TIPI_STORICI, NOME_NATURA, TESTO_NATURA } from '../../../scripts/banco/pertinenza.js';
import { leggiIntento, avvolgiMomentSelection, azzeraSonda, senzaMomentoDellaSonda } from '../../../scripts/banco/pertinenza-sonda.js';
import { isNaturaOPanorama, isLuogoStorico } from '@/lib/borgoConfini';
import { requestedFamilies } from '@/services/momentSelection';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const tappa = (title, types, extra = {}) => ({ place_id: `id-${title}`, title, types, at: '2026-10-15T21:00:00.000Z', stay: 30, min: 10, ...extra });
const quizNatura = (stops, extra = {}) => ({
    id: 'q', modo: 'veloce', luogo: 'Troina', chiamata: { pagina: 'QuickPath.jsx', prefs: { interests: ['Natura', 'Parchi e Verde'] }, testo: 'A Troina cerco: parchi. Escludi: chiese, musei' },
    schermo: { sezioni: [{ etichetta: 'Dopocena' }], note: [], riquadro: { mostrato: true, scelta: 'Natura / Parchi e Verde' }, durate: { riepilogo: 92 } },
    pool: { 'g1-passeggiata': { candidati: [{ nome: 'Monte Muganà', types: ['scenic_spot'], motivo: 'oltre il tetto di cammino', nelGiro: false }] } },
    tours: [{ stops }], ...extra,
});
const esiti = (r) => r.controlli.map(c => c.esito);

describe('GUARDIA-PERTINENZA — le copie dei tipi restano quelle del motore', () => {
    it('TIPI_NATURA, NOME_NATURA e TIPI_STORICI sono quelli di borgoConfini.js', () => {
        const src = readFileSync(path.join(process.cwd(), 'src/lib/borgoConfini.js'), 'utf8');
        for (const t of TIPI_NATURA) expect(src, t).toContain(`'${t}'`);
        for (const t of TIPI_STORICI) expect(src, t).toContain(`'${t}'`);
        expect(src).toContain(NOME_NATURA.source);
        const ms = readFileSync(path.join(process.cwd(), 'src/services/momentSelection.js'), 'utf8');
        expect(ms).toContain(TESTO_NATURA.source);
    });
    it('isNatura e isStoria concordano con borgoConfini sui casi del borgo', () => {
        const monte = { name: 'Monte Muganà', types: ['scenic_spot', 'point_of_interest'], primaryType: 'scenic_spot' };
        const chiesa = { name: 'Chiesa Madre', types: ['church', 'place_of_worship'], primaryType: 'church' };
        const bar = { name: 'Bar Sunshine', types: ['bar', 'point_of_interest'], primaryType: 'bar' };
        const parco = { name: 'Villa Bellini', types: ['park'], primaryType: 'park' };
        for (const p of [monte, chiesa, bar, parco]) {
            expect(isNatura({ title: p.name, types: p.types, primaryType: p.primaryType })).toBe(isNaturaOPanorama(p));
            expect(isStoria({ title: p.name, types: p.types, primaryType: p.primaryType })).toBe(isLuogoStorico(p));
        }
    });
    it('le famiglie dal testo seguono requestedFamilies per la natura', () => {
        const testo = 'fammi fare domani una giornata tra natura e luoghi storici';
        expect(famiglieChieste({ modo: 'crea', richiesta: testo }).famiglie).toContain('natura');
        expect(requestedFamilies({ text: testo }).has('verde')).toBe(true);
        expect(famiglieChieste({ modo: 'crea', richiesta: 'Una giornata a Troina' }).famiglie).toEqual([]);
        // controllo 1: per Crea la natura e' chiesta dal testo, non dalle query che il traduttore sceglie da solo
        const generica = { id: 'g', modo: 'crea', richiesta: 'Una giornata a Troina', intento: { queries: ['parco', 'centro storico'], categoria: 'misto', famiglie: [] },
            tours: [{ stops: [tappa('Chiesa Madre', ['church'])] }], schermo: { sezioni: [], note: [] } };
        expect(controllaPertinenza(generica).controlli[0].esito).toBe('—');
    });
});

describe('GUARDIA-PERTINENZA — controllo 1 (natura)', () => {
    it('B1: natura chiesta, bar + via, riquadro «Natura» → ❌ con la natura raggiungibile', () => {
        const r = controllaPertinenza(quizNatura([tappa('Bar Sunshine', ['bar']), tappa('Via Conte Ruggero', ['route'])]));
        expect(esiti(r)[0]).toBe('❌');
        expect(r.controlli[0].nota).toContain('Monte Muganà');
        expect(r.controlli[0].nota).toContain('riquadro');
        expect(r.ok).toBe(false);
    });
    it('una tappa di natura → ✅; una nota che nomina la natura senza riquadro → ✅; con riquadro resta ❌', () => {
        expect(esiti(controllaPertinenza(quizNatura([tappa('Bar', ['bar']), tappa('Monte Muganà', ['scenic_spot'])])))[0]).toBe('✅');
        const nota = 'La natura di notte non si vede. Stasera ti porto qui.';
        const conNota = quizNatura([tappa('Bar', ['bar'])]);
        conNota.schermo = { ...conNota.schermo, note: [nota], riquadro: { mostrato: false } };
        expect(esiti(controllaPertinenza(conNota))[0]).toBe('✅');
        const conRiquadro = quizNatura([tappa('Bar', ['bar'])]);
        conRiquadro.schermo = { ...conRiquadro.schermo, note: [nota] };
        expect(esiti(controllaPertinenza(conRiquadro))[0]).toBe('❌');
    });
    it('natura non chiesta (Per Te, Quiz Storia) → «—»; un parco con nome da natura conta, un ristorante «Cala» no', () => {
        expect(esiti(controllaPertinenza({ id: 'a', modo: 'perte', tours: [{ stops: [tappa('Bar', ['bar'])] }], schermo: {} }))[0]).toBe('—');
        expect(isNatura(tappa('Belvedere della Piazza', ['point_of_interest']))).toBe(true);
        expect(isNatura(tappa('Cala Ristorante', ['restaurant'], { pasto: true }))).toBe(false);
    });
});

describe('GUARDIA-PERTINENZA — controlli 2, 3, 4, 5', () => {
    const crea = (stops, extra = {}) => ({
        id: 'c', modo: 'crea', luogo: 'Troina', richiesta: 'fammi fare domani una giornata tra natura e luoghi storici',
        chiamata: { pagina: 'AiItinerary.jsx', prefs: {}, testo: 'fammi fare domani una giornata tra natura e luoghi storici' },
        intento: { queries: ['riserva naturale', 'centro storico', 'castello'], categoria: 'misto' },
        schermo: { sezioni: [{ etichetta: 'Mattina' }, { etichetta: 'Pranzo' }], note: ['Troina si gira in mezza giornata.'], durate: { giro: 195 } },
        tours: [{ stops }], ...extra,
    });
    it('C: solo storia → 1 ❌, 2 ❌, 3 ✅ per la nota, 4 «—», 5 «non compare»', () => {
        const r = controllaPertinenza(crea([tappa('Chiesa Madre', ['church'], { famiglia: 'chiesa' }), tappa('Torre Capitania', ['museum'], { famiglia: 'museo' }), tappa("A'Pescheria", ['restaurant'], { pasto: true })]));
        expect(esiti(r)).toEqual(['❌', '❌', '✅', '—', '—']);
        expect(r.controlli[1].nota).toContain('natura: nessuna tappa');
        expect(r.controlli[2].nota).toContain('mezza giornata');
        expect(r.controlli[4].nota).toBe('non compare');
    });
    it('Catania: natura e storia, Mattina e Pomeriggio → 1 ✅, 2 ✅, 3 ✅', () => {
        const c = crea([tappa('Cattedrale', ['church'], { famiglia: 'chiesa' }), tappa('Villa Bellini', ['park'], { famiglia: 'verde' })]);
        c.schermo.sezioni = [{ etichetta: 'Mattina' }, { etichetta: 'Pranzo' }, { etichetta: 'Pomeriggio' }];
        c.schermo.note = [];
        expect(esiti(controllaPertinenza(c)).slice(0, 3)).toEqual(['✅', '✅', '✅']);
    });
    it('«giornata» senza Mattina e Pomeriggio e senza una nota → 3 ❌; senza «giornata» → «—»', () => {
        const c = crea([tappa('Chiesa', ['church']), tappa('Parco', ['park'])]);
        c.schermo.note = [];
        expect(esiti(controllaPertinenza(c))[2]).toBe('❌');
        const senza = crea([tappa('Chiesa', ['church']), tappa('Parco', ['park'])]);
        senza.richiesta = 'natura e storia'; senza.chiamata.testo = senza.richiesta;
        expect(esiti(controllaPertinenza(senza))[2]).toBe('—');
    });
    it('controllo 4: Sorprendimi 180 contro 79 → ❌; Per Te 108 = 108 → ✅; un numero solo → «—»', () => {
        const base = { id: 's', modo: 'sorprendimi', chiamata: { prefs: { interests: ['Natura'] } }, tours: [{ stops: [tappa('Monte Muganà', ['scenic_spot'])] }] };
        expect(esiti(controllaPertinenza({ ...base, schermo: { durate: { scheda: 180, giro: 79 } } }))[3]).toBe('❌');
        expect(esiti(controllaPertinenza({ ...base, modo: 'perte', schermo: { durate: { scheda: 108, dettaglio: 108 } } }))[3]).toBe('✅');
        expect(esiti(controllaPertinenza({ ...base, schermo: { durate: { giro: 79 } } }))[3]).toBe('—');
    });
    it('controllo 5 conta e basta: un caffè di mattina → «1 tappa da colazione», il bar del dopocena no, mai un ❌', () => {
        const r = controllaPertinenza({ id: 'k', modo: 'crea', richiesta: 'x', tours: [{ stops: [tappa('Bar Centrale', ['cafe'], { colazione: true, moment: 'mattina', at: '2026-10-16T07:00:00.000Z' })] }], schermo: {} });
        expect(r.controlli[4]).toMatchObject({ esito: '—', conto: 1 });
        const sera = controllaPertinenza({ id: 'k', modo: 'perte', tours: [{ stops: [tappa('Bar Sunshine', ['bar'], { colazione: true, moment: 'dopocena', at: '2026-10-15T21:00:00.000Z' })] }], schermo: {} });
        expect(sera.controlli[4]).toMatchObject({ esito: '—', conto: 0, nota: 'non compare' });
    });
    it('un caso con errore, saltato o con uscite in rete è ❌ su tutto; la tabella e i ❌ nuovi', () => {
        const r = controllaPertinenza({ id: 'e', modo: 'crea', errore: 'timeout' });
        expect(esiti(r)).toEqual(['❌', '❌', '❌', '❌', '❌']);
        const righe = [r, controllaPertinenza(quizNatura([tappa('Bar', ['bar'])]))];
        expect(celleRosse(righe)).toEqual(['e:1', 'e:2', 'e:3', 'e:4', 'e:5', 'q:1']);
        expect(rosseNuove(righe, ['q:1'])).toEqual(['e:1', 'e:2', 'e:3', 'e:4', 'e:5']);
        expect(tabellaPertinenza(righe, { noti: ['q:1'] })).toContain('5 ❌ NUOVI');
    });
});

describe('GUARDIA-PERTINENZA — la sonda', () => {
    it('legge l\'intento dalla riga che il motore scrive in console', () => {
        const i = leggiIntento('[Gate B] intent tradotto: queries=["riserva naturale","centro storico"] categoria=misto oggetto="natura e storia" source=ai');
        expect(i).toEqual({ queries: ['riserva naturale', 'centro storico'], categoria: 'misto', oggetto: 'natura e storia', fonte: 'ai' });
        expect(leggiIntento('altro')).toBeNull();
    });
    it('annota i candidati che nessun momento prende, ignorando la riserva anyCategory, e il motore riceve i bucket veri', () => {
        const m = { bucketCandidates: (moments, candidates, o) => new Map(moments.map(x => [x.id, o?.anyCategory ? candidates : candidates.filter(c => c.types[0] === x.cat)])) };
        const w = avvolgiMomentSelection(m);
        azzeraSonda();
        const moments = [{ id: 'g1-mattina', cat: 'church' }];
        const cands = [{ place_id: 'a', name: 'Chiesa', types: ['church'] }, { place_id: 'b', name: 'Monte', types: ['scenic_spot'] }];
        const b = w.bucketCandidates(moments, cands, {});
        expect([...b.get('g1-mattina')].map(c => c.place_id)).toEqual(['a']);
        w.bucketCandidates(moments, cands, { anyCategory: true });
        expect(senzaMomentoDellaSonda().map(c => c.nome)).toEqual(['Monte']);
    });
});
