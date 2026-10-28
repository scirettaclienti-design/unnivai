// «Salta» fino in fondo: la fine giro dice dove sei arrivato e non cattura i tocchi ripetuti. 0 $.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { FineGiro } from '@/components/Nav/GuidaSchede';
import { NAV_TESTI } from '@/lib/navMessaggi';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const base = { data: '28 ottobre', citta: 'Catania', tappe: [], numeri: { km: null, tappe: 0, ore: '1 min' }, imparato: null, onMete: vi.fn(), onCondividi: vi.fn(), onChiudi: vi.fn() };

describe('FineGiro dopo tutti i «Salta»', () => {
    it('mostra la nota con le tappe davvero raggiunte', () => {
        render(<FineGiro {...base} nota={NAV_TESTI.FINE_FIN_DOVE(0, 12)} />);
        expect(screen.getByTestId('fine-nota').textContent).toBe('Hai saltato tutte le tappe: il giro finisce qui.');
        expect(screen.getByTestId('fine-numeri').textContent).toContain('0');
    });
    it('senza saltate non c\'e\' nessuna nota', () => {
        render(<FineGiro {...base} nota={null} />);
        expect(screen.queryByTestId('fine-nota')).toBeNull();
    });
    it('per mezzo secondo non risponde ai tocchi (un tocco di troppo su «Salta» non finisce su «Nelle tue Mete»)', () => {
        vi.useFakeTimers();
        render(<FineGiro {...base} />);
        expect(screen.getByTestId('fine-giro').style.pointerEvents).toBe('none');
        act(() => { vi.advanceTimersByTime(700); });
        expect(screen.getByTestId('fine-giro').style.pointerEvents).toBe('');
    });
});
