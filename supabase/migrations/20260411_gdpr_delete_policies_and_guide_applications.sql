-- DVAI-013: GDPR DELETE Policies
-- Aggiunge policy DELETE per ogni tabella user-owned.
-- Consente agli utenti di cancellare i propri dati (diritto all'oblio GDPR).
-- Crea anche la tabella guide_applications per DVAI-015.

-- ─── DELETE POLICIES ──────────────────────────────────────────────────────────

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can delete own profile'
  ) THEN
    CREATE POLICY "Users can delete own profile"
      ON profiles FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;

-- bookings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'Users can delete own bookings'
  ) THEN
    CREATE POLICY "Users can delete own bookings"
      ON bookings FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- favorites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'favorites' AND policyname = 'Users can delete own favorites'
  ) THEN
    CREATE POLICY "Users can delete own favorites"
      ON favorites FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications"
      ON notifications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- guide_requests (come utente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guide_requests' AND policyname = 'Users can delete own guide_requests'
  ) THEN
    CREATE POLICY "Users can delete own guide_requests"
      ON guide_requests FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- guides_profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guides_profile' AND policyname = 'Guides can delete own profile'
  ) THEN
    CREATE POLICY "Guides can delete own profile"
      ON guides_profile FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- businesses_profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'businesses_profile' AND policyname = 'Business can delete own profile'
  ) THEN
    CREATE POLICY "Business can delete own profile"
      ON businesses_profile FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- user_photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_photos' AND policyname = 'Users can delete own photos'
  ) THEN
    CREATE POLICY "Users can delete own photos"
      ON user_photos FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- explorers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'explorers' AND policyname = 'Explorers can delete own row'
  ) THEN
    CREATE POLICY "Explorers can delete own row"
      ON explorers FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;

-- ─── DVAI-015: guide_applications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  surname     TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  city        TEXT,
  experience  TEXT,
  motivation  TEXT,
  languages   TEXT[],
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guide_applications ENABLE ROW LEVEL SECURITY;

-- Chiunque autenticato può inserire la propria candidatura
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guide_applications' AND policyname = 'Authenticated users can apply as guide'
  ) THEN
    CREATE POLICY "Authenticated users can apply as guide"
      ON guide_applications FOR INSERT
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- Gli utenti possono vedere solo le proprie candidature
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guide_applications' AND policyname = 'Users can view own applications'
  ) THEN
    CREATE POLICY "Users can view own applications"
      ON guide_applications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Gli utenti possono cancellare le proprie candidature
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'guide_applications' AND policyname = 'Users can delete own applications'
  ) THEN
    CREATE POLICY "Users can delete own applications"
      ON guide_applications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_guide_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guide_applications_updated_at ON guide_applications;
CREATE TRIGGER guide_applications_updated_at
  BEFORE UPDATE ON guide_applications
  FOR EACH ROW EXECUTE FUNCTION update_guide_applications_updated_at();
