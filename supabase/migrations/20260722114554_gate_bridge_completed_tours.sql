-- Ponte nav->profilo - Fasi 2+3 (22/07): fonte APPEND-ONLY DEDUPLICATA dei tour completati.
-- Applicata via apply_migration MCP (version 20260722114554, TRACCIATA in list_migrations).
-- Commenti solo-ASCII di proposito (sopravvivenza cross-terminale > ortografia).
--
-- Writer autoritativo lato DB (trigger SECURITY DEFINER su nav_complete). Il Profilo
-- contera COUNT(completed_tours WHERE user_id=me). Nessun contatore mutabile (niente drift):
-- un numero che drifta non si corregge a posteriori, un set si riconta sempre.
--
-- Decisioni (dalla diagnosi): strada A2 (trigger DB, non client-side spoofabile); strada B
-- (client conta da nav_events) BLOCCATA da RLS (nav_events: select solo service_role).
-- km ESCLUSO (odometria vera = zona watchPosition). Buco di nav_complete (scritto solo su
-- "Fine", non al completamento reale) = Fase 1 frontend, separata.

-- 1. Tabella (tour_id text = allineato a nav_events.tour_id; FK con CASCADE su auth.users).
CREATE TABLE IF NOT EXISTS public.completed_tours (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tour_id            text NOT NULL,
    first_completed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_completed_tours_user_id
    ON public.completed_tours (user_id);

-- 2. RLS: ON. SELECT SOLO il proprio (MAI pubblica). Nessuna policy di scrittura
--    per il client -> scrive SOLO il trigger.
ALTER TABLE public.completed_tours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS completed_tours_select_own ON public.completed_tours;
CREATE POLICY completed_tours_select_own
    ON public.completed_tours
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Funzione trigger: SECURITY DEFINER (bypassa RLS in scrittura), non spoofabile,
--    NON-BLOCCANTE (un errore nel ponte non fa mai fallire l'insert su nav_events),
--    search_path esplicito (guard anti privilege-escalation).
CREATE OR REPLACE FUNCTION public.record_completed_tour()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.completed_tours (user_id, tour_id)
    VALUES (NEW.user_id, NEW.tour_id)
    ON CONFLICT (user_id, tour_id) DO NOTHING;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_completed_tour failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- 4. Trigger: AFTER INSERT, FOR EACH ROW, WHEN filtra a monte.
DROP TRIGGER IF EXISTS trg_record_completed_tour ON public.nav_events;
CREATE TRIGGER trg_record_completed_tour
    AFTER INSERT ON public.nav_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'nav_complete' AND NEW.user_id IS NOT NULL AND NEW.tour_id IS NOT NULL)
    EXECUTE FUNCTION public.record_completed_tour();

-- 5. Backfill delle nav_complete gia esistenti, stesso ON CONFLICT.
INSERT INTO public.completed_tours (user_id, tour_id)
SELECT user_id, tour_id
FROM public.nav_events
WHERE event_type = 'nav_complete'
  AND user_id IS NOT NULL
  AND tour_id IS NOT NULL
ON CONFLICT (user_id, tour_id) DO NOTHING;
