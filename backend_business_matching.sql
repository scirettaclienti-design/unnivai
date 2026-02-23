-- =================================================================================
-- MOTORE DI MATCHING: TOUR ↔ BUSINESS PARTNER
-- Logica: Un'attività appare sulla mappa se ALMENO UNO dei tag del tour
--         corrisponde ai category_tags del business, e il business è nel raggio.
-- =================================================================================

-- 1. FUNZIONE: Trova business compatibili con un tour specifico
--    Parametri:
--      tour_id_input  → UUID del tour che si sta visualizzando
--      radius_m       → raggio di ricerca in metri (default 800m)
--
-- Logica di matching:
--   - Distanza: il business deve essere entro radius_m dal percorso del tour
--   - Tag: category_tags del business interseca i tags del tour
--   - Fallback semantico: se un business ha tag 'Ristorazione' e il tour ha tag 'Cibo' 
--     vengono considerati compatibili (tramite mapping)

CREATE OR REPLACE FUNCTION match_businesses_for_tour(
    tour_id_input UUID,
    radius_m INT DEFAULT 800
)
RETURNS TABLE (
    business_id     UUID,
    business_name   TEXT,
    category_tags   TEXT[],
    ai_vibe         TEXT[],
    ai_style        TEXT[],
    price_range     TEXT,
    description     TEXT,
    address         TEXT,
    image_urls      TEXT[],
    lat             FLOAT,
    lng             FLOAT,
    distance_m      FLOAT,
    match_score     INT,
    subscription_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tour_record RECORD;
    tour_center GEOGRAPHY;
BEGIN
    -- Ottieni il tour con i suoi tag e posizione di partenza
    SELECT t.tags, t.city, t.start_location
    INTO tour_record
    FROM tours t
    WHERE t.id = tour_id_input;

    -- Se il tour non esiste, ritorna vuoto
    IF NOT FOUND OR tour_record.start_location IS NULL THEN
        RETURN;
    END IF;

    tour_center := tour_record.start_location::geography;

    RETURN QUERY
    SELECT
        b.id                                            AS business_id,
        b.company_name                                  AS business_name,
        COALESCE(b.category_tags, ARRAY[]::TEXT[])      AS category_tags,
        COALESCE((b.ai_metadata->>'vibe')::TEXT[], ARRAY[]::TEXT[])  AS ai_vibe,
        COALESCE((b.ai_metadata->>'style')::TEXT[], ARRAY[]::TEXT[]) AS ai_style,
        COALESCE(b.ai_metadata->>'price_range', '')     AS price_range,
        COALESCE(b.description, '')                     AS description,
        COALESCE(b.address, '')                         AS address,
        COALESCE(b.image_urls, ARRAY[]::TEXT[])         AS image_urls,
        ST_Y(b.location::geometry)                      AS lat,
        ST_X(b.location::geometry)                      AS lng,
        ST_Distance(b.location::geography, tour_center) AS distance_m,

        -- Score di matching:
        -- +3 tag diretto coincide con tour
        -- +2 tag semanticamente correlato
        -- +5 piano premium/elite
        (
            -- Tag diretto matching
            CASE WHEN b.category_tags && tour_record.tags THEN 3 ELSE 0 END
            +
            -- Semantic mapping: Cibo↔Ristorazione, Arte/Cultura↔Cultura, Lusso↔Lusso, etc.
            CASE WHEN (
                (tour_record.tags @> ARRAY['Cibo'] AND b.category_tags @> ARRAY['Ristorazione'])
                OR (tour_record.tags @> ARRAY['Arte'] AND b.category_tags @> ARRAY['Cultura'])
                OR (tour_record.tags @> ARRAY['Cultura'] AND b.category_tags @> ARRAY['Cultura'])
                OR (tour_record.tags @> ARRAY['Storia'] AND b.category_tags @> ARRAY['Cultura'])
                OR (tour_record.tags @> ARRAY['Romantico'] AND b.category_tags @> ARRAY['Lusso'])
                OR (tour_record.tags @> ARRAY['Romantico'] AND b.category_tags @> ARRAY['Ospitalità'])
                OR (tour_record.tags @> ARRAY['Avventura'] AND b.category_tags @> ARRAY['Avventura'])
                OR (tour_record.tags @> ARRAY['Natura'] AND b.category_tags @> ARRAY['Relax'])
            ) THEN 2 ELSE 0 END
            +
            -- Subscription tier bonus
            CASE
                WHEN b.subscription_tier = 'elite'   THEN 5
                WHEN b.subscription_tier = 'premium' THEN 3
                WHEN b.subscription_tier = 'base'    THEN 1
                ELSE 0
            END
        )::INT AS match_score,

        b.subscription_tier::TEXT

    FROM businesses_profile b
    WHERE
        b.location IS NOT NULL
        AND ST_DWithin(b.location::geography, tour_center, radius_m)
        AND (
            -- Ha almeno un tag che matcha direttamente O semanticamente
            b.category_tags && tour_record.tags
            OR (tour_record.tags @> ARRAY['Cibo'] AND b.category_tags @> ARRAY['Ristorazione'])
            OR (tour_record.tags @> ARRAY['Arte'] AND b.category_tags @> ARRAY['Cultura'])
            OR (tour_record.tags @> ARRAY['Cultura'] AND b.category_tags @> ARRAY['Cultura'])
            OR (tour_record.tags @> ARRAY['Storia'] AND b.category_tags @> ARRAY['Cultura'])
            OR (tour_record.tags @> ARRAY['Romantico'] AND b.category_tags @> ARRAY['Lusso'])
            OR (tour_record.tags @> ARRAY['Romantico'] AND b.category_tags @> ARRAY['Ospitalità'])
            OR (tour_record.tags @> ARRAY['Avventura'] AND b.category_tags @> ARRAY['Avventura'])
            OR (tour_record.tags @> ARRAY['Natura'] AND b.category_tags @> ARRAY['Relax'])
        )
    ORDER BY
        match_score DESC,
        distance_m ASC
    LIMIT 10;
END;
$$;

-- Grant esecuzione agli utenti autenticati e anonimi (lettura pubblica)
GRANT EXECUTE ON FUNCTION match_businesses_for_tour(UUID, INT) TO anon, authenticated;


-- 2. FUNZIONE: Quanti tour in una città matcherebbero con un dato business?
--    Usata dal DashboardBusiness per mostrare la "visibilità potenziale"
CREATE OR REPLACE FUNCTION count_matching_tours_for_business(
    business_id_input UUID,
    radius_m INT DEFAULT 1000
)
RETURNS TABLE (
    matching_tour_count INT,
    tour_titles         TEXT[],
    top_matching_tags   TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    biz RECORD;
    biz_center GEOGRAPHY;
BEGIN
    SELECT b.category_tags, b.location, b.city
    INTO biz
    FROM businesses_profile b
    WHERE b.id = business_id_input;

    IF NOT FOUND OR biz.location IS NULL THEN
        RETURN QUERY SELECT 0, ARRAY[]::TEXT[], ARRAY[]::TEXT[];
        RETURN;
    END IF;

    biz_center := biz.location::geography;

    RETURN QUERY
    SELECT
        COUNT(t.id)::INT,
        ARRAY_AGG(t.title ORDER BY t.created_at DESC)::TEXT[],
        biz.category_tags
    FROM tours t
    WHERE
        t.start_location IS NOT NULL
        AND t.is_live = true
        AND ST_DWithin(t.start_location::geography, biz_center, radius_m)
        AND (
            t.tags && biz.category_tags
            OR (t.tags @> ARRAY['Cibo'] AND biz.category_tags @> ARRAY['Ristorazione'])
            OR (t.tags @> ARRAY['Arte'] AND biz.category_tags @> ARRAY['Cultura'])
            OR (t.tags @> ARRAY['Romantico'] AND biz.category_tags @> ARRAY['Lusso'])
        );
END;
$$;

GRANT EXECUTE ON FUNCTION count_matching_tours_for_business(UUID, INT) TO anon, authenticated;


-- 3. VIEW PUBBLICA: business partner con location valida (per la mappa città)
--    Visibili a tutti gli utenti autenticati
CREATE OR REPLACE VIEW public_business_partners AS
SELECT
    b.id,
    b.company_name,
    b.category_tags,
    b.subscription_tier,
    b.description,
    b.address,
    b.city,
    b.image_urls,
    b.ai_metadata,
    ST_Y(b.location::geometry) AS lat,
    ST_X(b.location::geometry) AS lng
FROM businesses_profile b
WHERE b.location IS NOT NULL;

GRANT SELECT ON public_business_partners TO anon, authenticated;
