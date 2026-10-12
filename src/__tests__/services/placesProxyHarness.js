// MIG-PLACES — carica un places-proxy (index.ts) dentro vitest: il TypeScript si
// trasforma con esbuild, gli import di Deno (serve, createClient) diventano finti,
// `Deno.env` legge un oggetto, `fetch` verso Google e' registrato. Serve a
// confrontare il proxy di PRIMA (copia in fixtures/) con quello nuovo.
import { transformSync } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ts = (src) => transformSync(src, { loader: 'ts', format: 'esm' }).code;
let n = 0;

/**
 * @param {string} indexSource  testo di index.ts
 * @param {object} o { env, placesNewSource?, cache: Map, testUserIds: Set, upstream: (url, init) => {status, body} }
 * @returns {{ call: (url, headers?) => Promise<{status, body, headers, calls}> }}
 */
export async function loadProxy(indexSource, o) {
    const dir = mkdtempSync(path.join(tmpdir(), 'proxy-'));
    const tag = `p${++n}`;
    let js = ts(indexSource)
        .replace(/import \{ serve \} from ["']https:[^"']+["'];/, 'const serve = (h) => { globalThis.__proxyHandler_' + tag + ' = h; };')
        .replace(/import \{ createClient \} from ["']https:[^"']+["'];/, 'const createClient = (...a) => globalThis.__createClient_' + tag + '(...a);')
        .replace(/from ["']\.\/placesNew\.ts["']/, "from './placesNew.mjs'");
    writeFileSync(path.join(dir, 'index.mjs'), js);
    if (o.placesNewSource) writeFileSync(path.join(dir, 'placesNew.mjs'), ts(o.placesNewSource));

    const calls = [];
    globalThis[`__createClient_${tag}`] = () => ({
        from: (table) => ({
            select: () => ({
                eq: (col, val) => ({
                    maybeSingle: async () => {
                        if (table === 'places_cache') {
                            const hit = o.cache.get(val);
                            return { data: hit ? { data: hit, created_at: new Date().toISOString() } : null, error: null };
                        }
                        if (table === 'ai_quota_test_account') return { data: o.testUserIds.has(val) ? { user_id: val } : null, error: null };
                        return { data: null, error: null };
                    },
                }),
            }),
            upsert: async (row) => { o.cache.set(row.cache_key, row.data); return { error: null }; },
        }),
        auth: { getUser: async (token) => (token === 'TESTTOKEN' ? { data: { user: { id: 'u-test' } }, error: null }
            : token === 'OTHERTOKEN' ? { data: { user: { id: 'u-other' } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    });
    const prevDeno = globalThis.Deno;
    globalThis.Deno = { env: { get: (k) => o.env[k] } };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        const r = o.upstream(u, init);
        calls.push({ url: u, method: init.method || 'GET', headers: init.headers ?? null, body: init.body ?? null, redirect: init.redirect ?? null });
        return new Response(r.body === null ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers || { 'content-type': 'application/json' } });
    };
    try {
        await import(/* @vite-ignore */ pathToFileURL(path.join(dir, 'index.mjs')).href);
    } finally { globalThis.fetch = realFetch; globalThis.Deno = prevDeno; }
    const handler = globalThis[`__proxyHandler_${tag}`];
    return {
        calls,
        async call(url, headers = {}) {
            const prev = globalThis.Deno; const pf = globalThis.fetch;
            globalThis.Deno = { env: { get: (k) => o.env[k] } };
            globalThis.fetch = async (u, init = {}) => {
                const r = o.upstream(String(u), init);
                calls.push({ url: String(u), method: init.method || 'GET', headers: init.headers ?? null, body: init.body ?? null, redirect: init.redirect ?? null });
                return new Response(r.body === null ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers || { 'content-type': 'application/json' } });
            };
            try {
                const res = await handler(new Request(url, { headers }));
                const text = await res.text();
                return { status: res.status, body: text, headers: Object.fromEntries(res.headers.entries()) };
            } finally { globalThis.Deno = prev; globalThis.fetch = pf; }
        },
    };
}

export const readSrc = (p) => readFileSync(p, 'utf8');
