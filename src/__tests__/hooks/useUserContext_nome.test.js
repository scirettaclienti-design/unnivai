import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// TESTI 8 — il nome del saluto: iniziale maiuscola. VERITÀ-PRE-GIRO 2 (decisione di Ivano): se il profilo non ha un nome
// non se ne inventa uno dalla mail («mario.bianchi@…» non è «Mario»): firstName è null e il saluto è «Ciao!».
// Mock SOLO di infrastruttura.
let utente = null;
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false, isFetching: false }) }));
vi.mock('@/services/userContextService', () => ({ userContextService: { getUserContext: vi.fn() } }));
vi.mock('../../services/userContextService', () => ({ userContextService: { getUserContext: vi.fn() } }));
vi.mock('../../hooks/useEnhancedGeolocation', () => ({ useEnhancedGeolocation: () => ({ location: null, loading: false }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: utente }) }));
vi.mock('../../context/CityContext', () => ({ useCity: () => ({ city: 'Roma', isManual: true }) }));

const { useUserContext } = await import('../../hooks/useUserContext');
const nome = (user) => { utente = user; return renderHook(() => useUserContext()).result.current.firstName; };

describe('TESTI 8 — il nome del saluto', () => {
    it('dal profilo: «ivano» → «Ivano»', () => {
        expect(nome({ user_metadata: { first_name: 'ivano' }, email: 'a@b.it' })).toBe('Ivano');
        expect(nome({ user_metadata: { full_name: 'anna maria rossi' }, email: 'a@b.it' })).toBe('Anna');
    });
    it('VERITÀ 2 — senza nome nel profilo il nome NON viene dalla mail', () => {
        expect(nome({ user_metadata: {}, email: 'ivano@dovevai.it' })).toBeNull();
        expect(nome({ user_metadata: {}, email: 'ivano.rossi85@dovevai.it' })).toBeNull();
        expect(nome({ user_metadata: {}, email: 'mario.bianchi@esempio.it' })).toBeNull();
        expect(nome({ user_metadata: { full_name: '   ' }, email: 'mario+prova@dovevai.it' })).toBeNull();
        expect(nome({ email: 'solo@mail.it' })).toBeNull();
    });
    it('senza utente: Ospite', () => {
        expect(nome(null)).toBe('Ospite');
    });
});
