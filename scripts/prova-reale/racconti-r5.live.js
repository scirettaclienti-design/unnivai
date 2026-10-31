// RACCONTI DI TAPPA r5 — prima (r4 com'è su main e in produzione: modulo intero, controllo compreso) e dopo (r5: «7.000» è un numero e la
// riscrittura scatta anche sugli scarti del controllo automatico), stessi due controlli e stesso revisore,
// 13 tappe di Catania e Troina (fonti identiche ai report precedenti, da docs/prove/dati/2026-10-28-racconti-tappa.json) e 10 tappe di Roma
// (le stesse fonti congelate di RACCONTO-R4, docs/prove/dati/2026-10-30-fonti-roma.json: qui non si riprendono). Rete vera, account di prova.
//   FASE=sonda      npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/racconti-r5.live.js
//   FASE=misura LANCI=3 npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/racconti-r5.live.js
// Scrittura e revisione passano dal proxy pubblicato con `dv.purpose = 'aux'`: passaggio `narratore` (Sonnet 5.5, come il narratore del racconto)
// e `traduttore` (Haiku 4.5, lo stesso modello del revisore; il modello vero di ogni risposta è nel grezzo). Il percorso `racconto` del proxy NON si
// chiama: scriverebbe righe in public.place_racconti in produzione. La logica è la stessa del proxy: `scriviERivedi` di racconto.ts.
// Il modulo r4 si legge dal commit fc4c4aa (main prima di r5). Le credenziali dell'account di prova non si stampano.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { supabase } from '@/lib/supabase';
import { scriviERivedi, haFonti, VERSIONE_RACCONTO } from '../../supabase/functions/openai-proxy/racconto.ts';

const COMMIT_R4 = 'fc4c4aa';
const FASE = process.env.FASE || 'misura';
const LANCI = Number(process.env.LANCI || 3);
const F_CATANIA = 'docs/prove/dati/2026-10-28-racconti-tappa.json';
const F_ROMA = 'docs/prove/dati/2026-10-30-fonti-roma.json';
const OUT = 'docs/prove/dati/2026-10-31-racconti-r5.json';
const PREZZO = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-haiku-5-5': [0.1, 0.5] };
const base = () => process.env.VITE_SUPABASE_URL;
const anon = () => process.env.VITE_SUPABASE_ANON_KEY;

async function token() {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    expect(error, 'accesso account di prova').toBeNull();
    return data.session.access_token;
}

