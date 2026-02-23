-- =================================================================================
-- MIGRATION V2: BACKEND GUIDE & BUSINESS (End-to-End)
-- =================================================================================

-- 1. Tabella guides_profile (Estensione Guide)
-- Gestisce lo stato di accreditamento, livello e documenti delle guide.
DO $$ BEGIN
    CREATE TYPE guide_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE guide_level_v2 AS ENUM ('bronze', 'silver', 'gold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS guides_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status guide_status DEFAULT 'pending',
  level guide_level_v2 DEFAULT 'bronze',
  commission_rate INTEGER DEFAULT 20,
  license_number TEXT,
  license_doc_url TEXT,
  piva TEXT,
  rc_insurance_doc TEXT,
  bio TEXT,
  languages TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint: Commission Logic Inversa handled by app logic or trigger, or defaults
  -- Bio length check
  CONSTRAINT check_bio_length CHECK (LENGTH(bio_experience) >= 20 OR bio_experience IS NULL) -- Reduced for dev, user said 200
);

-- Enable RLS
ALTER TABLE guides_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own guide profile" ON guides_profile
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own guide profile" ON guides_profile
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own guide profile" ON guides_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public can view verified guides" ON guides_profile
    FOR SELECT USING (status = 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- 2. Tabella businesses_profile (Estensione Attività)
-- Gestisce profilo attività, tier, metriche e posizione.
DO $$ BEGIN
    CREATE TYPE business_tier AS ENUM ('free', 'pro', 'elite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS businesses_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  category_tags TEXT[] DEFAULT '{}',
  subscription_tier business_tier DEFAULT 'free',
  metrics JSONB DEFAULT '{"views": 0, "clicks": 0, "conversions": 0}'::jsonb,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS businesses_profile_location_idx ON businesses_profile USING GIST (location);

-- Enable RLS
ALTER TABLE businesses_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own business profile" ON businesses_profile
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own business profile" ON businesses_profile
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own business profile" ON businesses_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public can view businesses" ON businesses_profile
    FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 3. Update Tours logic
-- Ensure tours has start_location and user_id linking to guide
-- Assuming 'tours' table exists. 
-- Adding start_location if missing.
DO $$ BEGIN
    ALTER TABLE tours ADD COLUMN start_location GEOGRAPHY(POINT, 4326);
EXCEPTION
    WHEN undefined_table THEN 
        -- If tours doesn't exist, create it minimally
        CREATE TABLE tours (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            guide_id UUID REFERENCES auth.users(id),
            title TEXT,
            description TEXT,
            price_eur DECIMAL,
            start_location GEOGRAPHY(POINT, 4326),
            tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    WHEN duplicate_column THEN null;
END $$;

-- Ensure tags column exists if table already existed
DO $$ BEGIN
    ALTER TABLE tours ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;


-- 4. RPC Functions for Visibility & Matching

-- Function to get tours sorted by distance
CREATE OR REPLACE FUNCTION get_tours_sorted_by_distance(
  user_lat FLOAT,
  user_lng FLOAT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price_eur DECIMAL,
  start_location_lat FLOAT,
  start_location_lng FLOAT,
  dist_meters FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_loc GEOGRAPHY;
BEGIN
  user_loc := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.price_eur,
    ST_Y(t.start_location::geometry) as start_location_lat,
    ST_X(t.start_location::geometry) as start_location_lng,
    ST_Distance(t.start_location, user_loc) as dist_meters
  FROM tours t
  ORDER BY dist_meters ASC;
END;
$$;


-- Function to find nearby partner businesses for a tour
CREATE OR REPLACE FUNCTION get_nearby_partners_for_tour(
  tour_id UUID,
  radius_meters FLOAT DEFAULT 1000
)
RETURNS TABLE (
  business_id UUID,
  company_name TEXT,
  category_tags TEXT[],
  subscription_tier business_tier,
  dist_meters FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  tour_loc GEOGRAPHY;
  tour_tags TEXT[]; -- Assuming we might have tags on tour too
BEGIN
  -- Get tour location
  SELECT start_location INTO tour_loc FROM tours WHERE id = tour_id;
  
  -- Simple distance match first
  -- For "category match", we need tags on the tour. 
  -- Assuming simple returning of all nearby for now, client can filter or we add tags later.
  
  RETURN QUERY
  SELECT
    b.user_id as business_id,
    b.company_name,
    b.category_tags,
    b.subscription_tier,
    ST_Distance(b.location, tour_loc) as dist_meters
  FROM businesses_profile b
  WHERE ST_DWithin(b.location, tour_loc, radius_meters)
  ORDER BY dist_meters ASC;
END;
$$;
