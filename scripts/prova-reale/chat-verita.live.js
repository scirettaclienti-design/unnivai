// CHAT-VERITA — il banco della chat con la guida: 30 domande su un giro di Catania (10 sui luoghi del giro, 10 trappole, 10 non fattuali),
// la risposta di OGGI (prompt di chatWithGuide, contorno del proxy pubblicato) e quella NUOVA (chat.ts + chatFonti.ts: le stesse funzioni del
// proxy, importate dal repo). Prima del deploy il percorso `chat` non esiste in produzione: le chiamate ai modelli passano dal proxy pubblicato
// con `dv.purpose = 'aux'` e il passaggio che sceglie il modello (come REVISORE-FORTE): scrittore `narratore` (Sonnet 5.5) o `traduttore`
// (Haiku 4.5), revisore `traduttore` (Haiku 4.5 = il revisore dei racconti in produzione, ANTHROPIC_MODEL_REVISORE non impostato).
// Fonti dal telefono di chi prova: Wikipedia diretta, descrizione Google via places-proxy (stesse funzioni del proxy).
// Tempi: `ms` = dalla domanda alla risposta qui; `msServer` = fonti + tempi dei modelli sul server (`_modello.ms`), cioè quello che il
// percorso `chat` farà in una richiesta sola, senza i giri in più fra questo Mac e il proxy. Credenziali dell'account di prova: mai stampate.
//   SCRITTORE=narratore npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/chat-verita.live.js
//   (FASE=prima | dopo | tutto; DOMANDE=1,2,3 per un sottoinsieme)
// CHAT-ACCESSO-VELOCE (04/11): REVISORE=traduttore (difetto, Haiku 4.5) | narratore (Sonnet 5.5, come ANTHROPIC_MODEL_REVISORE in produzione);
// la riga va in `dopo["<scrittore>+<revisore>"]` quando il revisore non è il difetto. MODO=sito: la domanda va al percorso `chat` del proxy
// pubblicato (come chatGuidaService: prossima null, centro = media delle tappe, storia vuota), riga in `dopo.sito`; le fonti si ricalcolano qui
// solo per contare le frasi inventate (fuori dal tempo). GIRO_DA=<json> prende il giro (place_id) da un grezzo già fatto.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { supabase } from '@/lib/supabase';
import { fontiChat, luoghiDaCercare, rispondiInChat } from '../../supabase/functions/openai-proxy/chat.ts';
import { fontiDiTappa, luoghiNominati } from '../../supabase/functions/openai-proxy/chatFonti.ts';
import { descrizioneGoogleDa } from '../../supabase/functions/openai-proxy/raccontoFonti.ts';

const FASE = process.env.FASE || 'tutto';
const SCRITTORE = process.env.SCRITTORE || 'narratore';
const SOLO = (process.env.DOMANDE || '').split(',').filter(Boolean).map(Number);
const OUT = process.env.CHAT_OUT || 'docs/prove/dati/2026-11-02-chat-verita.json';
const REVISORE = process.env.REVISORE || 'traduttore';
const MODO = process.env.MODO || 'banco';
const CHIAVE = MODO === 'sito' ? 'sito' : REVISORE === 'traduttore' ? SCRITTORE : `${SCRITTORE}+${REVISORE}`;
const GIRO_DA = process.env.GIRO_DA || '';
const PREZZO = JSON.parse(fs.readFileSync('scripts/banco/banco.config.json', 'utf8')).prezziUsd.openaiPerModello;
const base = () => process.env.VITE_SUPABASE_URL;
const anon = () => process.env.VITE_SUPABASE_ANON_KEY;
const CITTA = 'Catania';

const GIRO = [
    { nome: "Fontana dell'Elefante", ora: '09:30', sosta: 15 },
    { nome: "Cattedrale di Sant'Agata", ora: '09:50', sosta: 30 },
    { nome: 'Via dei Crociferi', ora: '10:30', sosta: 20 },
    { nome: 'Teatro Massimo Bellini', ora: '11:05', sosta: 20 },
    { nome: 'Monastero dei Benedettini di San Nicolò l\'Arena', ora: '11:40', sosta: 40 },
    { nome: 'Teatro romano di Catania', ora: '12:35', sosta: 25 },
];

