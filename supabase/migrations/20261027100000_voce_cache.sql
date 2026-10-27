-- VOCE-1 — la voce umana della navigazione: cache degli audio e tetto giornaliero degli audio nuovi.
--
-- 1) bucket `voce-cache` (pubblico in lettura): un file mp3 per ogni frase detta, il nome è l'hash di
--    modello + voce + istruzione + testo (v1/<sha256>.mp3). Solo la funzione (service role) scrive.
--    Dentro ci sono frasi di navigazione e racconti di tappa: niente dati dell'utente.
-- 2) public.voce_uso + public.voce_consuma(): quanti audio NUOVI oggi, per tutti (giorno = Europe/Rome).
--    La funzione sale di uno solo se sotto il tetto, in modo atomico. Una frase già in cache non la chiama.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voce-cache', 'voce-cache', true, 2097152, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.voce_uso (
    giorno date PRIMARY KEY,
    nuovi  integer NOT NULL DEFAULT 0
);
ALTER TABLE public.voce_uso ENABLE ROW LEVEL SECURITY;  -- nessuna policy: solo la chiave di servizio

CREATE OR REPLACE FUNCTION public.voce_consuma(p_tetto integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_giorno date := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_nuovi  integer;
BEGIN
    INSERT INTO public.voce_uso (giorno, nuovi) VALUES (v_giorno, 0) ON CONFLICT (giorno) DO NOTHING;
    UPDATE public.voce_uso SET nuovi = nuovi + 1
     WHERE giorno = v_giorno AND nuovi < p_tetto
    RETURNING nuovi INTO v_nuovi;
    RETURN v_nuovi IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.voce_consuma(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voce_consuma(integer) TO service_role;
