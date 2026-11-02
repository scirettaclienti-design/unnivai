// CURIOSITÀ-QUARTIERI — il client chiede la curiosità: dove sei, la via e il quartiere di OpenStreetMap (dal telefono: Nominatim rifiuta il
// server), le chiavi già dette, le tappe. Mai lancia. 0 $, nessuna rete.
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
    it('manda dove sei, la città, le chiavi già dette, le tappe e SOLO via e quartiere di OpenStreetMap; restituisce testo, chiave e fonte', async () => {
        rete();
        const r = await richiediCuriosita({ lat: 37.50501, lng: 15.08481, citta: 'Catania', escludi: ['curiosita-itwiki-1'], tappe: ['Teatro Massimo Bellini'] });
        expect(r).toEqual({ testo: C.testo, chiave: C.chiave, luogo: C.luogo, tipo: 'via', fonte: C.fonte, cached: false });
        expect(corpi[0].dv).toEqual({ purpose: 'curiosita', lat: 37.50501, lng: 15.08481, citta: 'Catania', escludi: ['curiosita-itwiki-1'], tappe: ['Teatro Massimo Bellini'],
            indirizzo: { road: 'Via Crociferi', neighbourhood: 'Giudecca', suburb: 'Centro storico', city: 'Catania' } });
        expect(Object.keys(corpi[0].dv.indirizzo).every(k => CAMPI_INDIRIZZO.includes(k))).toBe(true); // né numero civico né CAP
    });
    it('Nominatim non risponde: si chiede lo stesso, senza indirizzo', async () => {
        rete({ nominatim: null });
        expect(await indirizzoDalTelefono(41.1, 12.1)).toBeNull();
        expect(await richiediCuriosita({ lat: 41.2, lng: 12.2, citta: 'Roma' })).toBeTruthy();
        expect(corpi[0].dv.indirizzo).toBeUndefined();
    });
    it('nessuna curiosità, errore o rete giù: null, mai un errore', async () => {
        rete({ proxy: { curiosita: { esito: 'nessuna', motivo: 'nessuna voce verificata' } } });
        expect(await richiediCuriosita({ lat: 41.3, lng: 12.3 })).toBeNull();
        rete({ stato: 503, proxy: { code: 'CURIOSITA_FONTI' } });
        expect(await richiediCuriosita({ lat: 41.4, lng: 12.4 })).toBeNull();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rete'); }));
        expect(await richiediCuriosita({ lat: 41.5, lng: 12.5 })).toBeNull();
        expect(await richiediCuriosita({ lat: NaN, lng: 12.5 })).toBeNull();
    });
});
