import { describe, it, expect } from 'vitest';
import { categorieForti, fraseDna, meteDalRegistro, contatoriDalRegistro, testoTappe, risultatiDalRegistro, livelloPeso, SOGLIE_TRAGUARDI } from '../../lib/dnaProfilo';

// DNA-6 — il DNA in parole semplici e le Mete lette dal registro.

describe('DNA-6 — il DNA in parole semplici', () => {
    it('le categorie più forti: dalla più alta, sotto 0,10 non contano, al massimo tre', () => {
        const f = categorieForti({ cultura: 0.3, food: 0.6, natura: 0.05, arte: 0.2, relax: 0.15 });
        expect(f.map(c => c.categoria)).toEqual(['food', 'cultura', 'arte']);
    });
    it('a parità vale l\'ordine delle categorie di base', () => {
        expect(categorieForti({ food: 0.3, cultura: 0.3 }).map(c => c.categoria)).toEqual(['cultura', 'food']);
    });
    it('la frase usa le due categorie più forti, nello stile dell\'app', () => {
        const { frasi } = fraseDna({ food: 0.6, cultura: 0.4, natura: 0.2 });
        expect(frasi).toEqual(['Ti fermi dove si mangia bene.', 'I musei li scegli con cura.']);
    });
    it('ritmo e compagnia entrano solo se «suggeriti»', () => {
        const pesi = { food: 0.5 };
        expect(fraseDna(pesi, { suggerito: null }, { suggerito: null }).frasi).toHaveLength(1);
        const { frasi } = fraseDna(pesi, { suggerito: 'lento' }, { suggerito: 'coppia' });
        expect(frasi).toEqual(['Ti fermi dove si mangia bene.', 'Preferisci un ritmo tranquillo.', 'Di solito giri in coppia.']);
    });
    it('senza segnale non inventa niente', () => {
        expect(fraseDna({}).frasi).toEqual([]);
        expect(fraseDna(null).frasi).toEqual([]);
    });
});

const riga = (kind, extra) => ({ id: `${kind}-${Math.random()}`, kind, category: null, city: null, value: null, tour_id: null, created_at: '2026-10-21T10:00:00Z', ...extra });

describe('DNA-6 — le Mete dal registro', () => {
    const righe = [
        riga('tour_completed', { category: 'food', city: 'Catania', tour_id: 'g1', value: '3/3', created_at: '2026-10-21T12:00:00Z' }),
        riga('tour_completed', { category: 'cultura', city: 'Catania', tour_id: 'g1', value: '3/3', created_at: '2026-10-21T12:00:00Z' }),
        riga('stop_reached', { category: 'food', city: 'Catania', tour_id: 'g1' }),
        riga('stop_reached', { category: 'cultura', city: 'Catania', tour_id: 'g1' }),
        riga('stop_reached', { category: 'food', city: 'Catania', tour_id: 'g1' }),
        riga('tour_completed', { category: 'natura', city: 'Roma', tour_id: 'g2', created_at: '2026-10-22T12:00:00Z' }),
        riga('stop_reached', { category: 'natura', city: 'Roma', tour_id: 'g2' }),
        riga('stop_reached', { category: 'food', city: 'Roma', tour_id: 'g-non-finito' }), // giro non completato: niente meta
        riga('stop_skipped', { category: 'arte', tour_id: 'g1' }),
    ];
    it('un elemento per ogni giro completato, dal più recente', () => {
        const m = meteDalRegistro(righe);
        expect(m.map(x => x.tourId)).toEqual(['g2', 'g1']);
    });
    it('città, data, categorie, tappe raggiunte e totali', () => {
        const g1 = meteDalRegistro(righe).find(x => x.tourId === 'g1');
        expect(g1).toMatchObject({ citta: 'Catania', tappeRaggiunte: 3, tappeTotali: 3 });
        expect(g1.categorie.sort()).toEqual(['cultura', 'food']);
        expect(g1.data).toBe('2026-10-21T12:00:00Z');
        expect(testoTappe(g1)).toBe('3 tappe raggiunte su 3');
    });
    it('senza il totale non lo inventa; una tappa si dice al singolare', () => {
        const g2 = meteDalRegistro(righe).find(x => x.tourId === 'g2');
        expect(g2.tappeTotali).toBeNull();
        expect(testoTappe(g2)).toBe('1 tappa raggiunta');
    });
    it('lo stesso evento arrivato due volte (stesso id) conta una volta', () => {
        const r = riga('stop_reached', { tour_id: 'g2' });
        const m = meteDalRegistro([...righe, r, { ...r }]).find(x => x.tourId === 'g2');
        expect(m.tappeRaggiunte).toBe(2);
    });
    it('contatori veri: giri, città, tappe raggiunte (anche di giri non finiti)', () => {
        expect(contatoriDalRegistro(righe)).toEqual({ giri: 2, citta: 2, tappe: 5 });
    });
    it('registro vuoto: zeri veri, non trattini', () => {
        expect(contatoriDalRegistro([])).toEqual({ giri: 0, citta: 0, tappe: 0 });
        expect(meteDalRegistro(undefined)).toEqual([]);
    });
    it('un giro completato senza id si riunisce per istante', () => {
        const a = riga('tour_completed', { category: 'food', created_at: '2026-10-20T10:00:00Z' });
        const b = riga('tour_completed', { category: 'arte', created_at: '2026-10-20T10:00:00Z' });
        const m = meteDalRegistro([a, b]);
        expect(m).toHaveLength(1);
        expect(m[0].categorie.sort()).toEqual(['arte', 'food']);
    });
});

