// RACCONTI DI TAPPA, secondo controllo — le stesse 13 tappe di Catania e Troina del report precedente (fonti identiche, lette da
// docs/prove/dati/2026-10-28-racconti-tappa.json), rete vera, account di prova.
//   npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/racconti-verifica.live.js
// PRIMA: i racconti scritti con la versione r2, rimessi sotto i controlli nuovi (automatico + direzioni + Haiku frase per frase).
// DOPO:  racconti riscritti dal narratore (Sonnet 5.5) col prompt r3, poi gli stessi controlli. Scrive docs/prove/dati/2026-10-29-racconti-verifica.json.
// Il proxy pubblicato è ancora quello vecchio: scrittura e revisione passano da `dv.purpose = 'aux'` con `passaggio` narratore (Sonnet 5.5) e traduttore
// (= Haiku 4.5, verificato con una sonda: è lo stesso modello del revisore; il `selettore` in produzione è Sonnet 5.5, quindi non va bene). Le credenziali dell'account di prova non si stampano.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { supabase } from '@/lib/supabase';
import { messaggiRacconto, controllaRacconto, ripulisciRacconto, messaggiVerifica, leggiVerifica, haFonti } from '../../supabase/functions/openai-proxy/racconto.ts';

const PREZZO = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-haiku-5-5': [0.1, 0.5] };
const VECCHI = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-28-racconti-tappa.json', 'utf8')).esiti;

async function chiama(messaggi, passaggio, token, extra = {}) {
    const t0 = Date.now();
    const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', max_tokens: 1500, messages: messaggi, dv: { purpose: 'aux', passaggio }, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    const usato = j?._modello?.usato || null;
    const [pi, po] = PREZZO[usato] || PREZZO['claude-sonnet-5-5'];
    return {
        ms: Date.now() - t0, http: r.status, testo: j?.choices?.[0]?.message?.content ?? '', modello: usato,
        costoUsd: j?.usage ? ((j.usage.prompt_tokens || 0) * pi + (j.usage.completion_tokens || 0) * po) / 1e6 : 0, errore: r.ok ? null : (j?.error || j?.code || r.status),
    };
}
async function controlla(testo, fonti, token) {
    const auto = controllaRacconto(testo, fonti);
    const out = { auto: { ok: auto.ok, motivi: auto.motivi }, verifica: null, ok: auto.ok, motivi: [...auto.motivi], costoVerificaUsd: 0, msVerifica: 0, modelloVerifica: null };
    if (!auto.ok) return out;
    const v = await chiama(messaggiVerifica(testo, fonti), 'traduttore', token, { temperature: 0, max_tokens: 700 });
    out.costoVerificaUsd = v.costoUsd; out.msVerifica = v.ms; out.modelloVerifica = v.modello;
    if (v.errore) { out.ok = false; out.motivi.push(`revisore non disponibile: ${JSON.stringify(v.errore).slice(0, 80)}`); out.verifica = { errore: true }; return out; }
    const e = leggiVerifica(v.testo, testo);
    out.verifica = { ok: e.ok, frasi: e.frasi, grezzo: v.testo.slice(0, 900) };
    if (!e.ok) { out.ok = false; out.motivi.push(...e.motivi); }
    return out;
}

describe('racconti di tappa: secondo controllo sulle 13 tappe vere', () => {
    it('prima (r2 sotto i controlli nuovi) e dopo (r3 riscritti)', async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
        expect(error, 'accesso account di prova').toBeNull();
        const token = data.session.access_token;
        const righe = [];
        for (const v of VECCHI) {
            const fonti = v.fonti;
            const riga = { citta: v.citta, nome: v.nome, fonti, wikipediaCar: v.wikipediaCar, googleCar: v.googleCar };
            if (!haFonti(fonti)) { riga.prima = { esito: 'senza-fonti' }; riga.dopo = { esito: 'senza-fonti' }; righe.push(riga); continue; }
            // PRIMA — il testo r2 com'era (se allora era passato) sotto i controlli nuovi
            if (v.esito === 'passato') {
                const c = await controlla(v.racconto, fonti, token);
                riga.prima = { esitoR2: 'passato', racconto: v.racconto, nuovo: c, esito: c.ok ? 'passato' : 'scartato' };
            } else riga.prima = { esitoR2: v.esito, racconto: v.racconto || null, esito: v.esito };
            // DOPO — riscritto col prompt r3
            const w = await chiama(messaggiRacconto(fonti), 'narratore', token);
            const testo = ripulisciRacconto(w.testo);
            const c = await controlla(testo, fonti, token);
            riga.dopo = {
                racconto: testo, modello: w.modello, msScrittura: w.ms, costoScritturaUsd: w.costoUsd, costoVerificaUsd: c.costoVerificaUsd,
                costoUsd: +(w.costoUsd + c.costoVerificaUsd).toFixed(5), controllo: c, esito: w.errore ? 'errore' : (c.ok ? 'passato' : 'scartato'),
            };
            righe.push(riga);
        }
        fs.writeFileSync('docs/prove/dati/2026-10-29-racconti-verifica.json', JSON.stringify({ righe }, null, 1));
        const cont = (k) => ['passato', 'scartato', 'senza-fonti'].map(e => `${e} ${righe.filter(r => r[k].esito === e).length}`).join(', ');
        console.log(`PRIMA (r2 sotto i controlli nuovi): ${cont('prima')}`);
        console.log(`DOPO (r3): ${cont('dopo')}`);
        expect(righe.length).toBe(VECCHI.length);
    });
});