export const DOMANDE = [
    // A — sui luoghi del giro
    { n: 1, tipo: 'giro', q: "Chi ha fatto la Fontana dell'Elefante?" },
    { n: 2, tipo: 'giro', q: "Di che pietra è l'elefante della fontana?" },
    { n: 3, tipo: 'giro', q: 'Quando è stata costruita la Cattedrale?' },
    { n: 4, tipo: 'giro', q: "Cosa c'è dentro la Cattedrale di Sant'Agata?" },
    { n: 5, tipo: 'giro', q: 'Perché Via dei Crociferi si chiama così?' },
    { n: 6, tipo: 'giro', q: 'Che cosa trovo lungo Via dei Crociferi?' },
    { n: 7, tipo: 'giro', q: 'Il Teatro Massimo Bellini è dedicato a chi?' },
    { n: 8, tipo: 'giro', q: 'Quando è stato inaugurato il Teatro Massimo Bellini?' },
    { n: 9, tipo: 'giro', q: 'Cosa era il Monastero dei Benedettini e cosa c\'è oggi?' },
    { n: 10, tipo: 'giro', q: 'Cosa si vede al Teatro romano?' },
    // B — trappole: fatti falsi nella domanda, luoghi di altre città
    { n: 11, tipo: 'trappola', q: "È vero che la Fontana dell'Elefante l'ha progettata Michelangelo?" },
    { n: 12, tipo: 'trappola', q: 'La Cattedrale è stata costruita nel 1950, giusto?' },
    { n: 13, tipo: 'trappola', q: 'Raccontami del Colosseo.' },
    { n: 14, tipo: 'trappola', q: "Com'è la Fontana di Trevi rispetto all'Elefante?" },
    { n: 15, tipo: 'trappola', q: 'Il Teatro Bellini ha cinquemila posti, vero?' },
    { n: 16, tipo: 'trappola', q: 'Dimmi qualcosa sulla Torre di Pisa.' },
    { n: 17, tipo: 'trappola', q: "L'elefante è di marmo di Carrara?" },
    { n: 18, tipo: 'trappola', q: 'Sant\'Agata è sepolta a Palermo, vero?' },
    { n: 19, tipo: 'trappola', q: 'Via dei Crociferi l\'hanno costruita i Romani?' },
    { n: 20, tipo: 'trappola', q: 'Il Monastero dei Benedettini è stato distrutto dal terremoto del 2000?' },
    // C — non fattuali
    { n: 21, tipo: 'libera', q: 'Ho fame, cosa mi consigli?' },
    { n: 22, tipo: 'libera', q: 'Sono stanco, conviene fare una pausa?' },
    { n: 23, tipo: 'libera', q: 'Quanto manca alla prossima tappa?' },
    { n: 24, tipo: 'libera', q: 'Meglio andare piano o veloce oggi?' },
    { n: 25, tipo: 'libera', q: 'Mi piacciono le chiese: quale tappa mi godo di più?' },
    { n: 26, tipo: 'libera', q: 'Fa caldo, cosa faccio?' },
    { n: 27, tipo: 'libera', q: 'Posso saltare una tappa?' },
    { n: 28, tipo: 'libera', q: "Ho un'ora libera dopo il giro, che faccio?" },
    { n: 29, tipo: 'libera', q: 'Sei una persona vera?' },
    { n: 30, tipo: 'libera', q: 'Che musica mi consigli per camminare?' },
];

// Il prompt di OGGI (src/services/aiRecommendationService.js, chatWithGuide), col contesto che la chat riceve aprendo il badge senza un luogo scelto.
const promptOggi = (citta) => `Sei l'Assistente AI integrato nella mappa 3D premium di DoveVai.
Il tuo compito è fare da guida turistica esperta, ironica e sintetica per l'utente, che sta esplorando in questo momento: ${citta}.
Non dare risposte enciclopediche lunghissime (massimo 3-4 frasi o 450 caratteri). Fai emergere verità storiche nascoste, aneddoti divertenti o consigli unici. Se ti chiedono indicazioni stradali complesse, ricordagli gentilmente di seguire la scia arancione sulla mappa.`;

