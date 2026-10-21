import { describe, it, expect } from 'vitest';
import {
    pesiDaEventi, decadimento, REGISTRO_PESI, MEZZA_VITA_GIORNI, computeWeights,
} from '../../services/preferenceEngine';
import { giroCompletato } from '../../lib/giroCompletato';

// DNA-2 — i pesi si calcolano dal registro. Tutto a 0 $, nessuna rete.
const ORA = new Date('2026-10-21T12:00:00Z');
const giorniFa = (g) => new Date(ORA.getTime() - g * 86400000).toISOString();
let n = 0;
const ev = (kind, category, giorni = 0, extra = {}) => ({ id: `e${++n}`, kind, category, created_at: giorniFa(giorni), tour_id: extra.tour_id ?? `g${n}`, value: extra.value ?? null });

/** Un giro completato di food: una tappa raggiunta e il giro completato (stessa categoria, stesso istante). */
const giroFood = (giorni = 0) => {
    const id = `giro-${++n}`;
    const t = giorniFa(giorni);
    return [
        { id: `r${n}a`, kind: 'stop_reached', category: 'food', created_at: t, tour_id: id },
        { id: `r${n}b`, kind: 'tour_completed', category: 'food', created_at: t, tour_id: id },
    ];
};

describe('DNA-2 — utente nuovo contro utente con giri (punto B2)', () => {
    const seme = ['cultura', 'food']; // l'onboarding ha seminato cultura e food
    const prima = pesiDaEventi([], seme, ORA);
    const eventi = [
        ...giroFood(), ...giroFood(), ...giroFood(), // 3 giri food completati
        ev('stop_skipped', 'cultura'), ev('stop_skipped', 'cultura'), // 2 tappe cultura saltate
    ];
    const dopo = pesiDaEventi(eventi, seme, ORA);

    it('utente nuovo: solo il seme, fiducia zero', () => {
        expect(prima.pesi.food).toBe(0.3);
        expect(prima.pesi.cultura).toBe(0.3);
        expect(prima.eventi).toBe(0);
        expect(prima.share).toBe(0.15); // il seme da solo vale al massimo 15%, come oggi
    });

    it('food SALE, cultura SCENDE (il vecchio Math.max annullava il negativo)', () => {
        console.log('DNA-2 tabella prima/dopo →', JSON.stringify({ prima: prima.pesi, dopo: dopo.pesi, eventi: dopo.eventi, share: dopo.share, semeFattore: dopo.semeFattore }));
        expect(dopo.pesi.food).toBeGreaterThan(prima.pesi.food);
        expect(dopo.pesi.cultura).toBeLessThan(prima.pesi.cultura);
        expect(dopo.pesi.food - prima.pesi.food).toBeGreaterThan(0.1); // misurabile
        expect(prima.pesi.cultura - dopo.pesi.cultura).toBeGreaterThan(0.1);
    });

    it('i pesi restano fra 0 e 1', () => {
        const tanti = pesiDaEventi(Array.from({ length: 40 }, () => giroFood()).flat(), [], ORA);
        expect(tanti.pesi.food).toBe(1);
        const negativi = pesiDaEventi(Array.from({ length: 20 }, () => ev('stop_skipped', 'natura')), [], ORA);
        expect(negativi.pesi.natura).toBe(0);
    });

    it('la fiducia conta i giri e le tappe saltate (non una per categoria né una per tappa raggiunta)', () => {
        // 3 giri = 3 tour_completed (ciascuno con 1 riga food + 1 stop_reached) + 2 skipped = 5 eventi
        expect(dopo.eventi).toBe(5);
        // un giro con 3 categorie = 1 evento, non 3
        const t = giorniFa(0);
        const multi = ['food', 'cultura', 'natura'].map((category, i) => ({ id: `m${i}`, kind: 'tour_completed', category, created_at: t, tour_id: 'gm' }));
        expect(pesiDaEventi(multi, [], ORA).eventi).toBe(1);
    });

    it('il peso del DNA nel motore resta la curva di oggi: 0 sotto 5 eventi, 0,45 a 20', () => {
        const giri = (k) => Array.from({ length: k }, (_, i) => ({ id: `c${k}-${i}`, kind: 'tour_completed', category: 'food', created_at: giorniFa(0), tour_id: `t${k}-${i}` }));
        expect(pesiDaEventi(giri(4), [], ORA).share).toBe(0);
        expect(pesiDaEventi(giri(5), [], ORA).share).toBe(0);
        expect(pesiDaEventi(giri(20), [], ORA).share).toBe(0.45);
        expect(pesiDaEventi(giri(30), [], ORA).share).toBe(0.45);
    });

    it('cresce giro dopo giro e la fiducia sale in modo monotono (0 / 5 / 10 / 20 giri)', () => {
        const serie = [0, 5, 10, 20].map(k => {
            const evs = Array.from({ length: k }, (_, i) => ({ id: `s${k}-${i}`, kind: 'tour_completed', category: i % 2 ? 'natura' : 'food', created_at: giorniFa(0), tour_id: `s${k}-${i}` }));
            return pesiDaEventi(evs, [], ORA);
        });
        for (let i = 1; i < serie.length; i++) expect(serie[i].share).toBeGreaterThanOrEqual(serie[i - 1].share);
        expect(serie[3].share).toBeGreaterThan(serie[0].share);
        expect(serie[1].pesi.food).toBeGreaterThan(serie[0].pesi.food);
    });
});

