-- =================================================================================
-- Estensione guide_requests per flusso Tour → Richiesta utente → Richieste live guida
-- Collimazione: richiesta dalla scheda tour arriva nella dashboard della guida
--
-- IMPORTANTE: esegui questo script nel Supabase Dashboard → SQL Editor
-- (o con supabase db push se usi la CLI) altrimenti "Invia richiesta" non farà
-- arrivare le richieste in Richieste Live.
-- =================================================================================

-- Aggiungi colonne necessarie (se non esistono)
ALTER TABLE guide_requests ADD COLUMN IF NOT EXISTS guide_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE guide_requests ADD COLUMN IF NOT EXISTS tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL;
ALTER TABLE guide_requests ADD COLUMN IF NOT EXISTS request_text TEXT;
ALTER TABLE guide_requests ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE guide_requests ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Indice per filtrare le richieste per guida (Richieste Live)
CREATE INDEX IF NOT EXISTS idx_guide_requests_guide_id ON guide_requests(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_requests_status ON guide_requests(status);

-- Policy: la guida vede solo le richieste indirizzate a lei (guide_id = auth.uid()); l'utente vede le proprie (user_id)
DROP POLICY IF EXISTS "Guides view open requests" ON guide_requests;
CREATE POLICY "Guides view own and open requests" ON guide_requests
    FOR SELECT USING (
        (auth.uid() = user_id) OR
        (guide_id IS NOT NULL AND guide_id = auth.uid())
    );

-- Inserimento: utenti autenticati possono creare richieste (user_id = auth.uid())
-- Se la tabella ha già policy per INSERT, non sovrascrivere
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'guide_requests' AND policyname = 'Users can insert guide requests'
    ) THEN
        CREATE POLICY "Users can insert guide requests" ON guide_requests
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
