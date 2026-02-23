-- =================================================================================
-- REPAIR KIT: FORCE SCHEMA SYNC
-- Esegui questo script per riparare la tabella guides_profile e assicurarti che tutte le colonne esistano.
-- =================================================================================

-- 1. Assicuriamoci che i TIPI ENUM esistano
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

DO $$ BEGIN
    CREATE TYPE guide_type AS ENUM ('pro', 'host');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Forza l'aggiunta delle colonne mancanti su guides_profile
-- Se la tabella esiste già ma mancano le colonne, questo comando le aggiunge.

CREATE TABLE IF NOT EXISTS guides_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS status guide_status DEFAULT 'pending';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS level guide_level_v2 DEFAULT 'bronze';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS type guide_type DEFAULT 'host';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 20;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS license_number TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS license_doc_url TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS piva TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS rc_insurance_doc TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE guides_profile ADD COLUMN IF NOT EXISTS bio TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 3. Rimuovi la vecchia colonna bio_experience se esiste ancora per evitare confusione
DO $$ BEGIN
    ALTER TABLE guides_profile DROP COLUMN IF EXISTS bio_experience;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- 4. Assicuriamoci che i Trigger siano attivi
CREATE OR REPLACE FUNCTION update_guide_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Logica corretta: se c'è license_number, diventa PRO, altrimenti HOST
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

-- 5. Refresh della cache di schema (tocco finale)
NOTIFY pgrst, 'reload schema';
