/**
 * VOCE-1 — la prima frase dell'arrivo e il lettore del racconto parlano con la voce umana (lib/voce), non più con quella del browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const parla = vi.fn(() => Promise.resolve('nuova'));
const fermaVoce = vi.fn();
vi.mock('../../lib/voce', () => ({ parla: (...a) => parla(...a), fermaVoce: () => fermaVoce() }));

import { RitoArrivo, LettoreRacconto } from '@/components/Nav/GuidaSchede';

beforeEach(() => { parla.mockClear(); fermaVoce.mockClear(); });

describe('rito d\'arrivo', () => {
    it('voce accesa: dice la prima frase con la voce scelta', () => {
        render(<RitoArrivo nome="Fontana" frase="Qui il fiume passa sotto la città." parla voce="cedar" onFine={() => {}} />);
        expect(parla).toHaveBeenCalledWith('Qui il fiume passa sotto la città.', { voce: 'cedar' });
    });
    it('voce spenta o in pausa: tace', () => {
        render(<RitoArrivo nome="Fontana" frase="Una frase." parla={false} onFine={() => {}} />);
        expect(parla).not.toHaveBeenCalled();
    });
    it('senza frase non chiama nessuno', () => {
        render(<RitoArrivo nome="Fontana" frase={null} parla voce="marin" onFine={() => {}} />);
        expect(parla).not.toHaveBeenCalled();
    });
});

describe('lettore del racconto', () => {
    it('«Ascolta» legge il racconto con la voce umana; la pausa ferma la voce', async () => {
        parla.mockImplementationOnce(() => new Promise(() => {})); // la voce sta ancora parlando
        render(<LettoreRacconto testo="Un racconto breve della tappa." />);
        await act(async () => { fireEvent.click(screen.getByLabelText('Ascolta il racconto')); });
        expect(parla).toHaveBeenCalledWith('Un racconto breve della tappa.', { titolo: 'Il racconto' });
        await act(async () => { fireEvent.click(screen.getByLabelText('Metti in pausa il racconto')); });
        expect(fermaVoce).toHaveBeenCalled();
    });
});
