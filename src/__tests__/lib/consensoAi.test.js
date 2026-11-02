// ACCOUNT-PRIVACY — il consenso ai servizi AI di terzi: dove si ricorda, quando c'è, cosa fa il cancello. Il modulo VERO
// (nei test degli altri il consenso c'è già: src/test/setup.js lo mocka).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sessione = { user: null };
const updateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: sessione.user ? { user: sessione.user } : null } }), updateUser: (...a) => updateUser(...a) } } }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: sessione.user ? { user: sessione.user } : null } }), updateUser: (...a) => updateUser(...a) } } }));

let c;
beforeEach(async () => {
    localStorage.clear();
    sessione.user = null;
    updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
    c = await vi.importActual('../../lib/consensoAi.js');
});

const ANNA = { id: 'u-anna', user_metadata: {} };
const BRUNO = { id: 'u-bruno', user_metadata: {} };

describe('haConsensoAi', () => {
    it('all\'inizio non c\'è, né per un utente né per il telefono', () => {
        expect(c.haConsensoAi(null)).toBe(false);
        expect(c.haConsensoAi(ANNA)).toBe(false);
    });
    it('quello dell\'account (user_metadata) vale su qualsiasi telefono', () => {
        expect(c.haConsensoAi({ id: 'x', user_metadata: { consenso_ai: { v: 1, at: '2026-11-03' } } })).toBe(true);
    });
    it('una versione più vecchia dell\'elenco dei servizi non vale', () => {
        expect(c.haConsensoAi({ id: 'x', user_metadata: { consenso_ai: { v: 0 } } })).toBe(false);
    });
});

describe('daiConsensoAi', () => {
    it('utente dentro: si ricorda sul telefono legato al suo id e sull\'account, e non vale per un altro utente', async () => {
        await c.daiConsensoAi(ANNA);
        expect(c.haConsensoAi(ANNA)).toBe(true);
        expect(c.haConsensoAi(BRUNO)).toBe(false);
        expect(c.haConsensoAi(null)).toBe(false);
        expect(updateUser).toHaveBeenCalledWith({ data: { consenso_ai: expect.objectContaining({ v: c.VERSIONE_CONSENSO, at: expect.any(String) }) } });
    });
    it('senza utente: vale per il telefono, e non scrive su nessun account', async () => {
        await c.daiConsensoAi(null);
        expect(c.haConsensoAi(null)).toBe(true);
        expect(c.haConsensoAi(ANNA)).toBe(false);
        expect(updateUser).not.toHaveBeenCalled();
    });
    it('se la rete dell\'account non c\'è, il consenso resta registrato sul telefono', async () => {
        updateUser.mockRejectedValue(new Error('rete'));
        await c.daiConsensoAi(ANNA);
        expect(c.haConsensoAi(ANNA)).toBe(true);
    });
});

describe('il cancello', () => {
    it('assicuraConsensoAi: senza consenso risponde false e chiede alla schermata di aprirsi', async () => {
        sessione.user = ANNA;
        const aperta = vi.fn();
        window.addEventListener(c.EVENTO_CONSENSO_AI, aperta);
        expect(await c.assicuraConsensoAi()).toBe(false);
        expect(aperta).toHaveBeenCalledTimes(1);
        window.removeEventListener(c.EVENTO_CONSENSO_AI, aperta);
    });
    it('con il consenso risponde true e non apre niente', async () => {
        sessione.user = ANNA;
        await c.daiConsensoAi(ANNA);
        const aperta = vi.fn();
        window.addEventListener(c.EVENTO_CONSENSO_AI, aperta);
        expect(await c.assicuraConsensoAi()).toBe(true);
        expect(aperta).not.toHaveBeenCalled();
        window.removeEventListener(c.EVENTO_CONSENSO_AI, aperta);
    });
    it('consensoAiDato risponde senza aprire niente (richieste di sfondo)', async () => {
        sessione.user = ANNA;
        const aperta = vi.fn();
        window.addEventListener(c.EVENTO_CONSENSO_AI, aperta);
        expect(await c.consensoAiDato()).toBe(false);
        expect(aperta).not.toHaveBeenCalled();
        window.removeEventListener(c.EVENTO_CONSENSO_AI, aperta);
    });
    it('richiediConsensoAi lancia ConsensoAiError col testo onesto, che la UI tratta come guasto del motore', async () => {
        const { CONSENSO_AI } = await import('../../lib/testiAccount.js');
        const { isAiEngineError } = await import('../../lib/aiEngineError.js');
        await expect(c.richiediConsensoAi()).rejects.toMatchObject({ consenso: true, userMessage: CONSENSO_AI.SENZA });
        const err = await c.richiediConsensoAi().catch((e) => e);
        expect(c.isConsensoAiError(err)).toBe(true);
        expect(isAiEngineError(err)).toBe(true);
    });
    it('localStorage rotto: non esplode, il consenso c\'è solo se è sull\'account', async () => {
        const orig = Storage.prototype.getItem;
        Storage.prototype.getItem = () => { throw new Error('storage ko'); };
        try {
            expect(c.haConsensoAi(ANNA)).toBe(false);
            expect(c.haConsensoAi({ id: 'x', user_metadata: { consenso_ai: { v: 1 } } })).toBe(true);
        } finally { Storage.prototype.getItem = orig; }
    });
});
