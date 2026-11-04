// BANCO-DIFETTI-2 (T23) — DNA-5: con «famiglia con bambini» il giro cammina meno del giro neutro.
// La regola (giroDna.giroDnaPerMotore): tappe per momento come il ritmo Tranquillo, visite almeno ×1,2, la merenda come pausa, in Per Te
// 3 tappe per tour; un ritmo scelto nella richiesta vince. La prova A/B/C sul giro vero di Roma: scripts/prova-dna5 (report T23).
import { describe, it, expect } from 'vitest';
import { giroDnaPerMotore, FATTORE_SOSTA_FAMIGLIA, tracciatoGiroDna } from '@/lib/giroDna';
import { buildDaySkeleton } from '@/lib/daySkeleton';
import { TAPPE_PER_TE } from '@/lib/dnaRitmo';
import { stayInMoment } from '@/lib/tourTiming';

const FAMIGLIA = { valore: 'famiglia', fonte: 'profilo', gruppo: 'Famiglia' };
const MEDIO = { valore: 'medio', fonte: 'giri', fattoreSosta: 1, passo: null, tappePerTe: TAPPE_PER_TE.medio };
const VELOCE = { valore: 'veloce', fonte: 'giri', fattoreSosta: 0.7, passo: 'intenso', tappePerTe: TAPPE_PER_TE.veloce };

const finestra = { start: new Date('2026-11-05T09:30:00+01:00'), end: new Date('2026-11-05T22:30:00+01:00') };
const visite = (sk) => sk.days[0].moments.filter(m => ['mattina', 'pomeriggio'].includes(m.key)).reduce((n, m) => n + m.stops, 0);

describe('DNA-5 — la famiglia cammina meno del giro neutro (T23)', () => {
    it('con la famiglia: passo Tranquillo, visite ×1,2, merenda, 3 tappe in Per Te — anche se il DNA ha imparato un ritmo medio o veloce', () => {
        for (const ritmo of [null, MEDIO, VELOCE]) {
            const g = giroDnaPerMotore({ ritmo, compagnia: FAMIGLIA }, {});
            expect(g).toMatchObject({ famiglia: true, passo: 'rilassato', merenda: true, tappePerTe: TAPPE_PER_TE.lento });
            expect(g.fattoreSosta).toBeGreaterThanOrEqual(FATTORE_SOSTA_FAMIGLIA);
            expect(tracciatoGiroDna(g).famiglia).toEqual({ passo: 'rilassato', fattoreSosta: g.fattoreSosta });
        }
        // un fattore appreso piu' alto resta
        expect(giroDnaPerMotore({ ritmo: { ...MEDIO, fattoreSosta: 1.4 }, compagnia: FAMIGLIA }, {}).fattoreSosta).toBe(1.4);
    });

    it('lo scheletro della famiglia ha meno visite di quello neutro e le visite durano di piu\'', () => {
        const neutro = buildDaySkeleton({ window: finestra, pace: '' });
        const g = giroDnaPerMotore({ ritmo: MEDIO, compagnia: FAMIGLIA }, {});
        const famiglia = buildDaySkeleton({ window: finestra, pace: '', group: g.gruppo, ritmoDna: g.passo, fattoreSosta: g.fattoreSosta, sostaPasto: g.sostaPasto });
        expect(visite(famiglia)).toBeLessThan(visite(neutro));
        const museo = { types: ['museum'] };
        const mattina = famiglia.days[0].moments.find(m => m.key === 'mattina');
        expect(stayInMoment(museo, mattina)).toBeGreaterThan(stayInMoment(museo, null));
    });

    it('un ritmo scelto nella richiesta vince sulla regola; senza famiglia niente cambia', () => {
        const chiesto = giroDnaPerMotore({ ritmo: MEDIO, compagnia: FAMIGLIA }, { pace: 'Intenso' });
        expect(chiesto).toMatchObject({ famiglia: false, passo: null });
        expect(chiesto.fattoreSosta).toBeNull();
        const coppia = giroDnaPerMotore({ ritmo: MEDIO, compagnia: { valore: 'coppia', fonte: 'profilo', gruppo: 'Coppia' } }, {});
        expect(coppia).toMatchObject({ famiglia: false, passo: null, tappePerTe: TAPPE_PER_TE.medio });
        expect(giroDnaPerMotore(null, {})).toMatchObject({ attivo: false, famiglia: false });
    });
});
