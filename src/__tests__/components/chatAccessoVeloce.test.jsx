// CHAT-ACCESSO-VELOCE — la scheda della tappa ha «Chiedi alla guida» (sopra «Riparti», mai al suo posto) e la chat, aperta su un luogo
// prima di scrivere, nomina quel luogo nel benvenuto; dopo il primo messaggio la conversazione non si azzera.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchedaTappa } from '@/components/Nav/GuidaSchede';
import { AIDrawer, BENVENUTO_CHAT } from '@/components/Map/AIDrawer';
import { NAV_TESTI } from '@/lib/navMessaggi';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/chatGuidaService', () => ({ chiediAllaGuida: vi.fn(async () => ({ testo: 'Risposta.', fonti: [], esito: 'verificata' })) }));
afterEach(() => cleanup());

describe('SchedaTappa — «Chiedi alla guida»', () => {
    it('senza onChiedi il tasto non c\'è (come prima)', () => {
        render(<SchedaTappa numero={1} nome="Teatro" onChiudi={() => {}} onRiparti={() => {}} />);
        expect(screen.queryByTestId('chiedi-guida-scheda')).toBeNull();
    });
    it('con onChiedi: testo approvato, etichetta con il nome, sta prima di «Riparti» e «Riparti» resta', () => {
        const onChiedi = vi.fn();
        const onRiparti = vi.fn();
        render(<SchedaTappa numero={1} nome="Teatro Massimo Bellini" nomeProssima="Via Crociferi" minutiAllaProssima={4} onChiudi={() => {}} onRiparti={onRiparti} onChiedi={onChiedi} />);
        const tasto = screen.getByTestId('chiedi-guida-scheda');
        expect(tasto.textContent).toBe(NAV_TESTI.CHIEDI_GUIDA);
        expect(tasto.getAttribute('aria-label')).toBe('Chiedi alla guida di Teatro Massimo Bellini');
        const riparti = screen.getByText(/^Riparti · 4 min/).closest('button');
        expect(tasto.compareDocumentPosition(riparti) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(tasto.className).toContain('min-h-[44px]');
        fireEvent.click(tasto);
        expect(onChiedi).toHaveBeenCalledTimes(1);
        expect(onRiparti).not.toHaveBeenCalled();
    });
});

describe('AIDrawer — il benvenuto segue il luogo aperto', () => {
    it('aperta dalla scheda di una tappa dopo il giro: il benvenuto nomina la tappa', () => {
        const props = { isOpen: true, onClose: () => {}, activeCity: 'Catania' };
        const { rerender } = render(<AIDrawer {...props} selectedPOI={null} />);
        expect(screen.getByText(BENVENUTO_CHAT(null))).toBeInTheDocument();
        rerender(<AIDrawer {...props} selectedPOI={{ name: 'Teatro Massimo Bellini' }} />);
        expect(screen.getByText(BENVENUTO_CHAT('Teatro Massimo Bellini'))).toBeInTheDocument();
        expect(screen.queryByText(BENVENUTO_CHAT(null))).toBeNull();
    });
    it('dopo una domanda la conversazione resta anche se il luogo cambia', async () => {
        const props = { isOpen: true, onClose: () => {}, activeCity: 'Catania' };
        const { rerender } = render(<AIDrawer {...props} selectedPOI={null} />);
        fireEvent.change(screen.getByPlaceholderText('Scrivi qui...'), { target: { value: 'Ho fame' } });
        fireEvent.keyDown(screen.getByPlaceholderText('Scrivi qui...'), { key: 'Enter' });
        await screen.findByText('Risposta.');
        rerender(<AIDrawer {...props} selectedPOI={{ name: 'Teatro Massimo Bellini' }} />);
        expect(screen.getByText('Ho fame')).toBeInTheDocument();
        expect(screen.getByText('Risposta.')).toBeInTheDocument();
    });
});
