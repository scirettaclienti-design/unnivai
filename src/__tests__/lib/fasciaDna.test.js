// DNA-4 — la fascia di DNA nella chiave di Per Te: regola, gradini, stabilita', tetto giornaliero. Tutto a 0 $.
import { describe, it, expect, beforeEach } from 'vitest';
import { fasciaDna, gradinoFiducia } from '@/lib/fasciaDna';
import {
    fasciaDnaEffettiva, registraFasciaDna, TETTO_RIGENERAZIONI_DNA_AL_GIORNO, PER_TE_DNA_KEY,
} from '@/lib/perTeSalvato';
import { pesiDaEventi } from '@/services/preferenceEngine';

const ADESSO = new Date('2026-10-22T12:00:00+02:00');
const riga = (id, kind, category, tour = null) => ({ id, kind, category, value: null, tour_id: tour, created_at: new Date(ADESSO.getTime() - 1000).toISOString() });
// un giro food completato = una tappa raggiunta + il giro completato
const giriFood = (n, da = 0) => Array.from({ length: n }, (_, i) => [riga(`r${da + i}`, 'stop_reached', 'food', `g${da + i}`), riga(`c${da + i}`, 'tour_completed', 'food', `g${da + i}`)]).flat();
const dnaDa = (eventi, seme = []) => { const d = pesiDaEventi(eventi, seme, ADESSO); return { ...d.pesi, _share: d.share }; };
const SEME = ['food', 'natura'];

describe('DNA-4 — la regola della fascia', () => {
    it('gradini di fiducia: 0 / poca (fino a 0,15) / media (fino a 0,30) / alta', () => {
        expect([0, -1, NaN, undefined].map(gradinoFiducia)).toEqual([0, 0, 0, 0]);
        expect([0.03, 0.15].map(gradinoFiducia)).toEqual([1, 1]);
        expect([0.151, 0.3].map(gradinoFiducia)).toEqual([2, 2]);
        expect([0.301, 0.45].map(gradinoFiducia)).toEqual([3, 3]);
    });

    it('fiducia 0: la fascia e\' sempre dna0, qualunque siano i pesi (il motore non li legge)', () => {
        expect(fasciaDna({ food: 1, cultura: 0.9, _share: 0 })).toBe('dna0');
        expect(fasciaDna({})).toBe('dna0');
        expect(fasciaDna(null)).toBe('dna0');
    });

    it('le 2 categorie piu\' forti col livello (1 da 0,20, 2 da 0,50) e il gradino di fiducia', () => {
        expect(fasciaDna({ food: 0.9, natura: 0.3, relax: 0.1, _share: 0.15 })).toBe('f1:food2+natura1');
        expect(fasciaDna({ food: 0.49, natura: 0.5, _share: 0.2 })).toBe('f2:natura2+food1');
        expect(fasciaDna({ cultura: 0.3, _share: 0.45 })).toBe('f3:cultura1');
        expect(fasciaDna({ cultura: 0.19, food: 0.1, _share: 0.15 })).toBe('f1:-'); // fiducia ma nessuna categoria forte
    });

    it('a parita\' di livello decide l\'ordine alfabetico, non il peso grezzo: un +0,05 nello stesso livello non cambia la fascia', () => {
        const prima = fasciaDna({ cultura: 0.3, food: 0.3, natura: 0.3, _share: 0.15 });
        const dopo = fasciaDna({ cultura: 0.3, food: 0.3, natura: 0.35, _share: 0.15 });
        expect(prima).toBe('f1:cultura1+food1');
        expect(dopo).toBe(prima);
    });

    it('le chiavi interne (_share, _richiesta) non sono categorie', () => {
        expect(fasciaDna({ _share: 0.15, _richiesta: { vuota: false }, food: 0.3 })).toBe('f1:food1');
    });
});

