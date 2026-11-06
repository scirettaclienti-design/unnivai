// BRAND-UNNIVAI — nell'app iOS (Capacitor nativo) niente «Prossimamente»; sul web restano.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';

const nativo = { v: false };
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => nativo.v } }));

const BottomNavigation = (await import('../../components/BottomNavigation')).default;
const V1LockedGuard = (await import('../../components/V1LockedGuard')).default;
const SoloWeb = (await import('../../components/SoloWeb')).default;

const Dove = () => { const l = useLocation(); return <div data-testid="dove">{l.pathname}</div>; };
const monta = (el, path = '/x') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/x" element={el} />
            <Route path="*" element={<Dove />} />
        </Routes>
    </MemoryRouter>,
);

beforeEach(() => { nativo.v = false; });

describe('App nativa: niente Prossimamente', () => {
    it('web: la barra ha la voce Foto e le rotte guida portano a /prossimamente', () => {
        monta(<BottomNavigation />);
        expect(screen.getByText('Foto')).toBeTruthy();
    });
    it('web: V1LockedGuard porta a /prossimamente/guide, SoloWeb mostra la pagina', () => {
        monta(<V1LockedGuard kind="guide" />);
        expect(screen.getByTestId('dove').textContent).toBe('/prossimamente/guide');
    });
    it('web: SoloWeb mostra i figli', () => {
        monta(<SoloWeb><div>pagina in arrivo</div></SoloWeb>);
        expect(screen.getByText('pagina in arrivo')).toBeTruthy();
    });
    it('nativo: la barra non ha Foto', () => {
        nativo.v = true;
        monta(<BottomNavigation />);
        expect(screen.queryByText('Foto')).toBeNull();
        expect(screen.getByText('Profilo')).toBeTruthy();
    });
    it('nativo: V1LockedGuard rimanda alla home, non a /prossimamente', () => {
        nativo.v = true;
        monta(<V1LockedGuard kind="attivita" />);
        expect(screen.getByTestId('dove').textContent).toBe('/');
    });
    it('nativo: SoloWeb rimanda alla home senza mostrare la pagina', () => {
        nativo.v = true;
        monta(<SoloWeb><div>pagina in arrivo</div></SoloWeb>);
        expect(screen.queryByText('pagina in arrivo')).toBeNull();
        expect(screen.getByTestId('dove').textContent).toBe('/');
    });
    it('i link a /prossimamente e /photos sono dietro isAppNativa e le rotte sono in SoloWeb', () => {
        const leggi = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
        const landing = leggi('../../pages/Landing.jsx');
        expect(landing).toMatch(/isAppNativa\(\) && \(\s*<Link to="\/prossimamente\/guide"/);
        const dash = leggi('../../pages/DashboardUser.jsx');
        expect(dash).toMatch(/isAppNativa\(\) && \(\s*<>[\s\S]*?<Link to="\/prossimamente\/guide"/);
        // PROFILO-SEZIONI: il Profilo non porta piu' a nessuna pagina «in costruzione», nemmeno sul web
        const profilo = leggi('../../pages/Profile.jsx');
        expect(profilo).not.toContain('/photos');
        expect(profilo).not.toContain('/prossimamente');
        const app = leggi('../../App.jsx');
        for (const k of ['guide', 'attivita', 'foto']) expect(app).toContain(`<SoloWeb><Prossimamente kind="${k}" /></SoloWeb>`);
        expect(app).toContain('<SoloWeb><Photos /></SoloWeb>');
        expect(app).toContain('<SoloWeb><Trending /></SoloWeb>');
    });
});
