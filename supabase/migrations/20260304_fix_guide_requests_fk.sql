-- Migration file to fix missing relations on guide_requests
-- Filename: supabase/migrations/20260304_fix_guide_requests_fk.sql

-- Se c'è un FK residuo su auth.users, rimuoviamolo per pulizia (potrebbe non esserci)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guide_requests_guide_id_fkey'
          AND conrelid = 'public.guide_requests'::regclass
    ) THEN
        ALTER TABLE public.guide_requests
            DROP CONSTRAINT guide_requests_guide_id_fkey;
        RAISE NOTICE 'Dropped old FK guide_requests_guide_id_fkey';
    END IF;
END $$;

-- CLEANUP ORPHANED RECORDS: ELIMINA LE RICHIESTE IL CUI utente_id o guide_id NON ESISTE PIÙ IN `profiles`
DELETE FROM public.guide_requests
WHERE guide_id IS NOT NULL AND guide_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.guide_requests
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);

-- Aggiunta della FOREIGN KEY corretta tra guide_id e public.profiles(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guide_requests_guide_id_profiles_fk'
          AND conrelid = 'public.guide_requests'::regclass
    ) THEN
        ALTER TABLE public.guide_requests
            ADD CONSTRAINT guide_requests_guide_id_profiles_fk
            FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK guide_requests_guide_id_profiles_fk (→ public.profiles)';
    END IF;
END $$;

-- Aggiunta della FOREIGN KEY per user_id se ancora non esiste o puntava altrove
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guide_requests_user_id_profiles_fk'
          AND conrelid = 'public.guide_requests'::regclass
    ) THEN
        ALTER TABLE public.guide_requests
            ADD CONSTRAINT guide_requests_user_id_profiles_fk
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK guide_requests_user_id_profiles_fk (→ public.profiles)';
    END IF;
END $$;

-- Assicuriamoci che PostgREST capisca le foreign keys se ci sono ambiguità ricaricando lo schema cache
NOTIFY pgrst, 'reload schema';
