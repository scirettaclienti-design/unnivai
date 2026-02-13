-- =================================================================================
-- LOGICA DI BACKEND: ATTIVITÀ (BUSINESS) & MOTORE DI MATCHING
-- =================================================================================

-- 1. ROW LEVEL SECURITY (RLS) - SICUREZZA BUSINESS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Lettura: Pubblica per tutti
CREATE POLICY "Public Read Activities" ON activities
FOR SELECT USING (true);

-- Insert: Qualsiasi utente autenticato può creare UN'attività
-- Nota: L'owner_id verrà forzato dal DB, ma qui permettiamo l'INSERT generico.
CREATE POLICY "User Create Activity" ON activities
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Update: SOLO il proprietario (owner_id = auth.uid())
-- MA ATTENZIONE: Bloccheremo la modifica di colonne sensibili (subscription_tier) via Trigger o Column-Level Security (non supportato nativamente in RLS semplice, usiamo Trigger).
CREATE POLICY "User Update Own Activity" ON activities
FOR UPDATE USING (auth.uid() = owner_id);

-- Delete: SOLO il proprietario
CREATE POLICY "User Delete Own Activity" ON activities
FOR DELETE USING (auth.uid() = owner_id);


-- 2. TRIGGER DEFAULT SUBSCRIPTION & PROTEZIONE TIER
-- Forza 'free' alla creazione e impedisce modifica utente del tier

CREATE OR REPLACE FUNCTION protect_activity_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- INSERIMENTO: Forza sempre 'free', ignora input utente
    IF (TG_OP = 'INSERT') THEN
        NEW.subscription_tier := 'free';
        RETURN NEW;
    
    -- AGGIORNAMENTO: Se l'utente prova a cambiare tier, ignora o lancia errore
    -- Qui scegliamo di IGNORARE silenziosamente il cambiamento (reset al vecchio valore)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Se il tier è cambiato E non siamo in un contesto privilegiato (es. Admin function), resetta
        -- Nota: In Supabase, auth.uid() è null per le Service Role Functions, quindi admin.
        -- Se c'è un utente loggato (auth.uid() non null), non può cambiare tier.
        IF (NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier) AND (auth.uid() IS NOT NULL) THEN
            NEW.subscription_tier := OLD.subscription_tier;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_activity_tier ON activities;
CREATE TRIGGER tr_protect_activity_tier
BEFORE INSERT OR UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION protect_activity_subscription();


-- 3. IL MOTORE DI MATCHING (RPC: SEARCH_NEARBY_PARTNERS)
-- Funzione core per le Guide: Trova partner ideali nelle vicinanze, ordinati per business value.

CREATE OR REPLACE FUNCTION search_nearby_partners(
    lat FLOAT,
    lng FLOAT,
    radius_meters INT DEFAULT 1000,
    filter_tag TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    location_lat FLOAT,
    location_lng FLOAT,
    tier activity_tier,
    distance_meters FLOAT,
    reliability_score INT -- Extra: punteggio per ordinamento interno
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_location GEOGRAPHY;
BEGIN
    -- Costruisci il punto geografico input
    user_location := ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;

    RETURN QUERY
    SELECT
        a.id,
        a.name,
        ST_Y(a.location::geometry) as location_lat,
        ST_X(a.location::geometry) as location_lng,
        a.subscription_tier as tier,
        ST_Distance(a.location, user_location) as distance_meters,
        
        -- Calcolo Score interno per ordinamento
        CASE 
            WHEN a.subscription_tier = 'premium' THEN 3
            WHEN a.subscription_tier = 'base' THEN 2
            ELSE 1
        END as reliability_score
        
    FROM activities a
    WHERE
        -- Filtro Spaziale (PostGIS Index-Optimized)
        ST_DWithin(a.location, user_location, radius_meters)
        
        AND (
            filter_tag IS NULL OR 
            filter_tag = '' OR
            -- Cerca nell'array dei tag
            filter_tag = ANY(a.vibe_tags) OR
            -- Cerca nel nome (case-insensitive)
            a.name ILIKE ('%' || filter_tag || '%')
        )
        
    ORDER BY
        -- 1. BUSINESS VALUE: Premium prima, poi Base, poi Free
        reliability_score DESC,
        -- 2. PROSSIMITÀ: Più vicini prima (Secondary Sort)
        distance_meters ASC;
END;
$$;
