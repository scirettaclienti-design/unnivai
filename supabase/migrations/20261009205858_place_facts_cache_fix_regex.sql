-- =============================================================================
-- P3d-e — correzione di 20261009_place_facts_cache.sql
-- =============================================================================
-- Le regex con ripetizione {10,300} non sono valide in Postgres (massimo 255,
-- "invalid repetition count(s)"): la funzione falliva a ogni chiamata e il
-- vincolo su place_id a ogni INSERT. Lunghezze ora con length(), regex senza
-- conteggi. Stessa firma, stessi permessi.

ALTER TABLE public.place_facts DROP CONSTRAINT IF EXISTS place_facts_place_id_check;
ALTER TABLE public.place_facts ADD CONSTRAINT place_facts_place_id_check
    CHECK (place_id ~ '^[A-Za-z0-9_-]+$' AND length(place_id) BETWEEN 10 AND 300);

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