describe('PROFILO-SEZIONI — Mete: lo stesso giro rifatto', () => {
    const r = (kind, tour_id, created_at, extra = {}) => ({ id: `${kind}-${created_at}-${extra.category || ''}`, kind, tour_id, created_at, category: null, city: 'Catania', value: null, ...extra });
    const righe = [
        r('stop_reached', 's1', '2026-10-01T10:00:00Z'),
        r('stop_reached', 's1', '2026-10-01T11:00:00Z'),
        r('tour_completed', 's1', '2026-10-01T11:05:00Z', { value: '2/2', category: 'food' }),
        r('tour_completed', 's1', '2026-10-01T11:05:00Z', { value: '2/2', category: 'arte' }),
        r('stop_reached', 's1', '2026-10-09T10:00:00Z'),
        r('tour_completed', 's1', '2026-10-09T12:00:00Z', { value: '1/2', category: 'food' }),
    ];
    it('un giro salvato finito due volte (stesso id) sono due Mete, ciascuna con le sue tappe', () => {
        const m = meteDalRegistro(righe);
        expect(m.map(x => x.tappeRaggiunte)).toEqual([1, 2]);
        expect(m.map(x => x.data)).toEqual(['2026-10-09T12:00:00Z', '2026-10-01T11:05:00Z']);
        expect(m[1].categorie.sort()).toEqual(['arte', 'food']);
        expect(contatoriDalRegistro(righe).giri).toBe(2);
    });
    it('una riga per categoria dello stesso giro resta un giro solo (anche con pochi secondi di scarto)', () => {
        const m = meteDalRegistro([r('tour_completed', 'g', '2026-10-01T11:05:00Z', { category: 'food' }), r('tour_completed', 'g', '2026-10-01T11:05:02Z', { category: 'arte' })]);
        expect(m).toHaveLength(1);
        expect(m[0].fine).toBeUndefined();
    });
});

describe('PROFILO-SEZIONI — Risultati dal registro', () => {
    const tappa = (i, extra = {}) => ({ id: `t${i}`, kind: 'stop_reached', tour_id: 'g1', city: 'Catania', category: 'cultura', value: `km=0.40;sosta=30;tipo=museo`, created_at: '2026-10-21T10:00:00Z', ...extra });
    const fine = (id, city, data) => ({ id: `f${id}`, kind: 'tour_completed', tour_id: id, city, category: 'cultura', value: '1/1', created_at: data });

    it('registro vuoto: zeri veri, nessun traguardo, primo obiettivo dichiarato', () => {
        const r = risultatiDalRegistro([]);
        expect(r.vuoto).toBe(true);
        expect(r.voci.map(v => v.valore)).toEqual([0, 0, 0, 0]);
        expect(r.voci.every(v => v.presi.length === 0)).toBe(true);
        expect(r.voci[0].prossimo).toBe(1);
        expect(r.citta).toEqual([]);
        expect(r.categoria).toBeNull();
    });
    it('i numeri sono quelli del registro: giri, città, tappe, km dal value', () => {
        const righe = [fine('g1', 'Catania', '2026-10-21T12:00:00Z'), fine('g2', 'Roma', '2026-10-22T12:00:00Z'), fine('g3', 'catania', '2026-10-23T12:00:00Z'),
            ...[1, 2, 3].map(i => tappa(i)), tappa(4, { value: null, category: 'food' })]; // riga vecchia: nessun km, resta una tappa
        const r = risultatiDalRegistro(righe);
        const v = Object.fromEntries(r.voci.map(x => [x.id, x.valore]));
        expect(v).toEqual({ giri: 3, citta: 2, tappe: 4, km: 1.2 });
        expect(r.citta).toEqual([{ nome: 'Catania', giri: 2 }, { nome: 'Roma', giri: 1 }]);
        expect(r.categoria).toEqual({ categoria: 'cultura', tappe: 3 });
        expect(r.vuoto).toBe(false);
    });
    it('traguardi: presi quelli passati, il prossimo è la soglia dopo, la barra parte dall\'ultimo preso', () => {
        const righe = [1, 2, 3, 4, 5, 6].map(i => fine(`g${i}`, 'Roma', `2026-10-2${i}T12:00:00Z`));
        const giri = risultatiDalRegistro(righe).voci[0];
        expect(giri).toMatchObject({ valore: 6, presi: [1, 5], prossimo: 10, base: 5 });
    });
    it('oltre l\'ultima soglia non c\'è un prossimo', () => {
        const n = SOGLIE_TRAGUARDI.giri.at(-1);
        const righe = Array.from({ length: n }, (_, i) => fine(`g${i}`, 'Roma', new Date(Date.UTC(2026, 0, 1 + i)).toISOString()));
        expect(risultatiDalRegistro(righe).voci[0].prossimo).toBeNull();
    });
    it('il livello segue le soglie della fascia di DNA', () => {
        expect([0, 0.05, 0.2, 0.49, 0.5, 1].map(livelloPeso)).toEqual(['zero', 'leggero', 'medio', 'medio', 'forte', 'forte']);
    });
});
