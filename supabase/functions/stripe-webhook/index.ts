/**
 * DVAI-006 — Stripe Webhook Handler
 *
 * Ascolta gli eventi Stripe e aggiorna lo stato bookings/guide_requests
 * quando un pagamento viene completato (checkout.session.completed).
 *
 * Setup:
 *   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *
 * Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
 * Stripe Dashboard: imposta endpoint webhook su
 *   https://<project>.supabase.co/functions/v1/stripe-webhook
 * Evento da abilitare: checkout.session.completed
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'stripe-signature, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

/**
 * Verifica la firma del webhook Stripe usando HMAC-SHA256.
 * Stripe invia l'header `Stripe-Signature: t=...,v1=...`
 */
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const data = encoder.encode(`${timestamp}.${payload}`);
    const signed = await crypto.subtle.sign('HMAC', key, data);
    const computed = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computed === signature;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe-Signature' }, 400);

  const rawBody = await req.text();

  // Verifica firma
  const isValid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('[stripe-webhook] Firma non valida');
    return json({ error: 'Invalid signature' }, 400);
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session['metadata'] as Record<string, string> | undefined;

    if (!metadata) {
      console.warn('[stripe-webhook] Nessun metadata nella sessione');
      return json({ received: true });
    }

    const { user_id, reference_id, guide_id, type } = metadata;

    if (type === 'booking' && reference_id) {
      // Aggiorna booking come confermato
      const { error } = await supabase.from('bookings')
        .update({ status: 'accepted', payment_confirmed_at: new Date().toISOString() })
        .eq('id', reference_id);

      if (error) {
        console.error('[stripe-webhook] Errore aggiornamento booking:', error.message);
      } else {
        // Notifica utente
        await supabase.from('notifications').insert({
          user_id,
          type: 'payment_confirmed',
          title: '✅ Pagamento confermato!',
          message: 'Il tuo tour è confermato. Controlla i dettagli nella sezione prenotazioni.',
          action_url: '/profile',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (type === 'guide_request' && reference_id) {
      // Aggiorna guide_request come confermata
      const { error } = await supabase.from('guide_requests')
        .update({ status: 'accepted' })
        .eq('id', reference_id);

      if (error) {
        console.error('[stripe-webhook] Errore aggiornamento guide_request:', error.message);
      } else {
        // Notifica utente
        await supabase.from('notifications').insert({
          user_id,
          type: 'payment_confirmed',
          title: '✅ Pagamento confermato!',
          message: 'La tua richiesta guida è confermata. Riceverai presto i contatti della guida.',
          action_url: '/dashboard-user',
          is_read: false,
          created_at: new Date().toISOString(),
        });

        // Notifica guida
        if (guide_id) {
          await supabase.from('notifications').insert({
            user_id: guide_id,
            type: 'payment_received',
            title: '💰 Pagamento ricevuto!',
            message: `Un utente ha pagato la tua offerta. Il tour è confermato.`,
            action_url: '/dashboard-guide',
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Risponde sempre 200 a Stripe (anche per eventi non gestiti)
  return json({ received: true });
});
