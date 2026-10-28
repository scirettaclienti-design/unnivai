-- RACCONTO DI TAPPA — i racconti da insider (2–4 frasi) scritti da Claude con le fonti verificate, salvati una volta per tappa.
--
-- 1) public.place_racconti: una riga per place_id con l'esito del controllo automatico (passato | scartato | senza-fonti), il testo (solo se
--    passato), i motivi dello scarto, le fonti usate (titolo e URL di Wikipedia) e il costo. Solo la funzione (service role) legge e scrive:
--    nessuna policy, nessun GRANT ad anon/authenticated. Un racconto passato vale 30 giorni (come place_facts: la descrizione di Google non si tiene
--    oltre), uno scartato o senza fonti 7 giorni (poi si riprova). La versione del prompt e del controllo (`versione`) la decide il codice.
-- 2) public.racconto_uso + public.racconto_consuma(): quanti racconti NUOVI oggi, per tutti (giorno = Europe/Rome), con un tetto (secret
--    RACCONTO_DAILY_CAP, difetto 300). Sale di uno solo se sotto il tetto, in modo atomico. Un racconto già in cache non la chiama.
-- Quanti passano e quanti vengono scartati:  select esito, count(*) from public.place_racconti group by 1;

CREATE TABLE IF NOT EXISTS public.place_racconti (
    place_id   text PRIMARY KEY CHECK (place_id ~ '^[A-Za-z0-9_-]+$' AND length(place_id) BETWEEN 10 AND 300),
    versione   text NOT NULL,
    impronta   text NOT NULL,
    esito      text NOT NULL CHECK (esito IN ('passato', 'scartato', 'senza-fonti')),
    testo      text CHECK (testo IS NULL OR length(testo) <= 700),
    motivi     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(motivi) = 'array'),
    fonti      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fonti) = 'array'),
    modello    text,
    costo_usd  numeric(8, 5),
    ms         integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((esito = 'passato') = (testo IS NOT NULL))
);
ALTER TABLE public.place_racconti ENABLE ROW LEVEL SECURITY;  -- nessuna policy: solo la chiave di servizio
REVOKE ALL ON public.place_racconti FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.racconto_uso (
    giorno date PRIMARY KEY,
    nuovi  integer NOT NULL DEFAULT 0
);
ALTER TABLE public.racconto_uso ENABLE ROW LEVEL SECURITY;  -- nessuna policy: solo la chiave di servizio
REVOKE ALL ON public.racconto_uso FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.racconto_consuma(p_tetto integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_giorno date := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_nuovi  integer;
BEGIN
    INSERT INTO public.racconto_uso (giorno, nuovi) VALUES (v_giorno, 0) ON CONFLICT (giorno) DO NOTHING;
    UPDATE public.racconto_uso SET nuovi = nuovi + 1
     WHERE giorno = v_giorno AND nuovi < p_tetto
    RETURNING nuovi INTO v_nuovi;
    RETURN v_nuovi IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.racconto_consuma(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.racconto_consuma(integer) TO service_role;
