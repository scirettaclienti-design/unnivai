// GIRI-SALVATI — dopo «Togli» il giro è un altro: il tasto torna «Salva il giro» e lo si può salvare di nuovo.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const salva = vi.fn(async () => ({ ok: true, giaSalvato: false }));
vi.mock('../../lib/giriSalvati', async () => ({ ...(await vi.importActual('../../lib/giriSalvati')), salvaGiro: (...a) => salva(...a) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SalvaGiro from '../../components/SalvaGiro';

const tappa = (n, ora) => ({ title: `Tappa ${n}`, latitude: 37.5 + n / 100, longitude: 15.08, scheduledTime: `2026-10-25T${ora}:00.000Z`, stayMinutes: 30, moment: 'mattina' });
const GIRO3 = { title: 'Giro', city: 'Catania', steps: [tappa(1, '08:30'), tappa(2, '09:10'), tappa(3, '09:50')] };
const GIRO2 = { title: 'Giro', city: 'Catania', steps: [tappa(1, '08:30'), tappa(3, '09:10')] };

describe('SalvaGiro dopo Togli', () => {
    it('salvato il giro intero, «Togli» lo cambia: il tasto è di nuovo «Salva il giro» e salva il giro nuovo', async () => {
        const { rerender } = render(<SalvaGiro tour={GIRO3} sorgente="crea" />);
        fireEvent.click(screen.getByTestId('salva-giro'));
        await waitFor(() => expect(screen.getByTestId('salva-giro').textContent).toContain('Salvato'));
        rerender(<SalvaGiro tour={GIRO2} sorgente="crea" />);
        expect(screen.getByTestId('salva-giro').textContent).toContain('Salva il giro');
        fireEvent.click(screen.getByTestId('salva-giro'));
        await waitFor(() => expect(salva).toHaveBeenCalledTimes(2));
        expect(salva.mock.calls[1][1].steps).toHaveLength(2);
        await waitFor(() => expect(screen.getByTestId('salva-giro').textContent).toContain('Salvato'));
    });
    it('lo stesso giro resta «Salvato» (nessun ri-salvataggio per un rirender)', async () => {
        salva.mockClear();
        const { rerender } = render(<SalvaGiro tour={GIRO3} sorgente="crea" />);
        fireEvent.click(screen.getByTestId('salva-giro'));
        await waitFor(() => expect(screen.getByTestId('salva-giro').textContent).toContain('Salvato'));
        rerender(<SalvaGiro tour={{ ...GIRO3 }} sorgente="crea" />);
        expect(screen.getByTestId('salva-giro').textContent).toContain('Salvato');
    });
});
