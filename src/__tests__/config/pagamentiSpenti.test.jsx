// PAGAMENTI-SPENTI — in V1 nessuna pagina mostra prezzi o checkout.
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import React from 'react';
import { render } from '@testing-library/react';

const SRC = resolve(__dirname, '..', '..');

function file(dir, out = []) {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) {
            if (nome === '__tests__') continue;
            file(p, out);
        } else if (/\.(jsx?|tsx?)$/.test(nome)) out.push(p);
    }
    return out;
}

describe('interruttore unico dei pagamenti', () => {
    it('è spento di default', async () => {
        const m = await import('../../config/pagamenti');
        expect(m.PAGAMENTI_ATTIVI).toBe(false);
        expect(m.pagamentiVisibili()).toBe(false);
        expect(m.prezzoDaMostrare(25)).toBeNull();
    });

    it('anche acceso, nell\'app nativa resta spento (Apple)', async () => {
        vi.resetModules();
        vi.doMock('../../lib/appNativa', () => ({ isAppNativa: () => true }));
        const m = await import('../../config/pagamenti');
        expect(m.pagamentiVisibili()).toBe(false);
        vi.doUnmock('../../lib/appNativa');
        vi.resetModules();
    });

    it('acceso sul web (V2) i prezzi tornano', async () => {
        vi.resetModules();
        vi.doMock('../../lib/appNativa', () => ({ isAppNativa: () => false }));
        vi.doMock('../../config/pagamenti', async (orig) => {
            const o = await orig();
            return { ...o, PAGAMENTI_ATTIVI: true, pagamentiVisibili: () => true, prezzoDaMostrare: (v) => (Number(v) > 0 ? Number(v) : null) };
        });
        const m = await import('../../config/pagamenti');
        expect(m.prezzoDaMostrare(25)).toBe(25);
        vi.doUnmock('../../config/pagamenti');
        vi.doUnmock('../../lib/appNativa');
        vi.resetModules();
    });
});

describe('nessuna strada verso Stripe senza passare dall\'interruttore', () => {
    const files = file(SRC);

    it('ogni file che chiama create-checkout importa l\'interruttore', () => {
        const chiamanti = files.filter((f) => /functions\/v1\/create-checkout|checkoutUrl/.test(readFileSync(f, 'utf8')));
        expect(chiamanti.length).toBeGreaterThan(0);
        for (const f of chiamanti) {
            expect(readFileSync(f, 'utf8'), relative(SRC, f)).toMatch(/config\/pagamenti/);
        }
    });

    it('nessuna chiave Stripe e nessuna libreria Stripe nel client', () => {
        for (const f of files) {
            const t = readFileSync(f, 'utf8');
            expect(t, relative(SRC, f)).not.toMatch(/VITE_STRIPE|pk_(live|test)_|loadStripe|@stripe\/|js\.stripe\.com/);
        }
        const pkg = readFileSync(resolve(SRC, '..', 'package.json'), 'utf8');
        expect(pkg).not.toMatch(/stripe/i);
    });

    it('la rotta del checkout non esiste fra le rotte dell\'app', () => {
        const app = readFileSync(resolve(SRC, 'App.jsx'), 'utf8');
        expect(app).not.toMatch(/path="[^"]*(checkout|pagamento|payment|booking|prenota|stripe)[^"]*"/i);
    });

    it('prezzi e offerte passano dall\'interruttore nelle pagine V1', () => {
        for (const f of ['pages/TourDetails.jsx', 'pages/MapPage.jsx', 'pages/TourLive.jsx', 'pages/Notifications.jsx', 'pages/DashboardUser.jsx', 'services/dataService.js']) {
            expect(readFileSync(resolve(SRC, f), 'utf8'), f).toMatch(/config\/pagamenti/);
        }
    });
});

describe('finestra di prenotazione', () => {
    it('con i pagamenti spenti non mostra nulla', async () => {
        vi.resetModules();
        vi.doMock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
        vi.doMock('../../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
        const { default: BookingModal } = await import('../../components/BookingSystem');
        const { container } = render(<BookingModal tourId="t" tourTitle="Giro" price={30} guideId="g" onClose={() => {}} />);
        expect(container.textContent).toBe('');
        expect(container.textContent).not.toMatch(/Stripe|Paga|€/);
    });
});
