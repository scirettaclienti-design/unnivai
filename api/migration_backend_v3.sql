-- =================================================================================
-- MIGRATION V3: UBER FOR GUIDES (Host Model & Real-Time Requests)
-- =================================================================================

-- 1. MODIFICA TABELLA guides_profile (Host vs Pro)
-- Rendiamo opzionali i campi legali e aggiungiamo il tipo di guida.

-- Aggiungi il tipo ENUM per la guida
DO $$ BEGIN
    CREATE TYPE guide_type AS ENUM ('pro', 'host');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Modifica la tabella guides_profile
ALTER TABLE guides_profile
ADD COLUMN IF NOT EXISTS type guide_type DEFAULT 'host',
ALTER COLUMN license_number DROP NOT NULL,
ALTER COLUMN license_doc_url DROP NOT NULL,
ALTER COLUMN rc_insurance_doc DROP NOT NULL;

-- Trigger automatico: Se c'è license_number, diventa 'pro', altrimenti 'host'
CREATE OR REPLACE FUNCTION update_guide_type()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.license_number IS NOT NULL AND LENGTH(NEW.license_number) > 0 THEN
        NEW.type := 'pro';
    ELSE
        NEW.type := 'host';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_guide_type ON guides_profile;
CREATE TRIGGER tr_update_guide_type
BEFORE INSERT OR UPDATE OF license_number ON guides_profile
FOR EACH ROW
EXECUTE FUNCTION update_guide_type();


-- 2. NUOVA TABELLA: guide_requests (Il cuore di Uber)
-- Gestisce le richieste in tempo reale degli utenti.

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('open', 'accepted', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS guide_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_guide_id UUID REFERENCES auth.users(id), -- Chi ha preso il lavoro
    location GEOGRAPHY(POINT, 4326),
    category TEXT, -- 'History', 'Food', 'Nightlife', etc.
    duration_hours INT DEFAULT 2,
    status request_status DEFAULT 'open',
    price_offer DECIMAL, -- Prezzo stimato/offerto
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice spaziale per ricerche veloci "vicino a me"
CREATE INDEX IF NOT EXISTS guide_requests_location_idx ON guide_requests USING GIST (location);

-- Enable RLS
ALTER TABLE guide_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Utente può vedere e gestire le proprie richieste
CREATE POLICY "Users manage own requests" ON guide_requests
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Guide possono vedere le richieste 'open' vicine (o tutte per semplicità MVP)
-- E possono vedere quelle assegnate a loro
CREATE POLICY "Guides view open requests" ON guide_requests
    FOR SELECT USING (
        (status = 'open') OR 
        (assigned_guide_id = auth.uid()) OR
        (user_id = auth.uid())
    );

-- Policy: Guide possono prendere in carico (UPDATE) le richieste open
CREATE POLICY "Guides accept requests" ON guide_requests
    FOR UPDATE USING (status = 'open' OR assigned_guide_id = auth.uid());


-- 3. FLUSSO INTELLIGENTE (RPC: MATCH REQUESTS)
-- Funzione per la Dashboard Guida: Trova richieste pertinenti
-- Logica: 
--   - Se sono 'pro', vedo TUTTO.
--   - Se sono 'host', vedo SOLO 'Food', 'Lifestyle', 'Nightlife', 'Relax'.
--   - Ordina per distanza.

CREATE OR REPLACE FUNCTION get_nearby_requests_for_guide(
    guide_lat FLOAT,
    guide_lng FLOAT,
    guide_radius_km INT DEFAULT 50
)
RETURNS TABLE (
    request_id UUID,
    user_name TEXT, -- Join simulato o recuperato da metadata se possibile, qui torniamo placeholder o ID
    category TEXT,
    duration INT,
    distance_km FLOAT,
    status request_status,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    my_type guide_type;
    guide_loc GEOGRAPHY;
BEGIN
    -- Recupera il tipo della guida che sta chiamando
    SELECT type INTO my_type FROM guides_profile WHERE user_id = auth.uid();
    
    -- Se non trova profilo, assume 'host' (fallback sicurezza)
    IF my_type IS NULL THEN 
        my_type := 'host'; 
    END IF;

    guide_loc := ST_SetSRID(ST_MakePoint(guide_lng, guide_lat), 4326)::geography;

    RETURN QUERY
    SELECT
        r.id as request_id,
        'Utente ' || substring(r.user_id::text, 1, 4) as user_name, -- Placeholder privacy
        r.category,
        r.duration_hours as duration,
        (ST_Distance(r.location, guide_loc) / 1000) as distance_km,
        r.status,
        r.created_at
    FROM guide_requests r
    WHERE
        r.status = 'open'
        AND ST_DWithin(r.location, guide_loc, guide_radius_km * 1000)
        AND (
            -- Logica di Business:
            -- Se sono PRO, vedo tutto.
            my_type = 'pro'
            OR 
            -- Se sono HOST, vedo solo categorie "soft"
            (my_type = 'host' AND r.category IN ('Food', 'Lifestyle', 'Nightlife', 'Relax', 'Shopping'))
        )
    ORDER BY r.created_at DESC; -- Prima le più recenti
END;
$$;
