-- Gate Navigazione — Fase 1 (17/07) — Telemetria navigazione (nav_events).
--
-- Motivo (Ivano): l'handoff chiede "capire dove gli utenti abbandonano la nav
-- per iterare", ma oggi la nav non emette nessun evento — solo console.log
-- [DVAI-Nav] che muoiono nella console del device. Senza osservabilita' non
-- sappiamo quante nav partono, quante si completano, e a che tappa si molla.
--
-- Design (stesso pattern di Gate GG error_logs):
--  - Insert PUBLIC (anche anon/guest): un utente non autenticato puo' navigare
--    un tour; l'evento va registrato lo stesso. RLS default-deny per select.
--  - Select/Update/Delete SOLO service_role: la tabella e' per noi, non per gli
--    utenti. Nessuno legge le sessioni altrui.
--  - Fire-and-forget lato client (src/lib/navTelemetry.js): un errore nella
--    telemetria non deve MAI disturbare la navigazione.
--  - NIENTE dedup: a differenza degli errori, gli eventi nav sono volutamente
--    ripetibili (piu' step_reached per sessione, piu' nav_start nel tempo).
--  - Cleanup periodico fuori perimetro lancio (cron, come error_logs).
--
-- event_type ammessi in Fase 1: nav_start | step_reached | nav_complete |
--   nav_abandon. (nav_offroute arrivera' con la Fase 6 / N8 — non ancora
--   emesso da nessun punto.) Il vincolo NON e' un CHECK rigido: teniamolo
--   text libero per non dover migrare la tabella quando aggiungiamo eventi.
-- mode: driving | walking | bicycling (attributo su nav_start, non un evento).

CREATE TABLE IF NOT EXISTS public.nav_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    tour_id TEXT,
    step_index INT,
    mode TEXT,
    -- Extra libero (es. gps_denied:true su nav_start):
    context JSONB
);

-- Index temporale per dashboard di analisi.
CREATE INDEX IF NOT EXISTS idx_nav_events_created_at
    ON public.nav_events (created_at DESC);

-- Index sul tipo per aggregazioni ("quante nav_abandon ieri?").
CREATE INDEX IF NOT EXISTS idx_nav_events_event_type
    ON public.nav_events (event_type);

ALTER TABLE public.nav_events ENABLE ROW LEVEL SECURITY;

-- INSERT public: chiunque (anon incluso) puo' registrare un evento nav.
DROP POLICY IF EXISTS nav_events_public_insert ON public.nav_events;
CREATE POLICY nav_events_public_insert
    ON public.nav_events
    FOR INSERT
    WITH CHECK (true);

-- SELECT/UPDATE/DELETE solo service_role.
DROP POLICY IF EXISTS nav_events_service_manage ON public.nav_events;
CREATE POLICY nav_events_service_manage
    ON public.nav_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Cleanup manuale (non schedulato qui; da schedulare in Supabase Cron dopo il
-- lancio se il volume cresce):
--   DELETE FROM public.nav_events WHERE created_at < NOW() - INTERVAL '90 days';
