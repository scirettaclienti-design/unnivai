// C10b3-ter — FASE A0: le tre varianti del prompt della lista (A, B, C) su liste GREZZE, senza verifica su Google.
// Ogni lista e' una sola chiamata al proxy sul percorso generico (passaggio 'lista': stesso modello, tempo massimo e ripiego
// della lista vera), con l'account di prova; il prompt lo scrive lo stesso modulo del proxy (promptCitta). Niente si salva sul
// server (il percorso generico non scrive city_knowledge). La scala e' quella gia' misurata (Napoli e Roma metropoli, Catania e
// Lecce citta'): niente chiamata degli abitanti. Credenziali solo da .env.local, mai stampate.
//   PROVA_OUT=docs/prove/dati/…json npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/c10b3ter-a0.live.js
import { it, beforeAll, afterAll } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { supabase } from '@/lib/supabase';
import { ESSENZIALI_CONTROLLO, simboloGiusto } from '../banco/asticella-c10.js';
import { promptCitta, leggiLista, quoteLista, normNome } from '../../supabase/functions/openai-proxy/cityKnowledge.ts';

const GIORNO = process.env.PROVA_GIORNO || '2026-10-15';
const CITTA = { Napoli: 'metropoli', Roma: 'metropoli', Catania: 'città', Lecce: 'città' };
const VARIANTI = (process.env.PROVA_VARIANTI || 'A,B,C').split(',');
const RIPETIZIONI = Number(process.env.PROVA_RIPETIZIONI || 2);
const PREZZI = JSON.parse(readFileSync('scripts/banco/banco.config.json', 'utf8')).prezziUsd.openaiPerModello;
const out = { avvio: new Date().toISOString(), giorno: GIORNO, liste: [] };
const salva = () => writeFileSync(process.env.PROVA_OUT, JSON.stringify(out, null, 1));

// parole troppo comuni per dire che due nomi sono lo stesso posto
const COMUNI = new Set(['chiesa', 'museo', 'piazza', 'basilica', 'santa', 'santo', 'nazionale', 'castello', 'palazzo', 'teatro', 'mercato', 'villa', 'giardino', 'monumentale', 'complesso', 'storico']);
const parole = (s) => normNome(s).split(/\s+/).filter(w => w.length >= 4 && !COMUNI.has(w));

let token = null;
beforeAll(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error) throw new Error('login dell\'account di prova fallito');
    token = data.session.access_token;
});
afterAll(async () => { out.fine = new Date().toISOString(); salva(); await supabase.auth.signOut(); });

async function una(variante, citta, rip) {
    const scala = CITTA[citta];
    const { system, user } = promptCitta(citta, GIORNO, scala, variante);
    const t0 = Date.now();
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 3500, response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }], dv: { purpose: 'aux', passaggio: 'lista' } }),
    });
    const ms = Date.now() - t0;
    const j = await res.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content ?? '';
    let grezzi = [];
    try { const p = JSON.parse(content); grezzi = Array.isArray(p?.posti) ? p.posti : []; } catch { /* risposta non leggibile */ }
    const lista = leggiLista(content, citta, scala, variante);
    const q = quoteLista(lista, scala);
    const nomi = grezzi.map(p => String(p?.nome || '')).filter(Boolean);
    const controllo = ESSENZIALI_CONTROLLO[citta] || [];
    const trovati = controllo.filter(([, rx]) => nomi.some(n => rx.test(n))).map(([n]) => n);
    const mancanti = controllo.filter(([n]) => !trovati.includes(n));
    // casi dubbi: un nome della lista che ha una parola distintiva in comune con un essenziale mancante
    const dubbi = mancanti.flatMap(([n]) => nomi.filter(x => parole(x).some(w => parole(n).includes(w))).map(x => ({ essenziale: n, nome: x })));
    const simboli = lista.filter(p => p.simbolo).map(p => ({ nome: p.nome, quartiere: p.quartiere ?? null, dedotto: !!p.simboloDedotto }));
    const sg = simboloGiusto(simboli, citta);
    const usato = j?._modello?.usato ?? 'gpt-4o-mini';
    const u = j?.usage || {};
    const pr = PREZZI[usato] || PREZZI['gpt-4o-mini'];
    const costo = ((u.prompt_tokens || 0) * pr.input + (u.completion_tokens || 0) * pr.output) / 1e6;
    const r = {
        variante, citta, rip, scala, status: res.status, ms, modello: j?._modello ?? null, usage: { in: u.prompt_tokens ?? null, out: u.completion_tokens ?? null }, costo,
        nomiGrezzi: nomi.length, nomiLetti: lista.length,
        essenziali: { trovati, mancanti: mancanti.map(([n]) => n), totale: controllo.length }, dubbi,
        simbolo: sg, simboli, ancore: lista.filter(p => p.tipo === 'essenziale').map(p => p.nome),
        imperdibili: lista.filter(p => p.imperdibile).map(p => p.nome),
        quote: { rispettate: q.rispettate, mancate: q.mancate, mancanti: q.mancanti, visite: q.visite, storiche: q.storiche, ancore: q.ancore, dopocena: q.dopocena, perQuartiere: q.perQuartiere },
        lista: lista.map(p => ({ nome: p.nome, categoria: p.categoria ?? null, tipo: p.tipo, quartiere: p.quartiere ?? null, imperdibile: !!p.imperdibile, simbolo: !!p.simbolo })),
    };
    out.liste.push(r);
    salva();
    console.log(`[A0] ${variante} ${citta} #${rip}: ${res.status} ${(ms / 1000).toFixed(1)} s ${usato}${j?._modello?.ripiego ? ' (ripiego)' : ''} — essenziali ${trovati.length}/${controllo.length}, simbolo ${sg.ok ? 'giusto' : `no (${sg.simbolo ?? '—'})`}, quote mancate ${q.mancate.length}, nomi ${nomi.length}, ${costo.toFixed(4)} $`);
}

it('A0: tre varianti × quattro città × due ripetizioni, liste grezze', async () => {
    // una variante per volta in parallelo (3 richieste insieme), citta' e ripetizioni in fila
    await Promise.all(VARIANTI.map(async (v) => {
        for (let rip = 1; rip <= RIPETIZIONI; rip++) for (const c of Object.keys(CITTA)) await una(v, c, rip);
    }));
}, 3_600_000);