describe('DNA-2 — decadimento', () => {
    it('un evento vale 1 adesso, la metà dopo 30 giorni, un quarto dopo 60', () => {
        expect(MEZZA_VITA_GIORNI).toBe(30);
        expect(decadimento(giorniFa(0), ORA)).toBeCloseTo(1, 6);
        expect(decadimento(giorniFa(30), ORA)).toBeCloseTo(0.5, 6);
        expect(decadimento(giorniFa(60), ORA)).toBeCloseTo(0.25, 6);
    });

    it('lo stesso evento pesa meno se è vecchio; un evento nel futuro non pesa più di uno di adesso', () => {
        const recente = pesiDaEventi([{ id: 'a', kind: 'tour_completed', category: 'food', created_at: giorniFa(0) }], [], ORA).pesi.food;
        const vecchio = pesiDaEventi([{ id: 'a', kind: 'tour_completed', category: 'food', created_at: giorniFa(30) }], [], ORA).pesi.food;
        const futuro = pesiDaEventi([{ id: 'a', kind: 'tour_completed', category: 'food', created_at: giorniFa(-5) }], [], ORA).pesi.food;
        expect(recente).toBe(0.3);
        expect(vecchio).toBe(0.15);
        expect(futuro).toBe(0.3);
    });

    it('un negativo recente pesa più di uno vecchio', () => {
        const base = [{ id: 'p', kind: 'tour_completed', category: 'cultura', created_at: giorniFa(0), tour_id: 'x' }];
        const recente = pesiDaEventi([...base, { id: 'n', kind: 'stop_skipped', category: 'cultura', created_at: giorniFa(0) }], [], ORA).pesi.cultura;
        const vecchio = pesiDaEventi([...base, { id: 'n', kind: 'stop_skipped', category: 'cultura', created_at: giorniFa(90) }], [], ORA).pesi.cultura;
        expect(recente).toBeLessThan(vecchio);
    });
});