/** Una chiamata al proxy pubblicato: { testo, modello, costoUsd, ms }. Lancia un errore se il proxy non risponde 200 (come il proxy vero: niente esito). */
function chiamata(passaggio, tok, extra, log) {
    return async (messages) => {
        for (let tentativo = 0; tentativo < 3; tentativo++) {
            const t0 = Date.now();
            const r = await fetch(`${base()}/functions/v1/openai-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: anon(), Authorization: `Bearer ${tok}` },
                body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', max_tokens: 1500, messages, dv: { purpose: 'aux', passaggio }, ...extra }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
                if ((r.status === 502 || r.status === 503) && tentativo < 2) { await new Promise((ok) => setTimeout(ok, 2000)); continue; }
                throw new Error(`proxy ${passaggio}: HTTP ${r.status} ${j?.code || ''}`);
            }
            const usato = j?._modello?.usato || null;
            const [pi, po] = PREZZO[usato] || PREZZO['claude-sonnet-5-5'];
            const out = { testo: j?.choices?.[0]?.message?.content ?? '', modello: usato, costoUsd: j?.usage ? ((j.usage.prompt_tokens || 0) * pi + (j.usage.completion_tokens || 0) * po) / 1e6 : 0, ms: Date.now() - t0 };
            log?.push({ passaggio, ...out, quota: r.headers.get('x-ratelimit-remaining') ?? r.headers.get('x-quota-remaining') });
            return out;
        }
        throw new Error('irraggiungibile');
    };
}

/** Il modulo r4 com'è su main prima di r5 (prompt, controllo e riscrittura), letto dal commit. */
async function moduloR4() {
    const dir = path.resolve('node_modules/.cache/racconto-r4');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'racconto.ts');
    fs.writeFileSync(f, execSync(`git show ${COMMIT_R4}:supabase/functions/openai-proxy/racconto.ts`, { encoding: 'utf8' }));
    const m = await import(/* @vite-ignore */ f);
    expect(m.VERSIONE_RACCONTO).toBe('r4');
    return m;
}

function tappe() {
    const ct = JSON.parse(fs.readFileSync(F_CATANIA, 'utf8')).esiti.map((e) => ({ citta: e.citta, nome: e.nome, fonti: e.fonti, wikipediaTitolo: e.wikipediaTitolo || null }));
    const rm = fs.existsSync(F_ROMA) ? JSON.parse(fs.readFileSync(F_ROMA, 'utf8')).tappe.map((e) => ({ citta: 'Roma', nome: e.nome, fonti: e.fonti, wikipediaTitolo: e.wikipediaTitolo || null })) : [];
    return [...ct, ...rm];
}

describe('racconti r5', () => {
    it.runIf(FASE === 'sonda')('sonda: quale modello risponde a narratore e traduttore, e la quota', async () => {
        const tok = await token();
        const log = [];
        await chiamata('traduttore', tok, { temperature: 0, max_tokens: 50 }, log)([{ role: 'user', content: 'Rispondi solo: ok' }]);
        await chiamata('narratore', tok, { max_tokens: 50 }, log)([{ role: 'user', content: 'Rispondi solo: ok' }]);
        console.log(JSON.stringify(log.map(({ passaggio, modello, quota, ms }) => ({ passaggio, modello, quota, ms }))));
    }, 120_000);

    it.runIf(FASE === 'misura')('prima (r4) e dopo (r5), LANCI volte', async () => {
        expect(VERSIONE_RACCONTO).toBe('r5');
        const R4 = await moduloR4();
        const tok = await token();
        const elenco = tappe();
        expect(elenco.length).toBe(23);
        const lanci = [];
        for (let l = 1; l <= LANCI; l++) {
            const righe = [];
            for (const t of elenco) {
                const riga = { lancio: l, citta: t.citta, nome: t.nome, wikipediaTitolo: t.wikipediaTitolo, fonti: t.fonti };
                if (!haFonti(t.fonti)) { riga.prima = { esito: 'senza-fonti' }; riga.dopo = { esito: 'senza-fonti' }; righe.push(riga); continue; }
                const logP = [], logD = [];
                const p = await R4.scriviERivedi(t.fonti, chiamata('narratore', tok, { temperature: 0.6 }, logP), chiamata('traduttore', tok, { temperature: 0, max_tokens: 700 }, logP));
                riga.prima = { ...p, esito: p.ok ? 'passato' : 'scartato', chiamate: logP.map(({ passaggio, modello, ms, costoUsd }) => ({ passaggio, modello, ms, costoUsd })) };
                const d = await scriviERivedi(t.fonti, chiamata('narratore', tok, { temperature: 0.6 }, logD), chiamata('traduttore', tok, { temperature: 0, max_tokens: 700 }, logD));
                riga.dopo = { ...d, esito: d.ok ? 'passato' : 'scartato', chiamate: logD.map(({ passaggio, modello, ms, costoUsd }) => ({ passaggio, modello, ms, costoUsd })) };
                console.log(`L${l} ${t.citta} · ${t.nome}: prima ${riga.prima.esito}${p.riscritto ? ' (riscritto)' : ''} · dopo ${riga.dopo.esito}${d.riscritto ? ' (riscritto)' : ''}`);
                righe.push(riga);
            }
            lanci.push(righe);
            fs.writeFileSync(OUT, JSON.stringify({ commitR4: COMMIT_R4, versione: VERSIONE_RACCONTO, lanci }, null, 1));
        }
        const conta = (righe, k, citta) => Object.fromEntries(['passato', 'scartato', 'senza-fonti'].map((e) => [e, righe.filter((r) => citta.includes(r.citta) && r[k].esito === e).length]));
        lanci.forEach((righe, i) => console.log(`LANCIO ${i + 1} · Catania/Troina prima ${JSON.stringify(conta(righe, 'prima', ['Catania', 'Troina']))} dopo ${JSON.stringify(conta(righe, 'dopo', ['Catania', 'Troina']))} · Roma prima ${JSON.stringify(conta(righe, 'prima', ['Roma']))} dopo ${JSON.stringify(conta(righe, 'dopo', ['Roma']))}`));
    }, 3_600_000);
});