describe('DNA-4 — utente nuovo contro utente con giri food', () => {
    it('utente nuovo con il seme (food, natura) contro 5 giri food: fascia diversa', () => {
        const nuovo = fasciaDna(dnaDa([], SEME));
        const cinque = fasciaDna(dnaDa(giriFood(5), SEME));
        expect(nuovo).toBe('f1:food1+natura1');
        expect(cinque).toBe('f1:food2+natura1');
        expect(cinque).not.toBe(nuovo);
    });

    it('senza seme 5 giri non cambiano la fascia (il motore parte dal sesto evento): dna0 → dna0, poi dal sesto f1', () => {
        expect(fasciaDna(dnaDa([]))).toBe('dna0');
        expect(fasciaDna(dnaDa(giriFood(5)))).toBe('dna0');
        expect(fasciaDna(dnaDa(giriFood(6)))).toBe('f1:food2');
    });

    it('un gesto in piu\' senza cambio di gradino lascia la fascia identica (6° giro dopo 5, con il seme)', () => {
        expect(fasciaDna(dnaDa(giriFood(6), SEME))).toBe(fasciaDna(dnaDa(giriFood(5), SEME)));
    });

    it('stessi eventi, stessa fascia, in qualunque ordine di arrivo (due dispositivi)', () => {
        const eventi = giriFood(7);
        expect(fasciaDna(dnaDa([...eventi].reverse(), SEME))).toBe(fasciaDna(dnaDa(eventi, SEME)));
    });

    it('da 0 a 30 giri food, un giro alla volta: la fascia cambia poche volte e mai torna indietro', () => {
        const viste = [];
        for (let n = 0; n <= 30; n++) {
            const f = fasciaDna(dnaDa(giriFood(n), SEME));
            if (viste[viste.length - 1] !== f) viste.push(f);
        }
        expect(viste.length).toBeLessThanOrEqual(6);
        expect(new Set(viste).size).toBe(viste.length); // nessun ritorno a una fascia gia' vista
        expect(viste[0]).toBe('f1:food1+natura1');
        expect(viste[viste.length - 1]).toMatch(/^f3:/);
    });
});

describe('DNA-4 — il tetto delle rigenerazioni dovute al DNA', () => {
    beforeEach(() => localStorage.clear());
    const G = '2026-10-22';

    it('senza conto del giorno vale la fascia calcolata', () => {
        expect(fasciaDnaEffettiva('f1:food2', G, 'u1')).toBe('f1:food2');
    });

    it('la prima generazione del giorno e la stessa fascia in un\'altra fascia oraria non sono rigenerazioni del DNA', () => {
        registraFasciaDna('f1:food1', G, 'u1');
        registraFasciaDna('f1:food1', G, 'u1');
        expect(JSON.parse(localStorage.getItem(PER_TE_DNA_KEY)).rigenerazioni).toBe(0);
    });

    it('dopo il tetto la fascia resta quella dell\'ultima generazione, anche se il DNA continua a cambiare', () => {
        registraFasciaDna('A', G, 'u1');
        registraFasciaDna('B', G, 'u1'); // 1
        expect(fasciaDnaEffettiva('C', G, 'u1')).toBe('C'); // sotto il tetto: segue il DNA
        registraFasciaDna('C', G, 'u1'); // 2 = tetto
        expect(TETTO_RIGENERAZIONI_DNA_AL_GIORNO).toBe(2);
        expect(fasciaDnaEffettiva('D', G, 'u1')).toBe('C');
        expect(fasciaDnaEffettiva('E', G, 'u1')).toBe('C');
    });

    it('il conto e\' per giorno e per utente: il giorno dopo, o un altro utente, ripartono da zero', () => {
        registraFasciaDna('A', G, 'u1'); registraFasciaDna('B', G, 'u1'); registraFasciaDna('C', G, 'u1');
        expect(fasciaDnaEffettiva('D', '2026-10-23', 'u1')).toBe('D');
        expect(fasciaDnaEffettiva('D', G, 'u2')).toBe('D');
    });

    it('storage illeggibile: nessun tetto, nessun crash', () => {
        localStorage.setItem(PER_TE_DNA_KEY, '{non json');
        expect(fasciaDnaEffettiva('X', G, 'u1')).toBe('X');
        expect(() => registraFasciaDna('X', G, 'u1')).not.toThrow();
    });
});
