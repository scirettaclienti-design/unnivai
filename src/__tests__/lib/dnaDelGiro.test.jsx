// DNA-RIQUADRO — «Il tuo DNA esplorativo» mostra solo dati veri: cosa del DNA e della richiesta ha guidato QUEL giro. Mai trattini.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { righeDnaDelGiro } from '@/lib/dnaDelGiro';
import DnaDelGiro from '@/components/DnaDelGiro';
import { QuickPathSummary } from '@/components/Map/QuickPathSummary';

vi.mock('@/components/SalvaGiro', () => ({ default: () => null }));

const stop = (nome, types, extra = {}) => ({ title: nome, types, latitude: 37.5, longitude: 15.08, stayMinutes: 30, ...extra });
const GIRO = [
    stop('Trattoria L’imperiale', ['restaurant', 'food']),
    stop('Basilica Cattedrale', ['church', 'place_of_worship', 'tourist_attraction']),
    stop('Villa Bellini', ['park']),
    { tempoLibero: true, title: 'Tempo libero', types: [] },
];
const PESI_PIENI = { food: 0.4, cultura: 0.3, natura: 0.12, nightlife: 0, avventura: 0, shopping: 0, relax: 0, arte: 0 };

describe('righeDnaDelGiro', () => {
    it('DNA pieno: le categorie forti che il giro ha davvero, con la stessa percentuale del Profilo', () => {
        const r = righeDnaDelGiro({ pesi: PESI_PIENI, fiducia: 0.3, tappe: GIRO });
        expect(r).toEqual(['Più cibo: è il tuo 40%.', 'Più cultura: è il tuo 30%.', 'Più natura: è il tuo 12%.']);
    });
    it('DNA vuoto (fiducia 0 o pesi a zero): nessuna riga, niente trattini', () => {
        expect(righeDnaDelGiro({ pesi: PESI_PIENI, fiducia: 0, tappe: GIRO })).toEqual([]);
        expect(righeDnaDelGiro({ pesi: { food: 0, cultura: 0 }, fiducia: 0.3, tappe: GIRO })).toEqual([]);
        expect(righeDnaDelGiro({})).toEqual([]);
    });
    it('una categoria forte che il giro non ha non si nomina', () => {
        const solo = [stop('Trattoria', ['restaurant', 'food'])];
        expect(righeDnaDelGiro({ pesi: PESI_PIENI, fiducia: 0.3, tappe: solo })).toEqual(['Più cibo: è il tuo 40%.']);
    });
    it('richiesta esplicita: «Hai chiesto storia» prima del DNA, senza ripetere la stessa categoria', () => {
        const r = righeDnaDelGiro({ pesi: PESI_PIENI, fiducia: 0.3, richiesta: ['cultura'], tappe: GIRO });
        expect(r[0]).toBe('Hai chiesto cultura.');
        expect(r).toContain('Più cibo: è il tuo 40%.');
        expect(r.join(' ')).not.toMatch(/Più cultura/);
    });
    it('scelta del Quiz o di Sorprendimi: «Hai scelto …»', () => {
        expect(righeDnaDelGiro({ scelte: ['Natura', 'Parchi e Verde'] })).toEqual(['Hai scelto natura · parchi e verde.']);
    });
    it('al massimo 3 righe, e mai un trattino o un valore vuoto', () => {
        const r = righeDnaDelGiro({ pesi: PESI_PIENI, fiducia: 0.3, scelte: ['Storia'], richiesta: ['food', 'natura', 'arte'], tappe: GIRO });
        expect(r.length).toBeLessThanOrEqual(3);
        for (const riga of r) { expect(riga).not.toMatch(/—|-{2,}|undefined|null|NaN/); expect(riga.trim().length).toBeGreaterThan(8); }
    });
    it('una richiesta con categorie sconosciute non lascia righe vuote', () => {
        expect(righeDnaDelGiro({ richiesta: ['boh', undefined, ''] })).toEqual([]);
    });
});

describe('il riquadro', () => {
    it('senza righe non compare', () => {
        const { container } = render(<DnaDelGiro righe={[]} />);
        expect(container.firstChild).toBeNull();
    });
    it('con righe: titolo e una voce per riga', () => {
        render(<DnaDelGiro righe={['Hai chiesto storia.', 'Più cibo: è il tuo 40%.']} />);
        expect(screen.getByText('Il tuo DNA esplorativo')).toBeInTheDocument();
        expect(screen.getAllByTestId('dna-del-giro')).toHaveLength(1);
        expect(document.querySelectorAll('[data-dna-riga]')).toHaveLength(2);
        cleanup();
    });
});

describe('le 4 sorgenti: nessun trattino nel riquadro', () => {
    const tourData = { title: 'Giro', city: 'Catania', steps: GIRO.map((s, i) => ({ ...s, scheduledTime: `2026-10-25T0${8 + i}:30:00.000Z` })), duration_minutes: 180 };
    const testo = () => document.querySelector('[data-testid="dna-del-giro"]')?.textContent ?? '';
    it('Quiz con DNA pieno e scelta: righe vere', () => {
        render(<QuickPathSummary tourData={tourData} choices={{ mainId: 'cibo', mood: 'Gusto', inspiration: 'Cucina tipica' }} dna={{ pesi: PESI_PIENI, fiducia: 0.3 }} onViewMap={() => {}} onHome={() => {}} />);
        expect(testo()).toContain('Hai scelto gusto · cucina tipica.');
        expect(testo()).toContain('Più cibo: è il tuo 40%.');
        expect(testo()).not.toMatch(/—/);
        cleanup();
    });
    it('Quiz senza DNA e senza scelta confermata: il riquadro non c\'è, e nessun trattino in tutto il riepilogo', () => {
        render(<QuickPathSummary tourData={tourData} choices={{}} onViewMap={() => {}} onHome={() => {}} />);
        expect(document.querySelector('[data-testid="dna-del-giro"]')).toBeNull();
        expect(document.body.textContent).not.toContain('—');
        cleanup();
    });
    it('i quattro punti usano il riquadro, non righe fisse', async () => {
        const fs = await import('node:fs');
        for (const f of ['src/components/Map/QuickPathSummary.jsx', 'src/pages/AiItinerary.jsx', 'src/pages/SurpriseTour.jsx', 'src/pages/TourDetails.jsx']) {
            const s = fs.readFileSync(f, 'utf8');
            expect(s, f).toContain('<DnaDelGiro');
            expect(s, f).toContain('righeDnaDelGiro');
        }
        const sorp = fs.readFileSync('src/pages/SurpriseTour.jsx', 'utf8');
        expect(sorp).not.toContain('<span className="font-bold text-obsidian-primary">Esperienza Unica</span>');
        const quiz = fs.readFileSync('src/components/Map/QuickPathSummary.jsx', 'utf8');
        expect(quiz).not.toMatch(/choices\?\.\w+ \|\| '—'/);
    });
});
