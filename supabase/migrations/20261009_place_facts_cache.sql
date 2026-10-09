-- =============================================================================
-- P3d-e — place_facts: cache dei fatti aperti per place_id (30 giorni)
-- =============================================================================
--
-- I fatti che il narratore riceve per ogni tappa finale (Wikipedia, Wikidata,
-- OpenStreetMap — mai contenuti Google) si cercano dal client
-- (src/services/factsService.js) con un tetto di 4 secondi. Questa tabella li
-- tiene per place_id, cosi' la stessa tappa non si ricerca per 30 giorni.
--
-- Colonne: place_id, fatti, fonti, data.
--   fatti  jsonb  [{ "testo": "...", "fonte": "wikipedia|wikidata|osm" }]
--   fonti  jsonb  [{ "fonte": "...", "url": "https://...", "titolo": "..." }]
--   data   timestamptz, messa dal SERVER (mai dal client)
--
-- Sicurezza: la lettura e' aperta (anon + authenticated), sono fatti pubblici.
-- La scrittura NON e' una INSERT/UPDATE diretta: passa solo da
-- save_place_facts(), SECURITY DEFINER, che valida forma, fonti ammesse, URL
-- delle fonti (solo it.wikipedia.org, wikidata.org, openstreetmap.org),
-- lunghezze, e sovrascrive una riga SOLO se e' scaduta (piu' vecchia di 30
-- giorni). Il client non puo' scegliere la data ne' riscrivere una riga fresca.
-- Resta possibile, a chi ha la chiave anon, scrivere fatti falsi per un
-- place_id non ancora in cache: limite noto, segnalato nel report P3d-e.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.place_facts (
    place_id text PRIMARY KEY CHECK (place_id ~ '^[A-Za-z0-9_-]+$' AND length(place_id) BETWEEN 10 AND 300),
    fatti    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fatti) = 'array' AND jsonb_array_length(fatti) <= 8),
    fonti    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fonti) = 'array' AND jsonb_array_length(fonti) <= 3),
    data     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS place_facts_select_all ON public.place_facts;
CREATE POLICY place_facts_select_all ON public.place_facts
    FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.place_facts FROM anon, authenticated;
GRANT SELECT ON public.place_facts TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_place_facts(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r        jsonb;
    v_id     text;
    v_written integer := 0;
    v_n      integer;
BEGIN
    IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 30 THEN
        RAISE EXCEPTION 'save_place_facts: righe non valide';
    END IF;

    FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_id := r->>'place_id';
        IF v_id IS NULL OR v_id !~ '^[A-Za-z0-9_-]+$' OR length(v_id) NOT BETWEEN 10 AND 300 THEN CONTINUE; END IF;
        IF jsonb_typeof(r->'fatti') <> 'array' OR jsonb_array_length(r->'fatti') > 8 THEN CONTINUE; END IF;
        IF jsonb_typeof(r->'fonti') <> 'array' OR jsonb_array_length(r->'fonti') > 3 THEN CONTINUE; END IF;

        -- ogni fatto: testo breve, fonte ammessa
        IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(r->'fatti') AS x(f)
             WHERE jsonb_typeof(x.f) <> 'object'
                OR coalesce(x.f->>'fonte', '') NOT IN ('wikipedia', 'wikidata', 'osm')
                OR coalesce(length(x.f->>'testo'), 0) NOT BETWEEN 1 AND 400
        ) THEN CONTINUE; END IF;

        -- ogni fonte: fonte ammessa, URL solo verso la fonte dichiarata
        IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(r->'fonti') AS x(f)
             WHERE jsonb_typeof(x.f) <> 'object'
                OR coalesce(length(x.f->>'titolo'), 0) > 300
                OR coalesce(length(x.f->>'url'), 0) > 400
                OR NOT (
                       (x.f->>'fonte' = 'wikipedia' AND x.f->>'url' ~ '^https://it\.wikipedia\.org/wiki/[^\s]+$')
                    OR (x.f->>'fonte' = 'wikidata'  AND x.f->>'url' ~ '^https://www\.wikidata\.org/wiki/Q[0-9]{1,12}$')
                    OR (x.f->>'fonte' = 'osm'       AND x.f->>'url' ~ '^https://www\.openstreetmap\.org/(node|way|relation)/[0-9]{1,15}$')
                )
        ) THEN CONTINUE; END IF;

        INSERT INTO public.place_facts AS pf (place_id, fatti, fonti, data)
        VALUES (v_id, r->'fatti', r->'fonti', now())
        ON CONFLICT (place_id) DO UPDATE
            SET fatti = EXCLUDED.fatti, fonti = EXCLUDED.fonti, data = now()
          WHERE pf.data < now() - interval '30 days';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_written := v_written + v_n;
    END LOOP;

    RETURN v_written;
END;
$$;

REVOKE ALL ON FUNCTION public.save_place_facts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_place_facts(jsonb) TO anon, authenticated;
