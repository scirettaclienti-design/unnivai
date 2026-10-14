// C10b2 — il modello del passaggio arriva davvero dal proxy (≈ 0,001 $): una chiamata minima di contorno col passaggio
// 'traduttore', con l'account di prova. Stampa solo quale modello ha risposto, se ha ripiegato, e i token.
//   npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/c10b2-modello.live.js
import { it, beforeAll, afterAll, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error) throw new Error('login dell\'account di prova fallito');
});
afterAll(async () => { await supabase.auth.signOut(); });

it('il passaggio traduttore risponde col modello configurato', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const t0 = Date.now();
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 60, response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: 'Rispondi SOLO con un JSON {"abitanti": numero}' }, { role: 'user', content: 'Comune: Troina.' }],
            dv: { purpose: 'aux', passaggio: 'traduttore' } }),
    });
    const j = await res.json();
    console.log(`[c10b2] HTTP ${res.status} in ${Date.now() - t0} ms | _modello ${JSON.stringify(j?._modello)} | risposta ${String(j?.choices?.[0]?.message?.content).slice(0, 40)} | usage ${JSON.stringify(j?.usage && { in: j.usage.prompt_tokens, out: j.usage.completion_tokens })}`);
    expect(res.status).toBe(200);
});
