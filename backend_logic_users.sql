-- =================================================================================
-- LOGICA DI BACKEND: UTENTI (GAMIFICATION) & SOCIAL GEOFENCING
-- =================================================================================

-- 1. ROW LEVEL SECURITY (RLS) - SICUREZZA UTENTI & FOTO

ALTER TABLE explorers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;

-- EXPLORERS
-- Lettura: Pubblica (vedere profili amici)
CREATE POLICY "Public Read Explorers" ON explorers
FOR SELECT USING (true);

-- Modifica: SOLO proprietario
CREATE POLICY "User Update Own Profile" ON explorers
FOR UPDATE USING (auth.uid() = id);

-- USER_PHOTOS
-- Lettura: Pubblica (vedere il feed)
CREATE POLICY "Public Read Photos" ON user_photos
FOR SELECT USING (true);

-- Inserimento: Utenti autenticati
CREATE POLICY "User Post Own Photos" ON user_photos
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cancellazione: SOLO proprietario
CREATE POLICY "User Delete Own Photos" ON user_photos
FOR DELETE USING (auth.uid() = user_id);


-- 2. FUNZIONE GAMIFICATION: COMPLETARE UN TOUR
-- RPC chiamata complete_tour(tour_id UUID, user_lat FLOAT, user_lng FLOAT)

CREATE OR REPLACE FUNCTION complete_tour(
    tour_id_param UUID,
    user_lat FLOAT,
    user_lng FLOAT
)
RETURNS VOID -- Niente output, solo side-effects
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    end_point GEOGRAPHY;
    meters_to_end FLOAT;
    target_city TEXT;
    tour_length_km FLOAT DEFAULT 3.5; -- Fallback se non calcolato
BEGIN
    -- Recupera punto finale del tour (o ultima tappa se JSON complesso)
    -- Per semplicità, usiamo l'ultimo punto della route_path pre-calcolata
    SELECT 
        ST_EndPoint(route_path::geometry)::geography,
        city 
    INTO end_point, target_city
    FROM tours 
    WHERE id = tour_id_param;

    -- Validazione Geofencing (sei davvero arrivato alla fine?)
    -- Calcola distanza dall'end_point
    meters_to_end := ST_Distance(
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        end_point
    );

    IF meters_to_end > 500 THEN
        RAISE EXCEPTION 'Sei troppo lontano dalla fine del tour (% metri). Avvicinati per completare!', meters_to_end::int;
    END IF;

    -- Aggiorna Statistiche Utente ("Gamification")
    UPDATE explorers
    SET 
        km_walked = km_walked + tour_length_km, -- Qui potremmo usare ST_Length(route_path)/1000
        -- Aggiungi città solo se nuova (Postgres Array Uniqueness logic)
        cities_unlocked = CASE 
            WHEN target_city = ANY(cities_unlocked) THEN cities_unlocked
            ELSE array_append(cities_unlocked, target_city)
        END,
        -- Incrementa contatore (se esiste colonna opzionale)
        tours_completed = COALESCE(tours_completed, 0) + 1
    WHERE id = auth.uid();

    -- Se l'utente non esiste ancora in explorers, INSERT on conflict?
    -- Assumiamo che explorers sia creato al signup (via trigger auth.users)
    -- Se no, bisogna gestire l'INSERT.
END;
$$;


-- 3. SOCIAL GEOFENCING: VALIDAZIONE FOTO (TRIGGER)
-- Impedisce spam di foto non pertinenti al luogo

CREATE OR REPLACE FUNCTION validate_photo_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    is_near_tour BOOLEAN;
    is_near_partner BOOLEAN;
BEGIN
    -- Se la foto non ha location, errore (già enforced da NOT NULL su tabella, ma controlliamo)
    IF NEW.location IS NULL THEN
        RAISE EXCEPTION 'Coordinate GPS obbligatorie per postare.';
    END IF;

    -- Check 1: Vicino al Tour collegato (se c'è tour_id)
    IF NEW.tour_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM tours 
            WHERE id = NEW.tour_id 
            AND ST_DWithin(route_path, NEW.location, 100) -- 100 metri dal percorso
        ) INTO is_near_tour;
        
        IF is_near_tour THEN
            RETURN NEW; -- OK!
        END IF;
    END IF;

    -- Check 2: Vicino a un Partner qualsiasi (se è una foto "libera")
    -- O se vogliamo essere rigidi: vicino a un partner LINKATO al tour?
    -- Per ora: Vicino a QUALSIASI attività partner nel raggio di 100m
    SELECT EXISTS (
        SELECT 1 FROM activities
        WHERE ST_DWithin(location, NEW.location, 100)
    ) INTO is_near_partner;

    IF is_near_partner THEN
        RETURN NEW; -- OK!
    END IF;

    -- Se fallisce entrambi i check
    RAISE EXCEPTION 'Sei troppo lontano (% m) dal percorso o da un partner verificato per postare questo ricordo!', 100;
    
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_photo_geo ON user_photos;
CREATE TRIGGER tr_validate_photo_geo
BEFORE INSERT ON user_photos
FOR EACH ROW
EXECUTE FUNCTION validate_photo_location();


-- 4. FEED PUBBLICO (FUNZIONE DATABASE)
-- Mostra foto ordinate per data nel raggio richiesto

CREATE OR REPLACE FUNCTION get_local_feed(
    lat FLOAT,
    lng FLOAT,
    radius_meters INT DEFAULT 5000
)
RETURNS TABLE (
    photo_id UUID,
    url TEXT,
    caption TEXT,
    user_avatar TEXT, -- Join con user_metadata o explorers
    created_at TIMESTAMPTZ,
    distance_meters FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    center_point GEOGRAPHY;
BEGIN
    center_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;

    RETURN QUERY
    SELECT
        p.id as photo_id,
        p.media_url as url,
        p.caption,
        'avatar_placeholder.png'::text as user_avatar, -- O join complessa con auth.users
        p.created_at,
        ST_Distance(p.location, center_point) as distance_meters
    FROM user_photos p
    WHERE ST_DWithin(p.location, center_point, radius_meters)
    ORDER BY p.created_at DESC -- Più recenti prima
    LIMIT 50; -- Paginazione implicita per performance
END;
$$;
