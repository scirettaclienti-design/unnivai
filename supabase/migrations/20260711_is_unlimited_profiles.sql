-- Task 3 — is_unlimited flag su profiles per account di test.
--
-- Comportamento:
-- L'utente PUÒ leggere il proprio flag (già coperto dalla policy SELECT
-- "Public profiles are viewable by everyone" in rls_policies.sql).
-- L'utente NON PUÒ scrivere il flag: trigger BEFORE UPDATE sovrascrive
-- NEW.is_unlimited con OLD.is_unlimited quando il chiamante non è
-- service_role. Segue lo stesso pattern di
-- 20260412_protect_subscription_tier.sql (protezione businesses_profile).
--
-- Per abilitare un account di test:
--   UPDATE public.profiles
--   SET is_unlimited = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'sciretta.clienti@gmail.com');
-- Va eseguito dal SQL Editor Supabase (che gira come service_role).

-- 1. Aggiungi colonna
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Trigger protezione: solo service_role può modificare is_unlimited
CREATE OR REPLACE FUNCTION protect_profile_is_unlimited()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.is_unlimited IS DISTINCT FROM NEW.is_unlimited THEN
        IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
            NEW.is_unlimited := OLD.is_unlimited;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_is_unlimited ON public.profiles;
CREATE TRIGGER protect_profile_is_unlimited
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_profile_is_unlimited();
