// BORGO-SCHERMO — lo schermo dice il vero (task BORGO-COMPLETO, fase 3): una sola durata per tutte le schermate, il riquadro del
// Quiz mostra la scelta solo se una tappa e' della sua famiglia, il giro della sera di Per Te non «chiude la giornata».
import { describe, it, expect } from 'vitest';
import { displayedTourMinutes, totalTourMinutes, tourSpanMinutes } from '@/lib/tourTiming';
import { sceltaConfermata, tappaDellaScelta } from '@/lib/quizRiquadro';
import { stopData, composeStop } from '@/lib/stopPhrases';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const t = (hhmm, stay, min = 0) => ({ scheduledTime: `2026-10-15T${hhmm}:00+02:00`, stayMinutes: stay, travelMinutesFromPrev: min, types: ['bar'] });

describe('BORGO-SCHERMO — una sola durata mostrata', () => {
    it('con gli orari vale l\'orologio (attese comprese), senza la somma, senza tappe la durata del motore', () => {
        const conOrari = [t('23:00', 45), t('23:45', 30, 17)];
        expect(displayedTourMinutes(conOrari)).toBe(tourSpanMinutes(conOrari));
        expect(displayedTourMinutes(conOrari)).toBe(75);
        // Crea con 35 minuti di attesa prima del pranzo: 160 di somma, 195 sull'orologio → si mostra 195
        const conAttesa = [t('10:30', 20), t('10:53', 60, 3), t('12:30', 75, 2)];
        expect(totalTourMinutes(conAttesa)).toBe(160);
        expect(displayedTourMinutes(conAttesa)).toBe(195);
        const senzaOrari = [{ stayMinutes: 60, travelMinutesFromPrev: 0 }, { stayMinutes: 30, travelMinutesFromPrev: 18 }];
        expect(displayedTourMinutes(senzaOrari)).toBe(108);
        expect(displayedTourMinutes([], 180)).toBe(180);
        expect(displayedTourMinutes([])).toBeNull();
    });
    it('le schermate usano displayedTourMinutes, nessuna somma ne\' orologio per conto proprio, niente 180 fisso in Sorprendimi', () => {
        const leggi = (f) => readFileSync(path.join(process.cwd(), f), 'utf8');
        for (const f of ['src/pages/DashboardUser.jsx', 'src/pages/Notifications.jsx', 'src/components/Map/QuickPathSummary.jsx', 'src/pages/SurpriseTour.jsx']) {
            const src = leggi(f);
            expect(src, f).toContain('displayedTourMinutes(');
            expect(src, f).not.toMatch(/\btotalTourMinutes\(|\btourSpanMinutes\(/);
        }
        expect(leggi('src/pages/SurpriseTour.jsx')).not.toMatch(/duration_minutes:\s*180/);
        expect(leggi('src/pages/SurpriseTour.jsx')).not.toContain("|| '3h'");
    });
});

describe('BORGO-SCHERMO — il riquadro del Quiz dice il vero', () => {
    const bar = { title: 'Bar Sunshine', types: ['bar', 'point_of_interest'] };
    const via = { title: 'Via Conte Ruggero', types: ['route'] };
    const monte = { title: 'Monte Muganà', types: ['scenic_spot', 'point_of_interest'] };
    const chiesa = { title: 'Chiesa Madre', types: ['church', 'place_of_worship'] };
    it('Natura con un bar e una via: la scelta non si mostra; con Monte Muganà si\'; Storia con una chiesa si\'', () => {
        expect(sceltaConfermata({ main: 'natura', steps: [bar, via] })).toBe(false);
        expect(sceltaConfermata({ main: 'natura', steps: [bar, monte] })).toBe(true);
        expect(sceltaConfermata({ main: 'parchi', steps: [{ ...monte, tempoLibero: true }, bar] })).toBe(false);
        expect(sceltaConfermata({ main: 'storia', steps: [chiesa, bar] })).toBe(true);
        expect(sceltaConfermata({ main: 'storia', steps: [bar, via] })).toBe(false);
        expect(sceltaConfermata({ main: 'cibo', steps: [bar] })).toBe(true);
        expect(sceltaConfermata({ main: 'citta', steps: [via] })).toBe(true);
        expect(sceltaConfermata({ main: 'natura', steps: [] })).toBe(false);
        expect(tappaDellaScelta({ title: 'Spiaggia di Is Arutas', types: ['point_of_interest'] }, 'mare')).toBe(true);
    });
    it('la pagina passa la scelta principale e il riepilogo nasconde mood e ispirazione quando non confermati', () => {
        const qp = readFileSync(path.join(process.cwd(), 'src/pages/QuickPath.jsx'), 'utf8');
        expect(qp).toContain('mainId: selectedOption');
        const qs = readFileSync(path.join(process.cwd(), 'src/components/Map/QuickPathSummary.jsx'), 'utf8');
        expect(qs).toContain('sceltaConfermata({ main: choices?.mainId, steps: tourData.steps })');
        expect(qs).toContain('{sceltaMostrata && (');
    });
});

describe('BORGO-SCHERMO — il giro della sera di Per Te non chiude la giornata', () => {
    it('stopData con giornata: false sull\'ultima tappa di sera non dice «Qui la giornata si chiude»; con giornata: true si\'', () => {
        const stop = { title: 'Piazza Conte Ruggero', types: ['route'], moment: 'dopocena' };
        const base = { stop, momento: 'dopocena', orario: '00:15', minutiDaPrima: 18, primo: false, ultimo: true };
        const sera = composeStop(stopData({ ...base, giornata: true }), { gancio: 'ultima' }).text;
        const perTe = composeStop(stopData({ ...base, giornata: false }), { gancio: 'ultima' }).text;
        expect(sera).toMatch(/giornata si chiude|Chiudi la giornata/);
        expect(perTe).not.toMatch(/giornata si chiude|Chiudi la giornata/);
    });
    it('il motore: _homeDaMotore passa giornata: false e il contesto di composizione lo porta a stopData', () => {
        const src = readFileSync(path.join(process.cwd(), 'src/services/aiRecommendationService.js'), 'utf8');
        expect(src).toContain("{ ...opts, pathType, giornata: false }");
        expect(src).toContain('giornata: opts.giornata !== false');
    });
});
