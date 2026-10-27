/**
 * VOCE-1 — il selettore della voce (Marin / Cedar) nella barra di navigazione: compare solo a voce accesa, segna quella scelta,
 * il tocco la cambia; con la voce spenta (Muto) non c'è.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavigationHUD from '@/components/Map/NavigationHUD';

const TAPPA = { id: 's2', name: 'Via Crociferi', latitude: 37.505, longitude: 15.085 };
const ROUTE = [{ id: 's1', name: 'Fontana', latitude: 37.5027, longitude: 15.0871 }, TAPPA];
const barra = (props = {}) => render(
    <NavigationHUD routeStats={null} activeRoute={ROUTE} completedSteps={['s1']} skippedSteps={[]} nextStop={TAPPA}
        onArrived={() => {}} onSkip={() => {}} onToggleVoice={() => {}} onEndNavigation={() => {}} {...props} />,
);

const apriImpostazioni = () => fireEvent.click(screen.getByTestId('nav-impostazioni'));

describe('selettore della voce nelle impostazioni del giro', () => {
    it('a voce accesa mostra Marin e Cedar, e segna la voce scelta', () => {
        barra({ voiceEnabled: true, voceId: 'cedar', onCambiaVoce: () => {} });
        expect(screen.queryByTestId('voce-selettore')).toBeNull(); // non sta nella scheda
        apriImpostazioni();
        expect(screen.getByTestId('voce-selettore')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Cedar' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Marin' })).toHaveAttribute('aria-checked', 'false');
    });
    it('il tocco cambia la voce', () => {
        const onCambiaVoce = vi.fn();
        barra({ voiceEnabled: true, voceId: 'marin', onCambiaVoce });
        apriImpostazioni();
        fireEvent.click(screen.getByRole('radio', { name: 'Cedar' }));
        expect(onCambiaVoce).toHaveBeenCalledWith('cedar');
    });
    it('senza il tasto delle impostazioni non c\'è il selettore', () => {
        barra({ voiceEnabled: false, voceId: 'marin' });
        expect(screen.queryByTestId('nav-impostazioni')).toBeNull();
    });
    it('i tasti sono grandi almeno 44 px (classe min-h-[44px])', () => {
        barra({ voiceEnabled: true, voceId: 'marin', onCambiaVoce: () => {} });
        apriImpostazioni();
        for (const r of screen.getAllByRole('radio')) expect(r.className).toContain('min-h-[44px]');
    });
});
