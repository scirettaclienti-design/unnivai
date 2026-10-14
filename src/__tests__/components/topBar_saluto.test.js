import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// TESTI 8 — il saluto in home: «Ciao, Ivano!», non «Ciao, ivano!» (il nome può arrivare dalla mail, minuscolo).
vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return { Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children), useNavigate: () => vi.fn() };
});
vi.mock('@/components/NotificationBell', () => ({ default: () => null }));
vi.mock('@/context/CityContext', () => ({ useCity: () => ({ city: 'Roma', setCity: vi.fn(), isManual: false }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
let nome = 'ivano';
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ userId: 'u1', city: 'Roma', firstName: nome, isLoading: false, needsCityChoice: false }),
}));

const { createElement } = await import('react');
const TopBar = (await import('@/components/TopBar')).default;

describe('TESTI 8 — il saluto', () => {
    it('«Ciao, Ivano!» con l\'iniziale maiuscola', () => {
        render(createElement(TopBar));
        expect(screen.getByText('Ciao, Ivano!')).toBeInTheDocument();
        expect(screen.queryByText('Ciao, ivano!')).toBeNull();
    });
    it('VERITÀ 2 — senza nome nel profilo il saluto è «Ciao!», senza nome e senza virgola', () => {
        for (const senza of [null, undefined, '', '   ']) {
            nome = senza;
            const { container, unmount } = render(createElement(TopBar));
            const h1 = container.querySelector('h1');
            expect(h1.textContent).toBe('Ciao!');
            unmount();
        }
        nome = 'ivano';
    });
});
