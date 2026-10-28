// RACCONTI DI TAPPA — prova con le tappe vere (Catania e Troina), rete vera, account di prova.
//   PROVA_RACCONTI=catania,troina npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/racconti.live.js
// Per ogni tappa: fonti (Wikipedia dal titolo agganciato da factsService + descrizione Google via places-proxy), racconto scritto dal narratore
// (openai-proxy, passaggio `narratore` = Sonnet 5.5 con AI_PROVIDER=anthropic), controllo automatico, costo. Scrive il grezzo in
// docs/prove/dati/2026-10-28-racconti-tappa.json. Le credenziali dell'account di prova non si stampano.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { supabase } from '@/lib/supabase';
import { cercaWikipedia, descrizioneGoogleDa } from '../../supabase/functions/openai-proxy/raccontoFonti.ts';
import { messaggiRacconto, controllaRacconto, ripulisciRacconto, haFonti, LIMITI } from '../../supabase/functions/openai-proxy/racconto.ts';

const TAPPE = {
    catania: { citta: 'Catania', tappe: [
        { place_id: 'ChIJ246EAS_jExMR__mpdyI1ULw', title: 'Porta Uzeda', lat: 37.5018, lng: 15.08764, types: ['landmark', 'tourist_attraction'] },
        { place_id: 'ChIJP0UjWi7jExMRJytI986aC6g', title: "Basilica Cattedrale di Sant'Agata", lat: 37.50252, lng: 15.0871, types: ['church', 'tourist_attraction'] },
        { place_id: 'ChIJV63v_C7jExMRLThjTCcPppk', title: "Fontana dell'Elefante (uʻ Liotru)", lat: 37.50241, lng: 15.08772, types: ['historical_landmark', 'tourist_attraction'] },
        { place_id: 'ChIJ2e3QsinjExMRNmN2_vYCfp8', title: 'Teatro Antico greco-romano di Catania', lat: 37.50183, lng: 15.0854, types: ['historical_landmark', 'tourist_attraction'] },
        { place_id: 'ChIJH_LNACbjExMR3WPlQ82DyEw', title: 'Castello Ursino', lat: 37.49917, lng: 15.08449, types: ['castle', 'tourist_attraction'] },
        { place_id: 'ChIJjfE4n-jjExMR0gwbhCQ0rk4', title: 'Fontana dell’Amenano', lat: 37.50204, lng: 15.08701, types: ['tourist_attraction'] },
        { place_id: 'ChIJaUl7zSjjExMRoCTWa8ahogs', title: 'Piazza Giuseppe Mazzini', lat: 37.50212, lng: 15.08722, types: ['historical_landmark', 'historical_place'] },
        { place_id: 'ChIJiS624y7jExMREIKeZ58jDjg', title: 'Palazzo dei Chierici', lat: 37.50219, lng: 15.08491, types: ['tourist_attraction', 'point_of_interest'] },
        { place_id: 'ChIJY0P1DNT8ExMR9QiL54XqybI', title: 'Via Etnea', lat: 37.50389, lng: 15.08712, types: ['route'] },
    ] },
    troina: { citta: 'Troina', tappe: [
        { place_id: 'ChIJwTstqajLFhMRnwdcVrWeGsY', title: 'Chiesa Madre di Maria Santissima Assunta', lat: 37.78542, lng: 14.60089, types: ['church', 'place_of_worship'] },
        { place_id: 'ChIJSdi3PqbLFhMRevZmDu4FnbQ', title: 'Torre Capitania', lat: 37.78433, lng: 14.5992, types: ['museum', 'tourist_attraction'] },
        { place_id: 'ChIJkSKaqKjLFhMROMP-9DO305o', title: 'Piazza Conte Ruggero', lat: 37.78525, lng: 14.60076, types: ['route'] },
        { place_id: 'ChIJDVVKWWLLFhMRpl06lDqV2mI', title: 'Monte Muganà', lat: 37.7876, lng: 14.61054, types: ['scenic_spot', 'point_of_interest'] },
    ] },
};
const PREZZO = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-haiku-5-5': [0.1, 0.5] };

