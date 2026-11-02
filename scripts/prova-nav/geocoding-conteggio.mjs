/**
 * GEOCODING-LANCIO — conta le richieste ESTERNE (Google geocoding, Photon, Nominatim, Wikipedia) che servono a trovare le fonti di una curiosità,
 * sugli stessi punti dei tre giri della prova del 02/11 (docs/prove/dati/2026-11-02-curiosita-quartieri-webkit.json: le posizioni delle
 * richieste di curiosità). Rete vera, nessun costo AI (si fermano alle fonti; il testo della voce, uguale prima e dopo, non è contato).
 *   PRIMA: node --experimental-strip-types scripts/prova-nav/geocoding-conteggio.mjs prima  <cartella openai-proxy di origin/main>
 *   DOPO:  GEO_KEY=… node --experimental-strip-types scripts/prova-nav/geocoding-conteggio.mjs dopo  supabase/functions/openai-proxy
 * PRIMA = il telefono chiede Nominatim a ogni richiesta (1 per richiesta), il server verifica su Wikipedia (come v43).
 * DOPO = memoria per zona + Google; «utente 2» ripete lo stesso giro con la memoria già piena (un altro utente, lo stesso giorno).
 * GEO_KEY (solo DOPO) è una chiave di Google per le prove; il referer è quello del sito. Mai stampata.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [modo, dir] = [process.argv[2], path.resolve(process.argv[3])];
const F = await import(pathToFileURL(path.join(dir, 'curiositaFonti.ts')).href);
const dati = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-curiosita-quartieri-webkit.json', 'utf8'));
const CITTA = { trastevere: 'Roma', monti: 'Roma', catania: 'Catania' };
const GEO_KEY = process.env.GEO_KEY || null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const reale = async (url, init = {}) => {
    const u = new URL(String(url));
    const headers = { ...(init.headers || {}) };
    if (u.hostname === 'maps.googleapis.com') headers.Referer = 'https://unnivai.vercel.app/';
    if (u.hostname === 'nominatim.openstreetmap.org') await sleep(1100); // la regola di Nominatim: 1 al secondo
    return fetch(url, { ...init, headers });
};
const memoria = new Map();
const store = { leggi: async (k) => memoria.get(k) ?? null, scrivi: async (k, v) => { memoria.set(k, JSON.parse(JSON.stringify(v))); } };

const out = { modo, quando: new Date().toISOString(), giri: {} };
for (const turno of modo === 'prima' ? ['unico'] : ['utente 1', 'utente 2']) {
    for (const [nome, g] of Object.entries(dati.giri)) {
        const punti = g.grezzo.proxy.map(p => ({ lat: p.lat, lng: p.lng }));
        const tot = { google: 0, photon: 0, nominatim: 0, wikipedia: 0 };
        const luoghi = [];
        for (const p of punti) {
            const c = F.contaRichieste ? F.contaRichieste(reale) : null;
            const conta = { google: 0, photon: 0, nominatim: 0, wikipedia: 0 };
            const f = c ? c.fetch : (async (url, init) => { const h = new URL(String(url)).hostname; if (/wikipedia\.org$/.test(h)) conta.wikipedia += 1; return reale(url, init); });
            let esito;
            if (modo === 'prima') {
                // il telefono chiede Nominatim (1 richiesta per richiesta di curiosità), poi il server cerca le voci
                await sleep(1100); conta.nominatim += 1;
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=17&addressdetails=1&accept-language=it`, { headers: { 'User-Agent': F.UA_CURIOSITA } });
                const j = r.ok ? await r.json().catch(() => null) : null;
                const ind = j?.address ? F.indirizzoDaClient(Object.fromEntries(Object.entries(j.address).filter(([k]) => F.CAMPI_PROVA?.includes(k) ?? ['road', 'pedestrian', 'square', 'footway', 'neighbourhood', 'quarter', 'suburb', 'city_district', 'city', 'town', 'village'].includes(k)))) : null;
                esito = await F.luoghiVicini({ lat: p.lat, lng: p.lng, citta: CITTA[nome] }, ind ?? { via: null, quartieri: [], citta: null }, f);
            } else {
                esito = await F.luoghiDellaZona({ lat: p.lat, lng: p.lng, citta: CITTA[nome] }, f, store, GEO_KEY);
            }
            const n = c ? c.conteggio : conta;
            for (const k of Object.keys(tot)) tot[k] += n[k] + (c && modo === 'prima' && k === 'nominatim' ? conta.nominatim : 0);
            luoghi.push(esito.luoghi.map(l => `${l.tipo}:${l.titolo}`));
            if (esito.errore) luoghi[luoghi.length - 1].push('ERRORE');
        }
        out.giri[`${nome}${modo === 'prima' ? '' : ' / ' + turno}`] = { richiesteAlProxy: punti.length, esterne: tot, totale: Object.values(tot).reduce((a, b) => a + b, 0), luoghi };
        console.log(nome, turno, JSON.stringify(out.giri[`${nome}${modo === 'prima' ? '' : ' / ' + turno}`].esterne), `su ${punti.length} richieste`);
    }
}
fs.writeFileSync(process.env.CONTEGGIO_OUT || `docs/prove/dati/2026-11-03-geocoding-conteggio-${modo}.json`, JSON.stringify(out, null, 1));
