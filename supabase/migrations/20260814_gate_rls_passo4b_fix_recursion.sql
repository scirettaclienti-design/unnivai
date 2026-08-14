-- ============================================================================
-- GATE SICUREZZA RLS — PASSO 4b (correzione): ricorsione infinita
-- Data: 2026-08-14
--
-- COSA E' SUCCESSO
--   Al primo ENABLE su profiles, ogni SELECT e' fallita con:
--     42P17: infinite recursion detected in policy for relation "profiles"
--   RLS e' stata spenta immediatamente (rollback) e la causa isolata.
--
-- IL CICLO
--   profiles."profiles_select_guide_on_request"
--     -> sottoquery su guide_requests
--   guide_requests."Guides see local requests"  (policy PRE-ESISTENTE)
--     USING (city = (SELECT profiles.city FROM profiles WHERE profiles.id = auth.uid()))
--     -> sottoquery su profiles
--     -> ricorsione.
--
--   Non e' la policy nuova a essere sbagliata in se': e' che guide_requests
--   ne ha una che interroga profiles. Finche' profiles aveva RLS spenta il
--   ciclo non si chiudeva e nessuno se ne era accorto.
--
-- LA CORREZIONE
--   Il lookup su guide_requests viene spostato dentro una funzione
--   SECURITY DEFINER. Il corpo di una SECURITY DEFINER gira con i permessi
--   del proprietario (postgres, che possiede guide_requests e non ha
--   relforcerowsecurity), quindi NON attiva le policy di guide_requests e il
--   ciclo si spezza.
--
--   Alternativa scartata: rimuovere "Guides see local requests" da
--   guide_requests. Avrebbe rotto il ciclo e tolto una policy discutibile
--   (consente a ogni autenticato di leggere tutte le richieste della propria
--   citta'), ma cambia il comportamento di un'ALTRA tabella dentro un passo
--   che deve toccare solo profiles. Va affrontata nel gate di cleanup delle
--   policy duplicate/contraddittorie, con verifiche sue.
--
-- SUPERFICIE DELLA FUNZIONE
--   Restituisce solo un booleano e non espone righe. EXECUTE revocata a
--   public e anon, concessa solo ad authenticated: la policy che la usa e'
--   TO authenticated, quindi anon non ne ha bisogno. Cosi' non compare
--   nemmeno tra le SECURITY DEFINER anon-eseguibili segnalate dall'advisor.
--   search_path fissato (evita il warning function_search_path_mutable).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_requester_visible_to_guide(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        EXISTS (
            SELECT 1
            FROM public.guide_requests gr
            WHERE gr.user_id = profile_id
              AND (gr.guide_id = auth.uid() OR gr.guide_id IS NULL)
        )
        AND EXISTS (
            SELECT 1
            FROM public.guides_profile gp
            WHERE gp.user_id = auth.uid()
        );
$$;

REVOKE EXECUTE ON FUNCTION public.is_requester_visible_to_guide(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_requester_visible_to_guide(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_requester_visible_to_guide(uuid) TO authenticated;

-- Sostituisce la policy del passo 4a con la versione che non ricorre.
-- Cosa espone e a chi: invariato rispetto a 4a (riga intera del profilo del
-- richiedente, alla guida destinataria o a qualunque titolare di una riga
-- guides_profile per le richieste a pioggia). Vedi il file del passo 4a.
DROP POLICY "profiles_select_guide_on_request" ON public.profiles;

CREATE POLICY "profiles_select_guide_on_request"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_requester_visible_to_guide(profiles.id));
