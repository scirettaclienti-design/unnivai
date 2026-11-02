/**
 * EMAIL-LANCIO — l'email di conferma dell'iscrizione alla lista d'attesa (unnivai.com).
 *
 * La chiama il trigger `waitlist_invia_email` (migrazione 20261102160000_lista_attesa_email.sql) con pg_net,
 * dopo ogni insert in public.waitlist, con il solo `{ id }` della riga: l'indirizzo lo legge la funzione.
 * Spedisce con l'API di Resend. Una riga riceve al massimo un'email: la funzione «prende» la riga
 * scrivendo email_inviata_at solo se è vuota; se Resend fallisce la rimette vuota (si può rimandare).
 *
 * Segreti e impostazioni (Supabase → Edge Functions → Secrets; mai nel codice):
 *   RESEND_API_KEY            obbligatoria
 *   LISTA_ATTESA_RISPONDI_A   obbligatoria: l'indirizzo che riceve le risposte («cancellami»)
 *   EMAIL_MITTENTE            facoltativa, di difetto «Unnivai <ciao@unnivai.com>»
 *   LISTA_ATTESA_MAX_ORA      facoltativa, di difetto 30: email al massimo in un'ora (oltre: 429, la riga resta da mandare)
 *
 * Deploy (dal codice su main): supabase functions deploy lista-attesa-email --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api
 * Senza JWT perché la chiama il database; un id sconosciuto o già servito non manda niente.
 * Nei log mai l'indirizzo né la chiave: solo l'id della riga e gli esiti.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { emailListaAttesa } from '../_shared/emailUnnivai.ts';

export const RESEND_URL = 'https://api.resend.com/emails';
export const MITTENTE_DI_DIFETTO = 'Unnivai <ciao@unnivai.com>';
export const MAX_ORA_DI_DIFETTO = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
    if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);
    const env = (k: string) => Deno.env.get(k) ?? '';
    const chiave = env('RESEND_API_KEY');
    const rispondiA = env('LISTA_ATTESA_RISPONDI_A');
    if (!chiave || !rispondiA) {
        console.error('[lista-attesa-email] configurazione mancante: RESEND_API_KEY o LISTA_ATTESA_RISPONDI_A');
        return json({ errore: 'configurazione mancante' }, 503);
    }

    let id: unknown;
    try { ({ id } = await req.json()); } catch { return json({ errore: 'richiesta non valida' }, 400); }
    if (typeof id !== 'string' || !UUID.test(id)) return json({ errore: 'richiesta non valida' }, 400);

    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

    // Tetto orario: protegge il dominio se qualcuno riempie il modulo con indirizzi altrui.
    const maxOra = Number(env('LISTA_ATTESA_MAX_ORA')) > 0 ? Number(env('LISTA_ATTESA_MAX_ORA')) : MAX_ORA_DI_DIFETTO;
    const unOraFa = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: eConta } = await db.from('waitlist')
        .select('id', { count: 'exact', head: true })
        .gte('email_inviata_at', unOraFa);
    if (eConta) { console.error('[lista-attesa-email] conteggio non riuscito'); return json({ errore: 'database' }, 500); }
    if ((count ?? 0) >= maxOra) {
        console.log(`[lista-attesa-email] tetto di ${maxOra} all'ora raggiunto: ${id} resta da mandare`);
        return json({ esito: 'rimandata' }, 429);
    }

    // Prende la riga una volta sola: chi arriva secondo trova email_inviata_at già scritta e non manda niente.
    const { data: riga, error: ePrendi } = await db.from('waitlist')
        .update({ email_inviata_at: new Date().toISOString() })
        .eq('id', id)
        .is('email_inviata_at', null)
        .select('id, email, city')
        .maybeSingle();
    if (ePrendi) { console.error('[lista-attesa-email] lettura della riga non riuscita'); return json({ errore: 'database' }, 500); }
    if (!riga) return json({ esito: 'niente da mandare' }, 200);

    const m = emailListaAttesa({ email: riga.email, citta: riga.city });
    let stato = 0;
    try {
        const r = await fetch(RESEND_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${chiave}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': `lista-attesa-${riga.id}`,
            },
            body: JSON.stringify({
                from: env('EMAIL_MITTENTE') || MITTENTE_DI_DIFETTO,
                to: [riga.email],
                reply_to: rispondiA,
                subject: m.oggetto,
                html: m.html,
                text: m.testo,
            }),
        });
        stato = r.status;
    } catch { stato = 0; }

    if (stato < 200 || stato >= 300) {
        await db.from('waitlist').update({ email_inviata_at: null }).eq('id', riga.id);
        console.error(`[lista-attesa-email] Resend ha risposto ${stato || 'senza rete'} per ${riga.id}: riga rimessa da mandare`);
        return json({ errore: 'invio non riuscito' }, 502);
    }
    console.log(`[lista-attesa-email] mandata ${riga.id}`);
    return json({ esito: 'mandata' }, 200);
});
