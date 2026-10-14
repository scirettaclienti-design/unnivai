// C10b3-ter — FASE A: solo le liste (c10b-7, variante C: prima gli imperdibili), nell'ordine chiesto (PROVA_CITTA).
// Per ogni città: quote rispettate, simbolo, essenziali delle liste di controllo trovati, inventati (%), tempo e costo.
// La lista si salva in city_knowledge: il giro della fase B la riusa. Account di prova, credenziali solo da .env.local.
//   PROVA_OUT=docs/prove/dati/…json npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/c10b3ter-liste.live.js
import { it, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { supabase } from '@/lib/supabase';
import { ESSENZIALI_CONTROLLO, simboloGiusto } from '../banco/asticella-c10.js';

const CITTA = (process.env.PROVA_CITTA || 'Catania,Roma,Napoli,Palermo,Lecce,Troina').split(',');
const GIORNO = process.env.PROVA_GIORNO || '2026-10-15';
const out = { versione: 'c10b-7', avvio: new Date().toISOString(), giorno: GIORNO, liste: [] };
const salva = () => writeFileSync(process.env.PROVA_OUT, JSON.stringify(out, null, 1));

let token = null;
beforeAll(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error) throw new Error('login dell\'account di prova fallito');
    token = data.session.access_token;
});
afterAll(async () => { out.fine = new Date().toISOString(); salva(); await supabase.auth.signOut(); });

it('le liste bilanciate delle 6 città', async () => {
    for (const citta of CITTA) {
        const t0 = Date.now();
        const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
            body: JSON.stringify({ dv: { purpose: 'city_list', citta, giorno: GIORNO } }),
        });
        const ms = Date.now() - t0;
        const j = await res.json().catch(() => null);
        const k = j?.cityKnowledge || {};
        const ver = k.verificati || [];
        const controllo = ESSENZIALI_CONTROLLO[citta] || [];
        const trovati = controllo.filter(([, rx]) => ver.some(v => rx.test(v.name || ''))).map(([n]) => n);
        const mancanti = controllo.map(([n]) => n).filter(n => !trovati.includes(n));
        out.liste.push({
            citta, status: res.status, ms, cached: k.cached ?? null, scala: k.scala ?? null, conti: k.conti ?? null, google: k.google ?? null,
            modelli: k.modelli ?? null, msServer: k.ms ?? null, quote: k.quote ?? null,
            simboli: ver.filter(v => v._citta?.simbolo).map(v => ({ nome: v.name, categoria: v._citta?.categoria ?? null, quartiere: v._citta?.quartiere ?? null, dedotto: !!v._citta?.simboloDedotto })),
            essenzialiControllo: { trovati, mancanti, totale: controllo.length },
            simboloAtteso: simboloGiusto(ver.filter(v => v._citta?.simbolo).map(v => ({ nome: v.name, dedotto: !!v._citta?.simboloDedotto })), citta),
            verificati: ver.map(v => ({ nome: v.name, tipo: v._citta?.tipo, categoria: v._citta?.categoria ?? null, momento: v._citta?.momento, quartiere: v._citta?.quartiere ?? null,
                simbolo: !!v._citta?.simbolo, passeggiata: !!v._citta?.passeggiata, completamento: !!v._citta?.completamento, ancoraDalCompletamento: !!v._citta?.ancoraDalCompletamento, imperdibile: !!v._citta?.imperdibile, primaryType: v.primary_type ?? v.primaryType ?? null })),
        });
        console.log(`[fase A] ${citta}: ${res.status} in ${(ms / 1000).toFixed(1)} s, ${k.cached ? 'dal server' : 'nuova'}, scala ${k.scala}, ${k.conti?.verificati}/${k.conti?.proposti} verificati, essenziali ${trovati.length}/${controllo.length}, simboli ${out.liste.at(-1).simboli.map(s => s.nome).join(', ') || '—'}, simbolo atteso ${out.liste.at(-1).simboloAtteso.ok ? 'sì' : 'NO'}, modelli ${(k.modelli || []).map(m => `${m.cosa}:${m.usato}${m.ripiego ? '(ripiego)' : ''}`).join(' ')}`);
        salva();
    }
});
