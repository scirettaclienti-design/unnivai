// RACCONTO-FONTI — le 13 tappe di Catania e Troina e le 10 di Roma di RACCONTO-R4 (più la Galleria del Cardinale Colonna), sulla funzione
// PUBBLICATA (`dv.purpose = 'racconto'`, account di prova): fonti dal server, cache, scrittura, controlli, salvataggio come nell'app.
//   npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/racconti-fonti.live.js
// Accanto, le fonti ricostruite in locale con lo stesso codice (cercaWikipedia + allargaWikipedia), per leggere a mano ogni racconto.
// Scrive docs/prove/dati/2026-11-02-racconti-fonti.json. Le credenziali dell'account di prova non si stampano.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { supabase } from '@/lib/supabase';
import { cercaWikipedia, allargaWikipedia, descrizioneGoogleDa } from '../../supabase/functions/openai-proxy/raccontoFonti.ts';
import { haFonti, fontiPulite } from '../../supabase/functions/openai-proxy/racconto.ts';

const roma = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-30-fonti-roma.json', 'utf8')).tappe;
const TAPPE = [
    ['Catania', 'ChIJ246EAS_jExMR__mpdyI1ULw', 'Porta Uzeda', 37.5018, 15.08764],
    ['Catania', 'ChIJP0UjWi7jExMRJytI986aC6g', "Basilica Cattedrale di Sant'Agata", 37.50252, 15.0871],
    ['Catania', 'ChIJV63v_C7jExMRLThjTCcPppk', "Fontana dell'Elefante (uʻ Liotru)", 37.50241, 15.08772],
    ['Catania', 'ChIJ2e3QsinjExMRNmN2_vYCfp8', 'Teatro Antico greco-romano di Catania', 37.50183, 15.0854],
    ['Catania', 'ChIJH_LNACbjExMR3WPlQ82DyEw', 'Castello Ursino', 37.49917, 15.08449],
    ['Catania', 'ChIJjfE4n-jjExMR0gwbhCQ0rk4', 'Fontana dell’Amenano', 37.50204, 15.08701],
    ['Catania', 'ChIJaUl7zSjjExMRoCTWa8ahogs', 'Piazza Giuseppe Mazzini', 37.50212, 15.08722],
    ['Catania', 'ChIJiS624y7jExMREIKeZ58jDjg', 'Palazzo dei Chierici', 37.50219, 15.08491],
    ['Catania', 'ChIJY0P1DNT8ExMR9QiL54XqybI', 'Via Etnea', 37.50389, 15.08712],
    ['Troina', 'ChIJwTstqajLFhMRnwdcVrWeGsY', 'Chiesa Madre di Maria Santissima Assunta', 37.78542, 14.60089],
    ['Troina', 'ChIJSdi3PqbLFhMRevZmDu4FnbQ', 'Torre Capitania', 37.78433, 14.5992],
    ['Troina', 'ChIJkSKaqKjLFhMROMP-9DO305o', 'Piazza Conte Ruggero', 37.78525, 14.60076],
    ['Troina', 'ChIJDVVKWWLLFhMRpl06lDqV2mI', 'Monte Muganà', 37.7876, 14.61054],
    ...roma.map(t => ['Roma', t.place_id, t.nome, t.lat, t.lng]),
    ['Roma', 'ChIJI2zkpLJhLxMRHoL_R8vaBNI', 'Galleria del Cardinale Colonna', 41.8974878, 12.4848434],
].map(([citta, place_id, nome, lat, lng]) => ({ citta, place_id, nome, lat, lng }));

const pausa = (ms) => new Promise(r => setTimeout(r, ms));
const URL_FN = `${process.env.VITE_SUPABASE_URL}/functions/v1`;
const anon = { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` };

async function racconto(t, token) {
    const t0 = Date.now();
    const r = await fetch(`${URL_FN}/openai-proxy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dv: { purpose: 'racconto', place_id: t.place_id, nome: t.nome, citta: t.citta, lat: t.lat, lng: t.lng } }),
    });
    const j = await r.json().catch(() => ({}));
    return { http: r.status, ms: Date.now() - t0, ...(j?.racconto || { errore: j?.code || j?.error || r.status }) };
}
async function fontiLocali(t) {
    const tappa = { nome: t.nome, citta: t.citta, lat: t.lat, lng: t.lng };
    const f = (u, init) => fetch(u, init);
    const w = await cercaWikipedia(tappa, f);
    const g = await fetch(`${URL_FN}/places-proxy?path=place/details&place_id=${encodeURIComponent(t.place_id)}&fields=editorial_summary&language=it`, { headers: anon })
        .then(r => r.json()).then(descrizioneGoogleDa).catch(() => '');
    let fonte = w.fonte;
    const base = { nome: t.nome, citta: t.citta, wikipedia: fonte ? { testo: fonte.testo } : null, google: g ? { testo: g } : null };
    if (!haFonti(base) && !w.errore) fonte = (await allargaWikipedia(tappa, fonte, f)).fonte || fonte;
    const fonti = { ...base, wikipedia: fonte ? { titolo: fonte.titolo, testo: fonte.testo } : null };
    const p = fontiPulite(fonti);
    return { titolo: fonte?.titolo || null, via: fonte?.via || null, distanzaM: fonte?.distanzaM ?? null, wikipedia: p.wikipedia, google: p.google, caratteri: p.wikipedia.length + p.google.length, haFonti: haFonti(fonti) };
}

describe('RACCONTO-FONTI: le 24 tappe sulla funzione pubblicata', () => {
    it('chiede il racconto di ogni tappa e registra fonti, esito e costo', async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
        expect(error, 'accesso account di prova').toBeNull();
        const token = data.session.access_token;
        const esiti = [];
        for (const t of TAPPE) {
            const r = await racconto(t, token);
            await pausa(1500);
            const fonti = await fontiLocali(t);
            esiti.push({ ...t, risposta: r, fontiLocali: fonti });
            console.log(`${t.citta} | ${t.nome} | ${r.http} ${r.esito ?? r.errore}${r.cached ? ' (cache)' : ''}${r.riscritto ? ' (riscritto)' : ''} | ${fonti.via || '-'} ${fonti.titolo || '-'} ${fonti.caratteri} car | ${r.costoUsd ?? 0} $ | ${r.ms} ms`);
            await pausa(1500);
        }
        const spesa = esiti.reduce((s, e) => s + (Number(e.risposta.costoUsd) || 0), 0);
        fs.writeFileSync('docs/prove/dati/2026-11-02-racconti-fonti.json', JSON.stringify({ presoIl: new Date().toISOString(), funzione: 'openai-proxy v39', spesaUsd: +spesa.toFixed(5), esiti }, null, 2));
        console.log(`spesa ${spesa.toFixed(5)} $`);
    }, 900000);
});