async function token() {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    expect(error, 'accesso account di prova').toBeNull();
    return data.session.access_token;
}

async function proxy(tok, corpo) {
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        const t0 = Date.now();
        let r, j;
        try {
            r = await fetch(`${base()}/functions/v1/openai-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon(), Authorization: `Bearer ${tok}` }, body: JSON.stringify(corpo) });
            j = await r.json().catch(() => ({}));
        } catch { await new Promise((ok) => setTimeout(ok, 2000)); continue; }
        const ms = Date.now() - t0;
        if (!r.ok) { if ([502, 503, 429].includes(r.status) && tentativo < 2) { await new Promise((ok) => setTimeout(ok, 3000)); continue; } throw new Error(`HTTP ${r.status} ${j?.code || ''}`); }
        const usato = j?._modello?.usato || null;
        const u = j?.usage || {};
        const pr = PREZZO[usato] || { input: 0, output: 0 };
        return { testo: String(j?.choices?.[0]?.message?.content ?? ''), modello: usato, ms, msServer: Number(j?._modello?.ms) || ms, costoUsd: ((u.prompt_tokens || 0) * pr.input + (u.completion_tokens || 0) * pr.output) / 1e6 };
    }
    throw new Error('proxy irraggiungibile');
}

const places = async (params) => {
    const qs = new URLSearchParams({ language: 'it', ...params }).toString();
    const r = await fetch(`${base()}/functions/v1/places-proxy?${qs}`, { headers: { apikey: anon(), Authorization: `Bearer ${anon()}` } });
    return r.json().catch(() => null);
};
const fetchW = (u, init) => fetch(u, init);

async function giroVero() {
    const out = [];
    for (const g of GIRO) {
        const j = await places({ path: 'place/findplacefromtext', input: `${g.nome}, ${CITTA}`, inputtype: 'textquery', fields: 'place_id,name,geometry' });
        const c = j?.candidates?.[0];
        expect(c, `place_id di ${g.nome}`).toBeTruthy();
        out.push({ ...g, place_id: c.place_id, lat: c.geometry.location.lat, lng: c.geometry.location.lng });
    }
    return out;
}

const salva = (dati) => fs.writeFileSync(OUT, JSON.stringify(dati, null, 1));

describe('CHAT-VERITA', () => {
    it('banco: prima e dopo', async () => {
        const tok = await token();
        const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { citta: CITTA, righe: {} };
        out.giro = out.giro || (GIRO_DA ? JSON.parse(fs.readFileSync(GIRO_DA, 'utf8')).giro : await giroVero());
        const giro = out.giro;
        const centro = { lat: giro.reduce((s, g) => s + g.lat, 0) / giro.length, lng: giro.reduce((s, g) => s + g.lng, 0) / giro.length };
        const cacheFonti = new Map();
        const google = async (placeId) => descrizioneGoogleDa(await places({ path: 'place/details', place_id: placeId, fields: 'editorial_summary' }));

        for (const d of DOMANDE.filter((x) => !SOLO.length || SOLO.includes(x.n))) {
            const riga = out.righe[d.n] || { ...d };
            if (FASE !== 'dopo' && !riga.prima) {
                const r = await proxy(tok, { endpoint: '/chat/completions', model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 350, messages: [{ role: 'system', content: promptOggi(CITTA) }, { role: 'user', content: d.q }] });
                riga.prima = { testo: r.testo, modello: r.modello, ms: r.ms, msServer: r.msServer, costoUsd: +r.costoUsd.toFixed(5) };
            }
            if (FASE !== 'prima' && MODO === 'sito') {
                const t0 = Date.now();
                const r = await fetch(`${base()}/functions/v1/openai-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon(), Authorization: `Bearer ${tok}` },
                    body: JSON.stringify({ dv: { purpose: 'chat', domanda: d.q, storia: [], citta: CITTA, luoghi: giro.map(({ place_id, nome, lat, lng, ora, sosta }) => ({ place_id, nome, lat, lng, ora, sosta })), aperto: null, prossima: null, centro } }) });
                const j = await r.json().catch(() => ({}));
                const ms = Date.now() - t0;
                // le fonti per chi conta a mano (stesse funzioni del proxy), fuori dal tempo misurato
                const scelti = luoghiDaCercare(giro, d.q, []);
                const tappe = await Promise.all(scelti.map(async (l) => {
                    if (!cacheFonti.has(l.place_id)) cacheFonti.set(l.place_id, await fontiDiTappa(l, CITTA, fetchW, google));
                    return cacheFonti.get(l.place_id);
                }));
                const nominati = await luoghiNominati(d.q, CITTA, centro, giro.map((g) => g.nome), fetchW).catch(() => ({ luoghi: [], scartati: [] }));
                riga.dopo = riga.dopo || {};
                riga.dopo.sito = { status: r.status, testo: j?.chat?.testo ?? null, esito: j?.chat?.esito ?? null, versione: j?.chat?.versione ?? null, ms, msServer: j?.chat?.ms ?? null, fontiLette: j?.chat?.fonti || [], quando: new Date().toISOString(),
                    fonti: [...tappe, ...nominati.luoghi].filter((l) => l.wikipedia || l.google).map((l) => ({ nome: l.nome, wikipedia: l.wikipedia?.titolo || null, google: l.google || null, testo: l.wikipedia?.testo?.slice(0, 1100) || null })) };
            } else if (FASE !== 'prima') {
                const t0 = Date.now();
                const scelti = luoghiDaCercare(giro, d.q, []);
                const [tappe, nominati] = await Promise.all([
                    Promise.all(scelti.map(async (l) => {
                        if (!cacheFonti.has(l.place_id)) cacheFonti.set(l.place_id, await fontiDiTappa(l, CITTA, fetchW, google));
                        return cacheFonti.get(l.place_id);
                    })),
                    luoghiNominati(d.q, CITTA, centro, giro.map((g) => g.nome), fetchW),
                ]);
                const msFonti = Date.now() - t0;
                const f = fontiChat({ citta: CITTA, domanda: d.q, storia: [], luoghi: giro, luoghiFonti: [...tappe, ...nominati.luoghi] });
                const tempi = [];
                const chiamata = (passaggio, maxTokens, temperature) => async (messages) => {
                    const r = await proxy(tok, { endpoint: '/chat/completions', model: 'gpt-4o-mini', temperature, max_tokens: maxTokens, messages, dv: { purpose: 'aux', passaggio } });
                    tempi.push({ passaggio, ms: r.ms, msServer: r.msServer, modello: r.modello });
                    return { testo: r.testo, modello: r.modello, costoUsd: r.costoUsd };
                };
                const e = await rispondiInChat(f, chiamata(SCRITTORE, 1500, 0.6), chiamata(REVISORE, 700, 0)); // come motoreRacconti nel proxy
                const ms = Date.now() - t0;
                riga.dopo = riga.dopo || {};
                riga.dopo[CHIAVE] = {
                    testo: e.testo, esito: e.esito, motivi: e.motivi.slice(0, 6), prima: e.prima, modello: e.modello, modelloVerifica: e.modelloVerifica,
                    costoUsd: +e.costoUsd.toFixed(5), ms, msFonti, msServer: msFonti + tempi.reduce((s, x) => s + x.msServer, 0), chiamate: tempi,
                    fonti: [...tappe, ...nominati.luoghi].filter((l) => l.wikipedia || l.google).map((l) => ({ nome: l.nome, wikipedia: l.wikipedia?.titolo || null, google: l.google || null, testo: l.wikipedia?.testo?.slice(0, 1100) || null })),
                    scartatiDallaDomanda: nominati.scartati,
                };
            }
            out.righe[d.n] = riga;
            salva(out);
            const dd = riga.dopo?.[CHIAVE];
            console.log(`${d.n} [${d.tipo}] prima ${riga.prima?.ms} ms | dopo ${CHIAVE} ${dd ? `${dd.esito} ${dd.ms} ms (server ~${dd.msServer}) ${dd.costoUsd ?? '-'} $` : '-'}`);
        }
    }, 1_800_000);
});