describe('DNA-2 — il seme si attenua con l’uso', () => {
    it('pesa 0,3 all’inizio e sempre meno man mano che arrivano eventi (di altre categorie)', () => {
        const altri = (k) => Array.from({ length: k }, (_, i) => ({ id: `z${k}-${i}`, kind: 'tour_saved', category: 'natura', created_at: giorniFa(0), tour_id: `z${k}-${i}` }));
        const w = [0, 10, 20, 40].map(k => pesiDaEventi(altri(k), ['food'], ORA));
        expect(w[0].pesi.food).toBe(0.3);
        expect(w[1].pesi.food).toBeLessThan(w[0].pesi.food);
        expect(w[2].pesi.food).toBeLessThan(w[1].pesi.food);
        expect(w[3].pesi.food).toBeLessThan(w[2].pesi.food);
        expect(w[2].semeFattore).toBe(0.5); // a 20 eventi vale la metà
        expect(w[2].pesi.food).toBe(0.15);
    });

    it('il seme non si somma al registro due volte: senza eventi i pesi sono quelli di computeWeights', () => {
        expect(pesiDaEventi([], ['food', 'arte'], ORA).pesi).toEqual(computeWeights({}, ['food', 'arte']));
    });
});

describe('DNA-2 — due dispositivi con gli stessi eventi → gli stessi pesi', () => {
    const eventi = [...giroFood(2), ...giroFood(10), ev('stop_skipped', 'cultura', 1), ev('quiz_choice', 'natura', 3), ev('tour_saved', 'arte', 40)];

    it('l’ordine delle righe non cambia niente', () => {
        const a = pesiDaEventi(eventi, ['cultura'], ORA);
        const b = pesiDaEventi([...eventi].reverse(), ['cultura'], ORA);
        const c = pesiDaEventi([...eventi].sort(() => 0.5 - Math.random()), ['cultura'], ORA);
        expect(b).toEqual(a);
        expect(c).toEqual(a);
    });

    it('lo stesso evento letto due volte (stesso id) conta una volta: niente Math.max, niente somme doppie', () => {
        const a = pesiDaEventi(eventi, [], ORA);
        const doppio = pesiDaEventi([...eventi, ...eventi], [], ORA);
        expect(doppio).toEqual(a);
    });

    it('un telefono con la cache e uno col server (stesse righe, copiate) dànno lo stesso risultato', () => {
        const cache = JSON.parse(JSON.stringify(eventi));
        expect(pesiDaEventi(cache, ['cultura'], ORA)).toEqual(pesiDaEventi(eventi, ['cultura'], ORA));
    });

    it('un evento negativo abbassa davvero, anche con tanti positivi altrove (nessuna fusione col massimo)', () => {
        const senza = pesiDaEventi([...giroFood(), { id: 'pc', kind: 'tour_completed', category: 'cultura', created_at: giorniFa(0), tour_id: 'q' }], [], ORA).pesi.cultura;
        const con = pesiDaEventi([...giroFood(), { id: 'pc', kind: 'tour_completed', category: 'cultura', created_at: giorniFa(0), tour_id: 'q' }, ev('stop_skipped', 'cultura')], [], ORA).pesi.cultura;
        expect(con).toBeLessThan(senza);
    });
});

