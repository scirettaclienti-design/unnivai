// REVISORE-FORTE — Haiku 4.5 contro Sonnet 5.5 come revisore dei racconti, sugli STESSI testi e le STESSE fonti congelate
// (docs/prove/dati/2026-11-02-revisore-forte-corpus.json, fatto da revisore-forte-corpus.mjs). Solo misura: nessun deploy, nessun secret.
// Prompt del revisore = quello di produzione: `messaggiVerifica` / `leggiVerifica` di supabase/functions/openai-proxy/racconto.ts
// (importato dal repo, commit di racconto.ts: bd32e7c; HEAD della prova: 5d14ed5). Corpo come in index.ts `rivedi`: temperature 0, max_tokens 700.
// Strada: il proxy pubblicato con `dv.purpose = 'aux'`; il passaggio sceglie il modello senza toccare i secret:
//   `traduttore` → catena Haiku (primo claude-haiku-4-5), `narratore` → claude-sonnet-5-5. Il modello vero è in `_modello.usato` e si registra.
// Il percorso `racconto` del proxy NON si chiama (scriverebbe in public.place_racconti). Credenziali dell'account di prova: mai stampate.
//   FASE=sonda  npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/revisore-forte.live.js
//   FASE=misura LANCI=3 CONC=4 npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/revisore-forte.live.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { supabase } from '@/lib/supabase';
import { messaggiVerifica, leggiVerifica } from '../../supabase/functions/openai-proxy/racconto.ts';

const FASE = process.env.FASE || 'misura';
const LANCI = Number(process.env.LANCI || 3);
const CONC = Number(process.env.CONC || 4);
const IN = 'docs/prove/dati/2026-11-02-revisore-forte-corpus.json';
const OUT = 'docs/prove/dati/2026-11-02-revisore-forte-misura.json';
const PASSAGGIO = { 'haiku-4.5': 'traduttore', 'sonnet-5.5': 'narratore' };
const ATTESO = { 'haiku-4.5': 'claude-haiku-4-5', 'sonnet-5.5': 'claude-sonnet-5-5' };
const PREZZO = JSON.parse(fs.readFileSync('scripts/banco/banco.config.json', 'utf8')).prezziUsd.openaiPerModello; // $ per milione di token
const base = () => process.env.VITE_SUPABASE_URL;
const anon = () => process.env.VITE_SUPABASE_ANON_KEY;

async function token() {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    expect(error, 'accesso account di prova').toBeNull();
    return data.session.access_token;
}

async function chiama(modello, tok, messages) {
    let ultimo = null;
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        const t0 = Date.now();
        let r, j;
        try {
            r = await fetch(`${base()}/functions/v1/openai-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: anon(), Authorization: `Bearer ${tok}` },
                body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', temperature: 0, max_tokens: 700, messages, dv: { purpose: 'aux', passaggio: PASSAGGIO[modello] } }),
            });
            j = await r.json().catch(() => ({}));
        } catch (e) { ultimo = { errore: 'rete' }; await new Promise((ok) => setTimeout(ok, 2000)); continue; }
        const ms = Date.now() - t0;
        if (!r.ok) { ultimo = { errore: `HTTP ${r.status} ${j?.code || ''}`, ms }; if ([502, 503, 429].includes(r.status) && tentativo < 2) { await new Promise((ok) => setTimeout(ok, 3000)); continue; } break; }
        const usato = j?._modello?.usato || null;
        const u = j?.usage || {};
        const pr = PREZZO[usato] || { input: 0, output: 0 };
        return { testo: j?.choices?.[0]?.message?.content ?? '', usato, ripiego: !!j?._modello?.ripiego, motivoRipiego: j?._modello?.motivo || null, promptTok: u.prompt_tokens || 0, outTok: u.completion_tokens || 0,
            costoUsd: ((u.prompt_tokens || 0) * pr.input + (u.completion_tokens || 0) * pr.output) / 1e6, ms, tentativi: tentativo + 1 };
    }
    return ultimo || { errore: 'irraggiungibile' };
}

describe('revisore forte', () => {
    it.runIf(FASE === 'sonda')('sonda: quale modello risponde a ciascun passaggio e quanto costa un racconto', async () => {
        const tok = await token();
        const c = JSON.parse(fs.readFileSync(IN, 'utf8')).testi[0];
        for (const m of Object.keys(PASSAGGIO)) {
            const r = await chiama(m, tok, messaggiVerifica(c.testo, c.fonti));
            const e = leggiVerifica(r.testo, c.testo);
            console.log(JSON.stringify({ m, usato: r.usato, ripiego: r.ripiego, errore: r.errore, ms: r.ms, promptTok: r.promptTok, outTok: r.outTok, costoUsd: r.costoUsd, ok: e.ok, leggibile: e.frasi.length > 0 }));
        }
    }, 120_000);

    it.runIf(FASE === 'misura')('revisore: due modelli, LANCI lanci, stessi testi', async () => {
        const tok = await token();
        const testi = JSON.parse(fs.readFileSync(IN, 'utf8')).testi;
        const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { promptDa: 'racconto.ts bd32e7c (HEAD 5d14ed5)', righe: [] };
        const fatto = new Set(out.righe.map((r) => `${r.modello}|${r.lancio}|${r.id}`));
        for (let l = 1; l <= LANCI; l++) {
            for (const modello of Object.keys(PASSAGGIO)) {
                const coda = testi.filter((t) => !fatto.has(`${modello}|${l}|${t.id}`));
                let i = 0;
                await Promise.all(Array.from({ length: CONC }, async () => {
                    while (i < coda.length) {
                        const t = coda[i++];
                        const r = await chiama(modello, tok, messaggiVerifica(t.testo, t.fonti));
                        const e = r.errore ? { ok: false, frasi: [], motivi: [r.errore] } : leggiVerifica(r.testo, t.testo);
                        out.righe.push({ modello, lancio: l, id: t.id, ...r, ok: e.ok, frasi: e.frasi, leggibile: e.frasi.length > 0 });
                    }
                }));
                fs.writeFileSync(OUT, JSON.stringify(out));
                const mie = out.righe.filter((r) => r.modello === modello && r.lancio === l);
                console.log(`${modello} L${l}: ${mie.length} testi, passati ${mie.filter((r) => r.ok).length}, errori ${mie.filter((r) => r.errore).length}, usato ${[...new Set(mie.map((r) => r.usato))].join(',')}`);
            }
        }
    }, 3_600_000);
});
