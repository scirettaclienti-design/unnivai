// GIRO-EDIT — i due tasti piccoli di ogni tappa: «Togli» e «Cambia» (con il suo campo). Nella scheda reale (TourStopsByMoment).
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TappaModifica } from '@/components/TappaModifica';
import { TourStopsByMoment } from '@/components/TourStopsByMoment';

describe('TappaModifica', () => {
    it('«Togli» chiama onTogli; senza puoTogliere (ultima tappa) il tasto non c\'è', () => {
        const onTogli = vi.fn();
        const { rerender } = render(<TappaModifica nome="Museo" onTogli={onTogli} onCambia={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /togli museo/i }));
        expect(onTogli).toHaveBeenCalledTimes(1);
        rerender(<TappaModifica nome="Museo" puoTogliere={false} onTogli={onTogli} onCambia={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /togli/i })).toBeNull();
    });

    it('«Cambia» apre un campo; il testo scritto arriva a onCambia; con successo il campo si chiude', async () => {
        const onCambia = vi.fn().mockResolvedValue({ ok: true });
        render(<TappaModifica nome="Museo" onTogli={vi.fn()} onCambia={onCambia} />);
        expect(document.querySelector('[data-cambia-input]')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /cambia museo/i }));
        const campo = document.querySelector('[data-cambia-input]');
        expect(campo).not.toBeNull();
        fireEvent.change(campo, { target: { value: 'un posto di street food' } });
        fireEvent.click(screen.getByRole('button', { name: /cerca/i }));
        await waitFor(() => expect(onCambia).toHaveBeenCalledWith('un posto di street food'));
        await waitFor(() => expect(document.querySelector('[data-cambia-input]')).toBeNull());
    });

    it('senza risultato: una riga di spiegazione, il campo resta, la tappa non si tocca', async () => {
        const onCambia = vi.fn().mockResolvedValue({ ok: false, messaggio: 'Non ho trovato niente di adatto qui vicino: la tappa resta.' });
        render(<TappaModifica nome="Museo" onTogli={vi.fn()} onCambia={onCambia} />);
        fireEvent.click(screen.getByRole('button', { name: /cambia museo/i }));
        fireEvent.click(screen.getByRole('button', { name: /cerca/i }));
        await waitFor(() => expect(document.querySelector('[data-cambia-messaggio]')?.textContent).toMatch(/la tappa resta/));
        expect(document.querySelector('[data-cambia-input]')).not.toBeNull();
    });
});

describe('TourStopsByMoment con modifica', () => {
    const stops = [
        { title: 'Caffè Etna', place_id: 'a', moment: 'mattina', scheduledTime: '2026-10-27T08:00:00+01:00', types: ['cafe'] },
        { title: 'Museo Civico', place_id: 'b', moment: 'mattina', scheduledTime: '2026-10-27T09:30:00+01:00', types: ['museum'] },
    ];
    it('ogni tappa vera ha i suoi due tasti e passa la tappa giusta', () => {
        const modifica = { onTogli: vi.fn(), onCambia: vi.fn() };
        render(<TourStopsByMoment stops={stops} modifica={modifica} />);
        expect(document.querySelectorAll('[data-tappa-togli]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-tappa-cambia]')).toHaveLength(2);
        fireEvent.click(document.querySelectorAll('[data-tappa-togli]')[1]);
        expect(modifica.onTogli).toHaveBeenCalledWith(stops[1]);
    });
    it('con una tappa sola il «Togli» non c\'è; senza `modifica` nessun tasto', () => {
        render(<TourStopsByMoment stops={[stops[0]]} modifica={{ onTogli: vi.fn(), onCambia: vi.fn() }} />);
        expect(document.querySelector('[data-tappa-togli]')).toBeNull();
        expect(document.querySelector('[data-tappa-cambia]')).not.toBeNull();
    });
    it('senza `modifica` la scheda è quella di prima', () => {
        render(<TourStopsByMoment stops={stops} />);
        expect(document.querySelector('[data-tappa-modifica]')).toBeNull();
    });
});
