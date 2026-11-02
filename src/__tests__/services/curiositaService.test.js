// CURIOSITÀ-QUARTIERI / GEOCODING-LANCIO — il client chiede la curiosità: dove sei, le chiavi già dette, le tappe; via e quartiere li trova il
// server (Google). Nominatim dal telefono solo come riserva, dopo «fonti non disponibili». Mai lancia. 0 $, nessuna rete.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));
import { richiediCuriosita, indirizzoDalTelefono, CAMPI_INDIRIZZO } from '../../services/curiositaService';

const C = { esito: 'passata', testo: 'Via dei Crociferi fu realizzata nel XVIII secolo. Nei suoi 410 metri ci sono quattro chiese.', chiave: 'curiosita-itwiki-443726', luogo: 'Via dei Crociferi', tipo: 'via', fonte: { titolo: 'Via dei Crociferi', url: 'u' } };
let corpi;
beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    corpi = [];
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const rete = ({ nominatim = { address: { road: 'Via Crociferi', neighbourhood: 'Giudecca', suburb: 'Centro storico', city: 'Catania', house_number: '7', postcode: '95124' } }, proxy = { curiosita: C }, stato = 200 } = {}) =>
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        if (String(url).startsWith('https://nominatim.openstreetmap.org/reverse')) return nominatim ? { ok: true, json: async () => nominatim } : { ok: false, status: 403, json: async () => ({}) };
        corpi.push(JSON.parse(init.body));
        return { ok: stato === 200, status: stato, json: async () => proxy };
    }));

describe('curiositaService', () => {
    it('manda dove sei, la città, le chiavi già dette e le tappe: NESSUNA richiesta a Nominatim, nessun indirizzo; restituisce testo, chiave e fonte', async () => {
        rete();
        const r = await richiediCuriosita({ lat: 37.50501, lng: 15.08481, citta: 'Catania', escludi: ['curiosita-itwiki-1'], tappe: ['Teatro Massimo Bellini'] });
        expect(r).toEqual({ testo: C.testo, chiave: C.chiave, luogo: C.luogo, tipo: 'via', fonte: C.fonte, cached: false });
        expect(corpi).toHaveLength(1);
        expect(corpi[0].dv).toEqual({ purpose: 'curiosita', lat: 37.50501, lng: 15.08481, citta: 'Catania', escludi: ['curiosita-itwiki-1'], tappe: ['Teatro Massimo Bellini'] });
        expect(fetch.mock.calls.some(([u]) => /nominatim/.test(String(u)))).toBe(false);
    });
    it('riserva: il server dice «fonti non disponibili» → il telefono chiede Nominatim UNA volta e rimanda con via e quartiere (né numero civico né CAP)', async () => {
        let n = 0;
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            if (String(url).startsWith('https://nominatim.openstreetmap.org/reverse')) return { ok: true, json: async () => ({ address: { road: 'Via Crociferi', suburb: 'Centro storico', city: 'Catania', house_number: '7', postcode: '95124' } }) };
            corpi.push(JSON.parse(init.body)); n += 1;
            return n === 1 ? { ok: false, status: 503, json: async () => ({ code: 'CURIOSITA_FONTI' }) } : { ok: true, status: 200, json: async () => ({ curiosita: C }) };
        }));
        expect(await richiediCuriosita({ lat: 37.6, lng: 15.1, citta: 'Catania' })).toMatchObject({ chiave: C.chiave });
        expect(corpi).toHaveLength(2);
        expect(corpi[0].dv.indirizzo).toBeUndefined();
        expect(corpi[1].dv.indirizzo).toEqual({ road: 'Via Crociferi', suburb: 'Centro storico', city: 'Catania' });
        expect(Object.keys(corpi[1].dv.indirizzo).every(k => CAMPI_INDIRIZZO.includes(k))).toBe(true);
    });
    it('riserva senza Nominatim: nessun secondo invio, null', async () => {
        rete({ nominatim: null, stato: 503, proxy: { code: 'CURIOSITA_FONTI' } });
        expect(await indirizzoDalTelefono(41.1, 12.1)).toBeNull();
        expect(await richiediCuriosita({ lat: 41.2, lng: 12.2, citta: 'Roma' })).toBeNull();
        expect(corpi).toHaveLength(1);
    });
    it('nessuna curiosità, errore o rete giù: null, mai un errore', async () => {
        rete({ proxy: { curiosita: { esito: 'nessuna', motivo: 'nessuna voce verificata' } } });
        expect(await richiediCuriosita({ lat: 41.3, lng: 12.3 })).toBeNull();
        rete({ stato: 503, proxy: { code: 'CURIOSITA_FONTI' }, nominatim: null });
        expect(await richiediCuriosita({ lat: 41.4, lng: 12.4 })).toBeNull();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rete'); }));
        expect(await richiediCuriosita({ lat: 41.5, lng: 12.5 })).toBeNull();
        expect(await richiediCuriosita({ lat: NaN, lng: 12.5 })).toBeNull();
    });
});
