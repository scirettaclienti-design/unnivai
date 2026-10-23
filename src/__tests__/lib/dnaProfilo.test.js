import { describe, it, expect } from 'vitest';
import { categorieForti, fraseDna, meteDalRegistro, contatoriDalRegistro, testoTappe } from '../../lib/dnaProfilo';

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
