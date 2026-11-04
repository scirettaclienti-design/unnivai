// @vitest-environment node
// GOOGLE-CHIAVI — due chiavi: quella del BROWSER (VITE_GOOGLE_MAPS_API_KEY, ristretta per sito) e quella del SERVER (secret
// GOOGLE_SERVER_KEY, con ripiego su GOOGLE_MAPS_API_KEY di oggi). Questi test falliscono se una funzione legge VITE_*, se il
// secret nuovo non ha la precedenza, o se il browser torna a chiamare Google con la chiave del browser fuori dai due file ammessi.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadProxy, readSrc } from '../services/placesProxyHarness.js';

const ROOT = path.resolve(__dirname, '../../..');
const tutti = (dir, ok) => readdirSync(dir).flatMap(n => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? (n === '__tests__' || n === 'node_modules' ? [] : tutti(p, ok)) : (ok(p) ? [p] : []);
});
const rel = (p) => path.relative(ROOT, p);

describe('le funzioni non leggono mai la chiave del browser', () => {
    const files = tutti(path.join(ROOT, 'supabase/functions'), p => /\.(ts|js)$/.test(p) && !/\.test\./.test(p));
    it('ci sono funzioni da controllare', () => expect(files.length).toBeGreaterThan(5));
    it('nessun file di supabase/functions contiene VITE_', () => {
        const colpevoli = files.filter(f => /VITE_/.test(readFileSync(f, 'utf8'))).map(rel);
        expect(colpevoli).toEqual([]);
    });
    it('vite.config.js (specchio dev del proxy) non legge VITE_GOOGLE', () => {
        const v = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
        expect(v.replace(/\/\/.*$/gm, '')).not.toMatch(/VITE_GOOGLE/);
    });
    it('ogni funzione che legge GOOGLE_MAPS_API_KEY legge prima GOOGLE_SERVER_KEY', () => {
        const usano = files.filter(f => /Deno\.env\.get\(['"]GOOGLE_MAPS_API_KEY['"]\)/.test(readFileSync(f, 'utf8')));
        expect(usano.map(rel).sort()).toEqual(['supabase/functions/openai-proxy/index.ts', 'supabase/functions/places-proxy/index.ts']);
        for (const f of usano) {
            const s = readFileSync(f, 'utf8');
            const nuovo = s.search(/Deno\.env\.get\(['"]GOOGLE_SERVER_KEY['"]\)/);
            const vecchio = s.search(/Deno\.env\.get\(['"]GOOGLE_MAPS_API_KEY['"]\)/);
            expect(nuovo, rel(f)).toBeGreaterThanOrEqual(0);
            expect(nuovo, rel(f)).toBeLessThan(vecchio);
        }
    });
});

describe('places-proxy: secret nuovo con ripiego', () => {
    const SRC = readSrc('supabase/functions/places-proxy/index.ts');
    const MOD = readSrc('supabase/functions/places-proxy/placesNew.ts');
    const upstream = () => ({ status: 200, body: { status: 'OK', results: [{ geometry: { location: { lat: 1, lng: 2 } } }] } });
    const chiaveUsata = async (env) => {
        const p = await loadProxy(SRC, { env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', ...env }, placesNewSource: MOD, cache: new Map(), testUserIds: new Set(), upstream });
        const r = await p.call('https://x.supabase.co/functions/v1/places-proxy?path=geocode&address=Roma&language=it');
        return { status: r.status, key: new URL(p.calls[0]?.url ?? 'http://x/?').searchParams.get('key'), url: p.calls[0]?.url };
    };
    it('con GOOGLE_SERVER_KEY usa quella', async () => { expect((await chiaveUsata({ GOOGLE_SERVER_KEY: 'NUOVA', GOOGLE_MAPS_API_KEY: 'VECCHIA' })).key).toBe('NUOVA'); });
    it('senza il secret nuovo usa quella di oggi (pubblicare il codice prima del secret non rompe nulla)', async () => { expect((await chiaveUsata({ GOOGLE_MAPS_API_KEY: 'VECCHIA' })).key).toBe('VECCHIA'); });
    it('secret nuovo vuoto = come assente', async () => { expect((await chiaveUsata({ GOOGLE_SERVER_KEY: '  ', GOOGLE_MAPS_API_KEY: 'VECCHIA' })).key).toBe('VECCHIA'); });
    it('nessuna delle due: errore 500 chiaro, nessuna chiamata a Google', async () => { const r = await chiaveUsata({}); expect(r.status).toBe(500); expect(r.url).toBeUndefined(); });
    it('il path geocode va a Geocoding di Google', async () => { expect((await chiaveUsata({ GOOGLE_SERVER_KEY: 'N' })).url).toContain('maps.googleapis.com/maps/api/geocode/json?'); });
    it('la chiave VITE_ nell\'ambiente non viene mai usata', async () => { expect((await chiaveUsata({ VITE_GOOGLE_MAPS_API_KEY: 'BROWSER' })).status).toBe(500); });
});

describe('il browser: chi legge la chiave del browser e chi chiama Geocoding', () => {
    const src = tutti(path.join(ROOT, 'src'), p => /\.(js|jsx|ts|tsx)$/.test(p) && !/__tests__|\.test\./.test(p));
    it('VITE_GOOGLE_MAPS_API_KEY solo in MapAPIWrapper (SDK Maps) e geocodeGoogle (ripiego di transizione)', () => {
        const chi = src.filter(f => /VITE_GOOGLE_MAPS_API_KEY/.test(readFileSync(f, 'utf8'))).map(rel).sort();
        expect(chi).toEqual(['src/components/MapAPIWrapper.jsx', 'src/lib/geocodeGoogle.js']);
    });
    it('maps.googleapis.com/maps/api/geocode solo in geocodeGoogle', () => {
        const chi = src.filter(f => /maps\.googleapis\.com\/maps\/api\/geocode/.test(readFileSync(f, 'utf8'))).map(rel);
        expect(chi).toEqual(['src/lib/geocodeGoogle.js']);
    });
});

describe('geocodeGoogle: prima il server, poi (transizione) la chiamata diretta', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
    const carica = async () => (await import('../../lib/geocodeGoogle.js')).geocodeGoogle;
    const OK = { status: 'OK', results: [{ address_components: [] }] };
    const risposta = (status, body) => ({ ok: status < 400, status, json: async () => body });

    it('proxy che risponde: una sola chiamata, mai a maps.googleapis.com', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'BROWSER');
        const f = vi.fn().mockResolvedValue(risposta(200, OK)); vi.stubGlobal('fetch', f);
        expect(await (await carica())({ latlng: '1,2' })).toEqual(OK);
        expect(f).toHaveBeenCalledTimes(1);
        expect(String(f.mock.calls[0][0])).toContain('path=geocode');
        expect(String(f.mock.calls[0][0])).not.toContain('googleapis.com');
    });
    it('proxy non ancora aggiornato (403): ripiego diretto di oggi, app invariata', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'BROWSER');
        const f = vi.fn().mockResolvedValueOnce(risposta(403, { error: 'Path not allowed' })).mockResolvedValueOnce(risposta(200, OK)); vi.stubGlobal('fetch', f);
        expect(await (await carica())({ address: 'Roma' })).toEqual(OK);
        expect(String(f.mock.calls[1][0])).toContain('maps.googleapis.com/maps/api/geocode/json');
    });
    it('chiave del browser ristretta (REQUEST_DENIED) e proxy fuori uso: null, i chiamanti hanno il loro ripiego', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'BROWSER');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(risposta(200, { status: 'REQUEST_DENIED', error_message: 'x' })));
        expect(await (await carica())({ address: 'Roma' })).toBeNull();
    });
    it('senza chiave del browser e proxy fuori uso: null, nessuna richiesta a Google', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
        const f = vi.fn().mockRejectedValue(new Error('rete')); vi.stubGlobal('fetch', f);
        expect(await (await carica())({ address: 'Roma' })).toBeNull();
        expect(f.mock.calls.every(c => !String(c[0]).includes('googleapis.com'))).toBe(true);
    });
});
