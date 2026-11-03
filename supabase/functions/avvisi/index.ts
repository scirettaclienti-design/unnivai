/**
 * AVVISI (L6) — Ivano sa quando qualcosa si rompe o i costi salgono.
 *
 * La chiama pg_cron ogni ora (migrazione 20261104090000_avvisi.sql) con pg_net. Ogni esecuzione:
 *   · avviso immediato se il costo stimato di oggi supera la soglia (una volta al giorno);
 *   · avviso immediato se gli errori del proxy superano il 5% nell'ultima ora (una volta per ora, almeno 20 richieste);
 *   · dalle 7 (Europe/Rome) il riepilogo di ieri, una volta sola.
 * La logica è in ../_shared/avvisi.ts (pura, provata dalla suite). Qui solo i collegamenti.
 *
 * Segreti e impostazioni (Supabase → Edge Functions → Secrets; mai nel codice):
 *   AVVISI_CHIAVE             obbligatoria: la stessa che il job di pg_cron legge dal Vault (header x-avvisi-chiave)
 *   RESEND_API_KEY            obbligatoria (la stessa di lista-attesa-email)
 *   AVVISI_EMAIL_A            obbligatoria: l'indirizzo di Ivano, che riceve gli avvisi
 *   AVVISI_SOGLIA_COSTO_USD   facoltativa, di difetto 15
 *   AVVISI_SUPABASE_TOKEN     facoltativa: token personale Supabase per leggere i log (errori del proxy, costo Google).
 *                             Senza, il riepilogo lo dice e gli avvisi sugli errori non partono.
 *   EMAIL_MITTENTE            facoltativa, come lista-attesa-email
 *
 * Corpo: { modo?: 'orario' | 'riepilogo' | 'anteprima', giorno?: 'AAAA-MM-GG' }
 *   orario     (difetto) l'esecuzione oraria
 *   riepilogo  manda subito il riepilogo di `giorno` (difetto: ieri), senza ricordarlo: serve alla prova
 *   anteprima  non manda niente: risponde con oggetto e testo del riepilogo
 * Deploy: supabase functions deploy avvisi --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api
 * Nei log mai l'indirizzo né le chiavi.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
    comporreRiepilogo, eseguiOraria, giornoDopo, giornoPrima, inizioGiornoRoma, partiRoma, SOGLIA_COSTO_USD_DI_DIFETTO,
    type Conteggi, type Dipendenze, type Traffico,
} from '../_shared/avvisi.ts';

export const RESEND_URL = 'https://api.resend.com/emails';
export const MITTENTE_DI_DIFETTO = 'Unnivai <ciao@unnivai.com>';
export const API_GESTIONE = 'https://api.supabase.com/v1/projects';

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Il traffico delle due funzioni nei log, dal `da` al `a`. Qualunque problema → null (mai un numero inventato). */
export async function leggiTrafficoDaiLog(token: string, ref: string, da: Date, a: Date): Promise<Traffico | null> {
    if (!token) return null;
    const sql = `select response.status_code as codice, request.url as url, count(*) as n
from function_edge_logs
cross join unnest(metadata) as m cross join unnest(m.response) as response cross join unnest(m.request) as request
group by codice, url`;
    try {
        const q = new URLSearchParams({ sql, iso_timestamp_start: da.toISOString(), iso_timestamp_end: a.toISOString() });
        const r = await fetch(`${API_GESTIONE}/${ref}/analytics/endpoints/logs.all?${q}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { console.error(`[avvisi] log non letti: ${r.status}`); return null; }
        const righe = ((await r.json()) as { result?: { codice: number | string; url: string; n: number | string }[] }).result;
        if (!Array.isArray(righe)) return null;
        const t: Traffico = { proxyRichieste: 0, proxyErrori: 0, placesChiamate: 0, placesFoto: 0 };
        for (const x of righe) {
            const n = Number(x.n) || 0, cod = Number(x.codice) || 0, url = String(x.url ?? '');
            if (url.includes('/functions/v1/openai-proxy')) { t.proxyRichieste += n; if (cod >= 500) t.proxyErrori += n; }
            else if (url.includes('/functions/v1/places-proxy')) { if (cod === 302) t.placesFoto += n; else if (cod === 200) t.placesChiamate += n; }
        }
        return t;
    } catch { console.error('[avvisi] log non letti: errore di rete'); return null; }
}

serve(async (req: Request) => {
    if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);
    const env = (k: string) => Deno.env.get(k) ?? '';
    const chiave = env('AVVISI_CHIAVE');
    if (!chiave || req.headers.get('x-avvisi-chiave') !== chiave) return json({ errore: 'non autorizzato' }, 401);
    const resend = env('RESEND_API_KEY'), a = env('AVVISI_EMAIL_A');
    if (!resend || !a) { console.error('[avvisi] configurazione mancante: RESEND_API_KEY o AVVISI_EMAIL_A'); return json({ errore: 'configurazione mancante' }, 503); }

    let corpo: { modo?: string; giorno?: string } = {};
    try { corpo = await req.json(); } catch { /* corpo vuoto = orario */ }

    const url = env('SUPABASE_URL');
    const ref = new URL(url).hostname.split('.')[0];
    const db = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const soglia = Number(env('AVVISI_SOGLIA_COSTO_USD')) > 0 ? Number(env('AVVISI_SOGLIA_COSTO_USD')) : SOGLIA_COSTO_USD_DI_DIFETTO;
    const token = env('AVVISI_SUPABASE_TOKEN');

    const leggiConteggi = async (giorno: string): Promise<Conteggi> => {
        const { data, error } = await db.rpc('avvisi_conteggi', { p_giorno: giorno });
        if (error || !data) throw new Error('avvisi_conteggi non riuscita');
        return data as Conteggi;
    };
    const invia = async (m: { oggetto: string; html: string; testo: string }) => {
        const r = await fetch(RESEND_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env('EMAIL_MITTENTE') || MITTENTE_DI_DIFETTO, to: [a], subject: m.oggetto, html: m.html, text: m.testo }),
        });
        if (!r.ok) console.error(`[avvisi] Resend ha risposto ${r.status}`);
        return r.ok;
    };
    const leggiTraffico = (da: Date, fino: Date) => leggiTrafficoDaiLog(token, ref, da, fino);

    try {
        if (corpo.modo === 'riepilogo' || corpo.modo === 'anteprima') {
            const giorno = /^\d{4}-\d{2}-\d{2}$/.test(corpo.giorno ?? '') ? corpo.giorno! : giornoPrima(partiRoma(new Date()).giorno);
            const inizio = inizioGiornoRoma(giorno);
            const m = comporreRiepilogo(await leggiConteggi(giorno), await leggiTraffico(inizio, inizioGiornoRoma(giornoDopo(giorno))));
            if (corpo.modo === 'anteprima') return json({ oggetto: m.oggetto, testo: m.testo });
            return json({ esito: (await invia(m)) ? 'mandato' : 'non riuscito' }, 200);
        }
        const dip: Dipendenze = {
            ora: new Date(), sogliaCostoUsd: soglia, leggiConteggi, leggiTraffico, invia,
            leggiInviati: async () => {
                const { data, error } = await db.from('avvisi_inviati').select('chiave').gte('inviato_at', new Date(Date.now() - 3 * 86_400_000).toISOString());
                if (error) throw new Error('avvisi_inviati non letta');
                return new Set((data ?? []).map((r: { chiave: string }) => r.chiave));
            },
            prendi: async (k) => {
                const { error } = await db.from('avvisi_inviati').insert({ chiave: k });
                return !error; // chiave già presa (23505) o errore: non si manda
            },
            rilascia: async (k) => { await db.from('avvisi_inviati').delete().eq('chiave', k); },
        };
        return json(await eseguiOraria(dip));
    } catch (err) {
        console.error('[avvisi] esecuzione non riuscita:', (err as Error).message);
        return json({ errore: 'esecuzione non riuscita' }, 500);
    }
});
