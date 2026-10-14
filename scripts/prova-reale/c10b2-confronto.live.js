// C10b2 — il confronto fra i due modelli, solo sulla lista della città (niente tour).
//   · gpt-6.1-sol: la lista vera `c10b-3` chiesta al proxy in produzione (abitanti + lista + verifica su Google), salvata in
//     city_knowledge: il giro la riusa. Si misurano tempo, token, chiamate Google.
//   · gpt-4o-mini: la lista `c10b-2` di oggi (stesso prompt di citta' e metropoli), gia' in city_knowledge: non si rifa'.
//   · la scala «a parole» (senza la regola degli abitanti): una chiamata minima per modello e per citta'.
// Account di prova, credenziali solo da .env.local. Scrive PROVA_OUT.
//   PROVA_OUT=docs/prove/dati/…json npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/c10b2-confronto.live.js
import { it, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { supabase } from '@/lib/supabase';

const CITTA = (process.env.PROVA_CITTA || 'Catania,Roma,Napoli,Palermo,Lecce,Troina').split(',');
const GIORNO = process.env.PROVA_GIORNO || '2026-10-15';
const out = { avvio: new Date().toISOString(), giorno: GIORNO, liste: [], scalaAParole: [] };
const salva = () => writeFileSync(process.env.PROVA_OUT, JSON.stringify(out, null, 1));

// la scala chiesta a parole, come nel prompt c10b-1 (definizioni, nessun numero)
const SCALA_A_PAROLE = (citta) => `Decidi la SCALA di ${citta}:
- "borgo": un paese che si gira tutto a piedi in mezza giornata;
- "città": un centro che si gira a piedi in una giornata;
- "metropoli": una città troppo grande per una giornata a piedi, fatta di quartieri camminabili, ognuno con i suoi simboli.
Rispondi SOLO con un JSON {"scala": "borgo|città|metropoli"}.`;

let token = null;
const proxy = async (body) => {
    const t0 = Date.now();
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    return { status: res.status, ms: Date.now() - t0, j };
};

beforeAll(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error) throw new Error('login dell\'account di prova fallito');
    token = data.session.access_token;
});
afterAll(async () => { out.fine = new Date().toISOString(); salva(); await supabase.auth.signOut(); });

it('le liste con gpt-6.1-sol e la scala a parole dei due modelli', async () => {
    for (const citta of CITTA) {
        // 1) la lista vera (c10b-3), dal proxy in produzione
        const r = await proxy({ dv: { purpose: 'city_list', citta, giorno: GIORNO } });
        const k = r.j?.cityKnowledge || {};
        out.liste.push({ citta, status: r.status, ms: r.ms, cached: k.cached ?? null, scala: k.scala ?? null, abitanti: k.centro?.abitanti ?? null,
            conti: k.conti ?? null, google: k.google ?? null, modelli: k.modelli ?? null, msServer: k.ms ?? null,
            verificati: (k.verificati || []).map(v => ({ nome: v.name, tipo: v._citta?.tipo, quartiere: v._citta?.quartiere ?? null, simbolo: !!v._citta?.simbolo, sostituzione: v._citta?.sostituzione ?? null })) });
        console.log(`[confronto] ${citta}: ${r.status} in ${(r.ms / 1000).toFixed(1)} s, ${k.cached ? 'dal server' : 'nuova'}, scala ${k.scala}, ${k.conti?.verificati}/${k.conti?.proposti} verificati, modelli ${JSON.stringify((k.modelli || []).map(m => `${m.cosa}:${m.usato}${m.ripiego ? '(ripiego)' : ''}`))}`);
        salva();
        // 2) la scala a parole: gpt-4o-mini (senza passaggio) e gpt-6.1-sol (passaggio 'lista')
        for (const [modello, dv] of [['gpt-4o-mini', { purpose: 'aux' }], ['gpt-6.1-sol', { purpose: 'aux', passaggio: 'lista' }]]) {
            const s = await proxy({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 60, response_format: { type: 'json_object' },
                messages: [{ role: 'system', content: SCALA_A_PAROLE(citta) }, { role: 'user', content: `Città: ${citta}.` }], dv });
            let scala = null; try { scala = JSON.parse(s.j?.choices?.[0]?.message?.content || '{}').scala ?? null; } catch { /* */ }
            out.scalaAParole.push({ citta, modello, usato: s.j?._modello?.usato ?? 'gpt-4o-mini', ripiego: !!s.j?._modello?.ripiego, scala, ms: s.ms, usage: s.j?.usage ? { in: s.j.usage.prompt_tokens, out: s.j.usage.completion_tokens } : null });
        }
        console.log(`[confronto] ${citta}: scala a parole ${out.scalaAParole.filter(x => x.citta === citta).map(x => `${x.modello}=${x.scala}`).join(', ')}`);
        salva();
    }
});
