-- =================================================================================
-- REPAIR SCRIPT: FIX TOURS SCHEMA & PERMISSIONS
-- Run this in the Supabase SQL Editor to fix the "Foreign Key Constraint" error.
-- =================================================================================

-- 1. FIX FOREIGN KEY CONSTRAINT on 'tours' table
-- We drop the possibly broken constraint and re-add a safe one pointing to auth.users
DO $$ 
BEGIN 
    -- Try to drop constraint if it exists with standard name
    BEGIN
        ALTER TABLE tours DROP CONSTRAINT IF EXISTS tours_guide_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Ensure guide_id matches the user's UUID
ALTER TABLE tours 
    DROP CONSTRAINT IF EXISTS tours_guide_id_fkey;

ALTER TABLE tours 
    ADD CONSTRAINT tours_guide_id_fkey 
    FOREIGN KEY (guide_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- 2. ADD MISSING COLUMNS (Required by the new TourBuilder)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 10;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'Italiano';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS start_location GEOGRAPHY(POINT, 4326);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT true;

-- 3. FIX PERMISSIONS (RLS)
-- Often the error is masked as a constraint error but is actually an RLS issue
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

-- Allow Guides to Insert (Check ensures they only insert with their own ID)
DROP POLICY IF EXISTS "Guides can insert own tours" ON tours;
CREATE POLICY "Guides can insert own tours" ON tours 
    FOR INSERT 
    WITH CHECK (auth.uid() = guide_id);

-- Allow Guides to Update their own tours
DROP POLICY IF EXISTS "Guides can update own tours" ON tours;
CREATE POLICY "Guides can update own tours" ON tours 
    FOR UPDATE 
    USING (auth.uid() = guide_id);

-- Allow Guides to View their own tours
DROP POLICY IF EXISTS "Guides can view own tours" ON tours;
CREATE POLICY "Guides can view own tours" ON tours 
    FOR SELECT 
    USING (auth.uid() = guide_id);

-- Allow Public to View Live tours
DROP POLICY IF EXISTS "Public can view live tours" ON tours;
CREATE POLICY "Public can view live tours" ON tours 
    FOR SELECT 
    USING (is_live = true);

-- 4. ENSURE GUIDES PROFILE EXISTS (Optional safety check)
CREATE TABLE IF NOT EXISTS guides_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending'
);

-- Enable RLS on profiles to be safe
ALTER TABLE guides_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON guides_profile;
CREATE POLICY "Users can manage own profile" ON guides_profile
    FOR ALL
    USING (auth.uid() = user_id);
