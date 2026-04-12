-- RPC functions per proximity matching business-tour
-- Richiede PostGIS (già abilitato su Supabase)

-- 1. Trova partner vicini a un tour specifico (usata in TourDetails.jsx)
CREATE OR REPLACE FUNCTION get_nearby_partners_for_tour(tour_id UUID, radius_meters INTEGER DEFAULT 1000)
RETURNS TABLE (
    id UUID,
    company_name TEXT,
    category_tags TEXT[],
    description TEXT,
    address TEXT,
    image_urls TEXT[],
    subscription_tier TEXT,
    ai_metadata JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    tour_record RECORD;
BEGIN
    -- Prendi le coordinate del tour (media delle tappe o centro città)
    SELECT
        COALESCE(t.latitude, 41.9028) AS lat,
        COALESCE(t.longitude, 12.4964) AS lng
    INTO tour_record
    FROM tours t WHERE t.id = get_nearby_partners_for_tour.tour_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        bp.id,
        bp.company_name,
        bp.category_tags,
        bp.description,
        bp.address,
        bp.image_urls,
        bp.subscription_tier,
        bp.ai_metadata,
        bp.latitude,
        bp.longitude,
        ST_Distance(
            bp.location::geography,
            ST_SetSRID(ST_MakePoint(tour_record.lng, tour_record.lat), 4326)::geography
        ) AS distance_meters
    FROM businesses_profile bp
    WHERE bp.location IS NOT NULL
      AND ST_DWithin(
            bp.location::geography,
            ST_SetSRID(ST_MakePoint(tour_record.lng, tour_record.lat), 4326)::geography,
            CASE WHEN bp.subscription_tier = 'elite' THEN 15000 ELSE radius_meters END
          )
    ORDER BY
        CASE WHEN bp.subscription_tier = 'elite' THEN 0 ELSE 1 END,
        distance_meters ASC
    LIMIT 10;
END;
$$;

-- 2. Cerca partner vicini a coordinate date (usata in TourBuilder.jsx)
CREATE OR REPLACE FUNCTION search_nearby_partners(
    search_lat DOUBLE PRECISION,
    search_lng DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 5000,
    category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    company_name TEXT,
    category_tags TEXT[],
    description TEXT,
    address TEXT,
    image_urls TEXT[],
    subscription_tier TEXT,
    ai_metadata JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        bp.id,
        bp.company_name,
        bp.category_tags,
        bp.description,
        bp.address,
        bp.image_urls,
        bp.subscription_tier,
        bp.ai_metadata,
        bp.latitude,
        bp.longitude,
        ST_Distance(
            bp.location::geography,
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
        ) AS distance_meters
    FROM businesses_profile bp
    WHERE bp.location IS NOT NULL
      AND ST_DWithin(
            bp.location::geography,
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            radius_meters
          )
      AND (category_filter IS NULL OR category_filter = ANY(bp.category_tags))
    ORDER BY
        CASE WHEN bp.subscription_tier = 'elite' THEN 0 ELSE 1 END,
        distance_meters ASC
    LIMIT 20;
END;
$$;
