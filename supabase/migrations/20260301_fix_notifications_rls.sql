-- =================================================================================
-- FIX PER LE NOTIFICHE (AGGIORNAMENTO ED ELIMINAZIONE)
-- =================================================================================
-- Le notifiche non potevano essere aggiornate come "lette" o "eliminate" 
-- a causa della Row Level Security (RLS) impostata in Supabase che bloccava 
-- queste azioni per gli utenti autenticati, facendole fallire silenziosamente.
-- 
-- Esegui questo script nel Supabase Dashboard -> SQL Editor
-- =================================================================================

-- 1. Abilita esplicitamente RLS sulla tabella delle notifiche (per sicurezza, se non ci fosse)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Permette agli utenti di LEGGERE le proprie notifiche
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications"
          ON public.notifications FOR SELECT
          USING ( auth.uid() = user_id );
    END IF;
END $$;

-- 3. Permette ai sistemi/utenti di INSERIRE nuove notifiche a nome loro o per interazioni
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can insert notifications'
    ) THEN
        CREATE POLICY "Users can insert notifications"
          ON public.notifications FOR INSERT
          WITH CHECK ( true ); -- (o auth.uid() = user_id a seconda delle regole di inserimento)
    END IF;
END $$;

-- 4. FIX CHIAVE: Permette agli utenti di AGGIORNARE (segnare come lette) le proprie notifiche
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING ( auth.uid() = user_id );

-- 5. FIX CHIAVE: Permette agli utenti di ELIMINARE (cestino) le proprie notifiche
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING ( auth.uid() = user_id );