async function descrizioneGoogle(placeId) {
    const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/places-proxy?path=place/details&place_id=${encodeURIComponent(placeId)}&fields=editorial_summary&language=it`;
    const r = await fetch(url, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` } });
    const j = await r.json().catch(() => null);
    return { stato: j?.status || r.status, testo: descrizioneGoogleDa(j) };
}
async function scrivi(messaggi, token) {
    const t0 = Date.now();
    const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', max_tokens: 1500, messages: messaggi, dv: { purpose: 'aux', passaggio: 'narratore' } }),
    });
    const j = await r.json().catch(() => ({}));
    return { ms: Date.now() - t0, http: r.status, testo: j?.choices?.[0]?.message?.content ?? '', usage: j?.usage || null, modello: j?._modello || null, errore: r.ok ? null : (j?.error || j?.code || r.status) };
}

const scelte = (process.env.PROVA_RACCONTI || 'catania,troina').split(',').filter(k => TAPPE[k]);
const esiti = [];

describe('racconti di tappa: tappe vere, fonti vere, modello vero', () => {
    it('scrive e controlla i racconti', async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
        expect(error, 'accesso account di prova').toBeNull();
        const token = data.session.access_token;
        for (const k of scelte) {
            const { citta, tappe } = TAPPE[k];
            for (const s of tappe) {
                await new Promise(r => setTimeout(r, 400)); // Wikipedia rifiuta le raffiche («too busy»)
                const { fonte: wiki, errore: wikiErrore } = await cercaWikipedia({ nome: s.title, citta, lat: s.lat, lng: s.lng }, (u, init) => fetch(u, init));
                const titolo = wiki?.titolo || null;
                const testoWiki = wiki?.testo || '';
                const google = await descrizioneGoogle(s.place_id);
                const fonti = { nome: s.title, citta, wikipedia: wiki ? { titolo, testo: testoWiki } : null, google: google.testo ? { testo: google.testo } : null };
                const riga = { citta, nome: s.title, place_id: s.place_id, wikipediaErrore: wikiErrore, wikipediaTitolo: titolo, wikipediaUrl: wiki?.url || null, wikipediaDistanzaM: wiki?.distanzaM ?? null, wikipediaCar: testoWiki.length, googleStato: google.stato, googleCar: google.testo.length, fonti };
                if (!haFonti(fonti)) { riga.esito = wikiErrore ? 'fonti-non-raggiunte' : 'senza-fonti'; esiti.push(riga); continue; }
                const w = await scrivi(messaggiRacconto(fonti), token);
                const testo = ripulisciRacconto(w.testo);
                const controllo = controllaRacconto(testo, fonti);
                const [pi, po] = PREZZO[w.modello?.usato] || PREZZO['claude-sonnet-5-5'];
                Object.assign(riga, {
                    ms: w.ms, http: w.http, modello: w.modello?.usato || null, fornitore: w.modello?.fornitore || null, errore: w.errore,
                    usage: w.usage, costoUsd: w.usage ? +(((w.usage.prompt_tokens || 0) * pi + (w.usage.completion_tokens || 0) * po) / 1e6).toFixed(5) : null,
                    grezzo: w.testo, racconto: testo, controllo, esito: controllo.ok ? 'passato' : 'scartato',
                });
                esiti.push(riga);
            }
        }
        fs.writeFileSync('docs/prove/dati/2026-10-28-racconti-tappa.json', JSON.stringify({ limiti: LIMITI, esiti }, null, 1));
        const passati = esiti.filter(e => e.esito === 'passato').length;
        console.log(`racconti: ${esiti.length}, passati ${passati}, scartati ${esiti.filter(e => e.esito === 'scartato').length}, senza fonti ${esiti.filter(e => e.esito === 'senza-fonti').length}`);
        expect(esiti.length).toBeGreaterThan(0);
    });
});
