#!/usr/bin/env node
// T29 — completa i tracciati della guardia con le sole risposte di Google che mancano. Il proxy rifiuta le liste di un giorno piu' vecchio di ieri
// (BAD_CITY_LIST), quindi `--registra` su un giorno passato girerebbe senza lista: si tengono le risposte registrate e si aggiungono solo le ricerche
// nuove che il codice chiede. Una chiamata a places-proxy per ogni uscita (0,035 $ a listino, 0 $ dalla cache), account di prova; mai stampate le credenziali.
//   node scripts/impostazioni/completa-tracciati.mjs            rigioca la guardia, completa, ripete (al massimo 4 volte)
//   node scripts/impostazioni/completa-tracciati.mjs --banco40  lo stesso sui 40 casi del banco
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env', quiet: true });
config({ path: '.env.local', quiet: true, override: true });
const URL_BASE = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
const { data, error } = await sb.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
if (error || !data?.session) throw new Error('login dell\'account di prova fallito');
const token = data.session.access_token;
const leggi = (f) => JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
let chiamate = 0, dallaCache = 0;

async function risposta(chiave) {
    const i = chiave.indexOf(':');
    const url = `${URL_BASE}/functions/v1/places-proxy?path=${encodeURIComponent(chiave.slice(0, i))}&${chiave.slice(i + 1).split('&').map(p => { const k = p.indexOf('='); return `${p.slice(0, k)}=${encodeURIComponent(p.slice(k + 1))}`; }).join('&')}${chiave.startsWith('place/textsearch') ? '&engine=new' : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, apikey: ANON } });
    chiamate += 1;
    if (res.headers.get('X-Cache') === 'HIT') dallaCache += 1;
    return { status: res.status, corpo: await res.json() };
}

const BANCO40 = 'docs/prove/dati/banco-40-tracciati.json.gz';
function replayBanco40() {
    const out = path.join(mkdtempSync(path.join(os.tmpdir(), 'completa-')), 'replay.json');
    const r = spawnSync('npx', ['vitest', 'run', '-c', 'scripts/banco/vitest.replay.config.js'], { stdio: 'ignore', env: { ...process.env, REPLAY_IN: BANCO40, REPLAY_OUT: out } });
    return { status: r.status, stdout: `[guardia] replay di ${BANCO40} (banco) — risultato: ${out}\n` };
}
for (let giro = 1; giro <= 4; giro++) {
    const r = process.argv.includes('--banco40') ? replayBanco40() : spawnSync('node', ['scripts/banco/guardia.mjs'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const righe = (r.stdout || '').split('\n').filter(l => l.startsWith('[guardia] replay di '));
    const mancanti = new Map();
    for (const l of righe) {
        const m = l.match(/replay di (\S+) .*risultato: (\S+)/);
        if (!m) continue;
        const grezzo = JSON.parse(readFileSync(m[2], 'utf8'));
        for (const c of grezzo.casi || []) for (const u of c.replay?.uscite || []) {
            if (u.tipo !== 'places') { console.log(`uscita non di Google: ${c.id} ${u.tipo}`); continue; }
            if (!mancanti.has(m[1])) mancanti.set(m[1], []);
            mancanti.get(m[1]).push({ id: c.id, chiave: u.chiave });
        }
    }
    const n = [...mancanti.values()].flat().length;
    console.log(`giro ${giro}: ${n} risposte mancanti, guardia ${r.status === 0 ? 'passata' : 'non passata'}`);
    if (n === 0) { console.log((r.stdout || '').split('\n').filter(l => /GUARDIA|PERTINENZA|NUOVI/.test(l)).join('\n')); break; }
    for (const [file, voci] of mancanti) {
        const t = leggi(file);
        for (const v of voci) {
            const caso = t.casi.find(c => c.id === v.id);
            if (!caso || caso.rete.places[v.chiave]) continue;
            caso.rete.places[v.chiave] = await risposta(v.chiave);
        }
        t.completato = { da: 'T29', il: new Date().toISOString() };
        writeFileSync(file, gzipSync(JSON.stringify(t)));
    }
}
console.log(`chiamate a places-proxy: ${chiamate}, dalla cache: ${dallaCache}, a listino: ${((chiamate - dallaCache) * 0.035).toFixed(3)} $`);
