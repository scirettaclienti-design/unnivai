// C10b — sonda del prompt della lista (≈ 0,01 $): chiede SOLO le risposte dell'AI (abitanti → scala, poi quartieri e
// simbolo) per le città del giro, con i prompt veri (promptScala, promptCitta) ma SENZA la verifica su Google (la parte
// cara, 0,035 $ a nome). Passa da openai-proxy come chiamata di contorno, con l'account di prova. Niente va in city_knowledge.
//   PROVA_OUT=/percorso/risultato.json npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/c10b-scala.live.js
import { it, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { supabase } from '@/lib/supabase';
import { promptCitta, promptScala, leggiAbitanti, scalaDaAbitanti, leggiLista } from '../../supabase/functions/openai-proxy/cityKnowledge.ts';

const CITTA = (process.env.PROVA_CITTA || 'Roma,Napoli,Catania,Palermo,Lecce,Troina').split(',');
const GIORNO = process.env.PROVA_GIORNO || '2026-10-15';
const out = { giorno: GIORNO, citta: [] };

beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error) throw new Error('login dell\'account di prova fallito');
});
afterAll(async () => { if (process.env.PROVA_OUT) writeFileSync(process.env.PROVA_OUT, JSON.stringify(out, null, 1)); await supabase.auth.signOut(); });

it('la scala, i quartieri e il simbolo proposti dall\'AI', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const chiama = async (messages, max_tokens, temperature) => {
        const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', temperature, max_tokens, response_format: { type: 'json_object' }, messages }),
        });
        return res.json();
    };
    for (const citta of CITTA) {
        // come il proxy: 1) gli abitanti → la scala (codice); 2) la lista col prompt della scala
        const ps = promptScala(citta);
        const a = await chiama([{ role: 'system', content: ps.system }, { role: 'user', content: ps.user }], 60, 0);
        const abitanti = leggiAbitanti(a?.choices?.[0]?.message?.content);
        const scala = scalaDaAbitanti(abitanti);
        const { system, user } = promptCitta(citta, GIORNO, scala);
        const j = await chiama([{ role: 'system', content: system }, { role: 'user', content: user }], 3500, 0.2);
        const posti = leggiLista(j?.choices?.[0]?.message?.content, citta, scala);
        out.citta.push({ citta, abitanti, scala, usage: [a?.usage ?? null, j?.usage ?? null],
            posti: posti.map(p => ({ nome: p.nome, tipo: p.tipo, quartiere: p.quartiere ?? null, simbolo: !!p.simbolo, dedotto: !!p.simboloDedotto })) });
        const quartieri = [...new Set(posti.map(p => p.quartiere).filter(Boolean))];
        const simboli = posti.filter(p => p.simbolo).map(p => `${p.nome}${p.quartiere ? ` [${p.quartiere}]` : ''}${p.simboloDedotto ? ' (dedotto)' : ''}`);
        console.log(`[sonda] ${citta}: ${abitanti} abitanti → ${scala}, ${posti.length} posti${quartieri.length ? `, quartieri: ${quartieri.join(', ')}` : ''}; simboli: ${simboli.join(' | ')}`);
    }
});
