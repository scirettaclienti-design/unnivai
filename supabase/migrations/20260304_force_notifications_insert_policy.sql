-- Forza l'eliminazione di eventuali policy restrittive sull'INSERT
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- Ricrea la policy consentendo a chiunque è autenticato di inserire notifiche per QUALSIASI utente
-- (Indispensabile per permettere alle Guide di scrivere notifiche agli Esploratori,
--  e agli Esploratori di scrivere notifiche alle Guide)
CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated 
  WITH CHECK (true);
