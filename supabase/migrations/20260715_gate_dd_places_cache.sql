-- Gate DD (U.1-bis) — Cache condivisa server-side per Google Places.
--
-- Motivo (Ivano 15/07): la cache localStorage e' per-browser. Al lancio,
-- ogni utente NUOVO paga la Home piena ($0.157 di textsearch). Il "hit
-- rate 90%" della stima Gate BB vale solo dal secondo giorno dello stesso
-- utente. La cache condivisa e' la leva vera: la PRIMA persona che apre
-- una citta' paga; tutte le successive leggono a costo zero.
--
-- Modello a 2 livelli:
--   1. Supabase places_cache (condivisa tra tutti gli utenti, TTL 24h)
--   2. localStorage (per-utente, evita round-trip Supabase per richieste
--      ripetute dallo stesso browser)
--
-- Chi legge: places-proxy edge function (server-side, via service-role key
-- interna). Il client NON legge direttamente questa tabella — passa sempre
-- dal proxy. La RLS `public read` esiste solo per debugging/observability,
-- non e' un percorso di lettura del client.

CREATE TABLE IF NOT EXISTS public.places_cache (
    cache_key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sull'ordinamento temporale per pulizia periodica (TTL enforcement).
CREATE INDEX IF NOT EXISTS idx_places_cache_created_at
    ON public.places_cache (created_at);

ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;

-- RLS: chiunque puo' leggere (utile per debugging via Supabase UI, e la
-- cache NON contiene dati sensibili — sono risultati Places pubblici).
-- Solo service-role puo' scrivere/aggiornare/eliminare (l'edge function
-- places-proxy usa service-role key internamente per fare l'UPSERT).
DROP POLICY IF EXISTS places_cache_public_read ON public.places_cache;
CREATE POLICY places_cache_public_read
    ON public.places_cache
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS places_cache_service_write ON public.places_cache;
CREATE POLICY places_cache_service_write
    ON public.places_cache
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Cleanup periodico: righe piu' vecchie di 25h (1h di grazia oltre il TTL 24h
-- per evitare race condition con letture in corso). Da eseguire via cron
-- Supabase o manualmente. Non e' bloccante: le righe stantie non fanno danno,
-- vengono ignorate dal filtro TTL server-side. Il cleanup serve solo a tenere
-- la tabella piccola.
--
-- DELETE FROM public.places_cache WHERE created_at < NOW() - INTERVAL '25 hours';
--
-- (Da schedulare in Supabase Cron una volta al giorno se lo storage cresce.)
