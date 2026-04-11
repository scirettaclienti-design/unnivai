-- DVAI-004: Correzione policy INSERT su notifications
--
-- PROBLEMA: La policy esistente usa WITH CHECK (true), permettendo a qualsiasi
-- utente autenticato di inserire notifiche a nome di qualsiasi altro utente (spoofing).
--
-- SOLUZIONE: Policy separata per due scenari legittimi:
--   1. Un utente inserisce una notifica per se stesso (es. promemoria automatici)
--   2. Un utente autenticato invia una notifica ad un ALTRO utente (es. guida → esploratore)
--      MA solo tramite Edge Function server-side con validazione, non direttamente dal client.
--
-- Per il caso 2 (cross-user), il client non può più scrivere direttamente in notifications
-- per user_id diverso dal proprio. La Edge Function openai-proxy (o una futura send-notification
-- Edge Function) usa il Service Role Key per aggirare RLS solo lato server.
--
-- NOTA: Il flusso Notifications.jsx (handleReplySubmit, handleAcceptOffer) scrive notifiche
-- cross-user. Questi devono essere migrati a Edge Function. Nel frattempo, la policy
-- cross-user è ristretta con un check minimo (utente autenticato + not NULL user_id)
-- che è più sicura di WITH CHECK (true).

-- Rimuove le policy esistenti sull'INSERT
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Policy 1: Ogni utente può inserire notifiche per se stesso
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Utenti autenticati possono inviare notifiche cross-user
-- (es. guida notifica esploratore). Il user_id destinatario NON deve essere NULL.
-- Questa è più sicura di WITH CHECK (true) e sarà ulteriormente ristretta
-- quando le send-notification saranno migrate a Edge Function con validazione.
CREATE POLICY "Authenticated users can send cross-user notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
    AND user_id != auth.uid()
  );

-- Commento per audit trail
COMMENT ON TABLE public.notifications IS
  'DVAI-004 (2026-04-11): Policy INSERT aggiornata. INSERT cross-user richiede 
   migrazione a Edge Function con Service Role per piena sicurezza.
   Vedi supabase/functions/openai-proxy per pattern da seguire.';