describe('DNA-2 — ritmo e compagnia dagli eventi (base per B8)', () => {
    const scelta = (kind, value) => ({ id: `v${++n}`, kind, category: null, value, created_at: giorniFa(0) });

    it('ritmo: Rilassato→lento, Attivo→medio, Intenso→veloce; «suggerito» solo con ≥ 3 scelte e ≥ 60%', () => {
        const r = pesiDaEventi([scelta('pace_chosen', 'Rilassato'), scelta('pace_chosen', 'Rilassato'), scelta('pace_chosen', 'Rilassato'), scelta('pace_chosen', 'Intenso')], [], ORA).ritmo;
        expect(r.conteggi).toEqual({ lento: 3, veloce: 1 });
        expect(r.preferito).toBe('lento');
        expect(r.quota).toBe(0.75);
        expect(r.suggerito).toBe('lento');
    });

    it('con meno di 3 scelte o meno del 60% non si suggerisce niente', () => {
        expect(pesiDaEventi([scelta('pace_chosen', 'Attivo'), scelta('pace_chosen', 'Attivo')], [], ORA).ritmo.suggerito).toBeNull();
        const misto = pesiDaEventi([scelta('pace_chosen', 'Attivo'), scelta('pace_chosen', 'Attivo'), scelta('pace_chosen', 'Rilassato'), scelta('pace_chosen', 'Intenso'), scelta('pace_chosen', 'Intenso')], [], ORA).ritmo;
        expect(misto.quota).toBe(0.4);
        expect(misto.suggerito).toBeNull();
    });

    it('compagnia: solo / coppia / amici (e famiglia)', () => {
        const c = pesiDaEventi([scelta('company_chosen', 'coppia'), scelta('company_chosen', 'Coppia'), scelta('company_chosen', 'coppia'), scelta('company_chosen', 'amici')], [], ORA).compagnia;
        expect(c.preferito).toBe('coppia');
        expect(c.suggerito).toBe('coppia');
        expect(pesiDaEventi([], [], ORA).compagnia.suggerito).toBeNull();
    });

    it('ritmo e compagnia non muovono i pesi delle categorie', () => {
        const solo = pesiDaEventi([scelta('pace_chosen', 'Intenso'), scelta('company_chosen', 'solo')], ['food'], ORA);
        expect(solo.pesi).toEqual(pesiDaEventi([], ['food'], ORA).pesi);
        expect(solo.eventi).toBe(0);
    });
});

describe('DNA-2 — quando un giro è completato (regola del 60%)', () => {
    const tappe = (k) => Array.from({ length: k }, (_, i) => ({ id: `t${i + 1}` }));
    const fatte = (...n) => n.map(i => `t${i}`);

    it('l’ultima tappa raggiunta basta, anche con le altre saltate', () => {
        expect(giroCompletato(tappe(5), fatte(5))).toBe(true);
        expect(giroCompletato(tappe(3), fatte(3))).toBe(true);
    });

    it('almeno il 60% delle tappe raggiunte basta, anche senza l’ultima', () => {
        expect(giroCompletato(tappe(5), fatte(1, 2, 3))).toBe(true);   // 3/5 = 60%
        expect(giroCompletato(tappe(10), fatte(1, 2, 3, 4, 5, 6))).toBe(true);
        expect(giroCompletato(tappe(3), fatte(1, 2))).toBe(true);      // 2/3 = 67%
    });

    it('sotto il 60% e senza l’ultima NON è completato', () => {
        expect(giroCompletato(tappe(5), fatte(1, 2))).toBe(false);     // 40%
        expect(giroCompletato(tappe(10), fatte(1, 2, 3, 4, 5))).toBe(false); // 50%
        expect(giroCompletato(tappe(4), fatte(1, 2))).toBe(false);     // 50%
        expect(giroCompletato(tappe(3), [])).toBe(false);
    });

    it('casi vuoti o strani non lanciano', () => {
        expect(giroCompletato([], fatte(1))).toBe(false);
        expect(giroCompletato(null, null)).toBe(false);
        expect(giroCompletato(tappe(2), undefined)).toBe(false);
        expect(giroCompletato(tappe(1), fatte(1))).toBe(true);
    });

    it('MapPage usa la regola e registra tour_completed anche nel secondo caso', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync('src/pages/MapPage.jsx', 'utf8');
        expect(src).toMatch(/import \{ giroCompletato \} from '..\/lib\/giroCompletato'/);
        expect(src).toMatch(/!navCompletedRef\.current && giroCompletato\(activeRoute, fatteIds\)/);
        expect(src).not.toMatch(/fatteIds\.length >= totalSteps/);
    });
});

describe('DNA-2 — il registro pesa quanto stabilito', () => {
    it('i pesi dei gesti', () => {
        expect(REGISTRO_PESI).toEqual({ stop_reached: 0.05, tour_completed: 0.3, tour_saved: 0.2, quiz_choice: 0.2, stop_skipped: -0.1 });
    });
});
