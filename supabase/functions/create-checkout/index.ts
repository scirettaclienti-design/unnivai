/**
 * DVAI-006 — Stripe Checkout Session Creator
 *
 * Crea una sessione Stripe Checkout per una prenotazione tour.
 * La STRIPE_SECRET_KEY rimane esclusivamente sul server (Supabase Secret).
 *
 * Setup:
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   supabase secrets set APP_URL=https://tuodominio.com
 *
 * Deploy: supabase functions deploy create-checkout
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL           = Deno.env.get('APP_URL') ?? 'https://unnivai.vercel.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (!STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe non configurato sul server.' }, 500);
  }

  // Verifica JWT Supabase (utente autenticato richiesto)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Non autorizzato' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Token non valido' }, 401);

  let body: {
    bookingId?: string;
    requestId?: string;
    tourTitle?: string;
    totalAmount?: number;  // in euro
    guideId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const { bookingId, requestId, tourTitle, totalAmount, guideId } = body;

  if (!totalAmount || totalAmount <= 0) {
    return json({ error: 'Importo non valido' }, 400);
  }

  const referenceId = bookingId || requestId;
  if (!referenceId) {
    return json({ error: 'bookingId o requestId richiesto' }, 400);
  }

  // Crea sessione Stripe Checkout
  const stripeBody = new URLSearchParams({
    'payment_method_types[0]':            'card',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': tourTitle ?? 'Tour DoveVai',
    'line_items[0][price_data][unit_amount]': String(Math.round(totalAmount * 100)),
    'line_items[0][quantity]':             '1',
    'mode':                                'payment',
    'success_url':                         `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&ref=${referenceId}`,
    'cancel_url':                          `${APP_URL}/notifications`,
    'customer_email':                      user.email ?? '',
    'metadata[user_id]':                   user.id,
    'metadata[reference_id]':              referenceId,
    'metadata[guide_id]':                  guideId ?? '',
    'metadata[type]':                      bookingId ? 'booking' : 'guide_request',
  });

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok || !session.url) {
    console.error('[create-checkout] Stripe error:', session);
    return json({ error: session.error?.message ?? 'Errore Stripe' }, 502);
  }

  // Aggiorna lo stato del booking/request come "payment_pending"
  if (bookingId) {
    await supabase.from('bookings')
      .update({ status: 'payment_pending', stripe_session_id: session.id })
      .eq('id', bookingId);
  }
  if (requestId) {
    await supabase.from('guide_requests')
      .update({ status: 'payment_pending' })
      .eq('id', requestId);
  }

  return json({ checkoutUrl: session.url, sessionId: session.id });
});
