// APP-NATIVA — la scheda del giro demo nella home e il tasto «Simula il cammino»: solo per l'account demo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({ utente: null }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: h.utente }) }));

const CardGiroDemo = (await import('../../components/CardGiroDemo')).default;
const SimulaCammino = (await import('../../components/Nav/SimulaCammino')).default;
const { creaCamminoSimulato } = await import('../../lib/camminoSimulato');
const { GIRO_DEMO } = await import('../../data/giroDemo');

const Mappa = () => { const l = useLocation(); return <div data-testid="mappa">{l.state?.tourData?.id}</div>; };
const monta = () => render(
    <MemoryRouter initialEntries={['/home']}>
        <Routes>
            <Route path="/home" element={<CardGiroDemo />} />
            <Route path="/map" element={<Mappa />} />
        </Routes>
    </MemoryRouter>,
);

beforeEach(() => { h.utente = null; });

describe('CardGiroDemo', () => {
    it('account demo: la scheda c\'è e apre la mappa col giro demo', () => {
        h.utente = { id: 'd', app_metadata: { unnivai_demo_revisore: true } };
        monta();
        expect(screen.getByText('Giro di prova per la revisione')).toBeTruthy();
        fireEvent.click(screen.getByTestId('card-giro-demo'));
        expect(screen.getByTestId('mappa').textContent).toBe(GIRO_DEMO.id);
    });
    it('ogni altro utente (anche con il flag nei propri user_metadata) e chi non è entrato: niente', () => {
        for (const u of [null, { id: 'a' }, { id: 'b', user_metadata: { unnivai_demo_revisore: true } }, { id: 'c', is_anonymous: true, app_metadata: { unnivai_demo_revisore: true } }]) {
            h.utente = u;
            const { unmount } = monta();
            expect(screen.queryByTestId('card-giro-demo')).toBeNull();
            unmount();
        }
    });
    it('la home la monta (DashboardUser)', () => {
        const src = readFileSync('src/pages/DashboardUser.jsx', 'utf8');
        expect(src).toContain('<CardGiroDemo />');
    });
});

describe('SimulaCammino', () => {
    it('parte, si ferma, riparte', () => {
        vi.useFakeTimers();
        const c = creaCamminoSimulato({ percorso: GIRO_DEMO.percorsoDemo, tappe: GIRO_DEMO.steps });
        c.watchPosition(() => {});
        render(<SimulaCammino cammino={c} />);
        const tasto = () => screen.getByTestId('simula-cammino');
        expect(tasto().textContent).toContain('Simula il cammino');
        fireEvent.click(tasto());
        expect(c.stato()).toBe('cammina');
        expect(tasto().textContent).toContain('Ferma il cammino');
        fireEvent.click(tasto());
        expect(c.stato()).toBe('fermo');
        act(() => { c.avvia(); });
        expect(tasto().textContent).toContain('Ferma il cammino');
        c.chiudi();
        vi.useRealTimers();
    });
});
