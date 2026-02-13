-- =================================================================================
-- LOGICA DI BACKEND: GUIDE, SICUREZZA, COMMISSIONI E VALIDAZIONE
-- =================================================================================

-- 1. ROW LEVEL SECURITY (RLS) - "Blindiamo i dati"
-- Abilita RLS sulle tabelle
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

-- Policy GUIDES
-- Lettura: Pubblica
CREATE POLICY "Public Read Guides" ON guides
FOR SELECT USING (true);

-- Modifica/Inserimento: Solo l'utente proprietario (auth.uid())
CREATE POLICY "User Manage Own Guide Profile" ON guides
FOR ALL USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy TOURS
-- Lettura: Pubblica
CREATE POLICY "Public Read Tours" ON tours
FOR SELECT USING (true);

-- Insert: Solo guide registrate e proprietarie
CREATE POLICY "Guide Insert Tours" ON tours
FOR INSERT WITH CHECK (
    auth.uid() = guide_id AND
    EXISTS (SELECT 1 FROM guides WHERE id = auth.uid())
);

-- Update: Solo proprietario
CREATE POLICY "Guide Update Own Tours" ON tours
FOR UPDATE USING (auth.uid() = guide_id);

-- Delete: Solo proprietario
CREATE POLICY "Guide Delete Own Tours" ON tours
FOR DELETE USING (auth.uid() = guide_id);


-- 2. FUNZIONE DATABASE: CALCOLO COMMISSIONI DINAMICO
-- Restituisce la % di commissione basata sul livello
CREATE OR REPLACE FUNCTION get_tour_commission(query_guide_id UUID)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
SECURITY DEFINER -- Esegue con i permessi del creatore della funzione (bypass RLS se necessario per leggere guides)
AS $$
DECLARE
    guide_lvl guide_level;
BEGIN
    -- Recupera il livello della guida
    SELECT level INTO guide_lvl FROM guides WHERE id = query_guide_id;
    
    -- Gestione Errore
    IF guide_lvl IS NULL THEN
        RAISE EXCEPTION 'Guida non trovata con ID %', query_guide_id;
    END IF;

    -- Logica di Business
    IF guide_lvl = 'esploratore' THEN
        RETURN 20.00;
    ELSIF guide_lvl = 'ambasciatore' THEN
        RETURN 15.00;
    ELSIF guide_lvl = 'mentore' THEN
        RETURN 10.00;
    ELSE
        -- Fallback di sicurezza
        RETURN 20.00;
    END IF;
END;
$$;


-- 3. TRIGGER AUTOMATICO: FORCE DEFAULT STATUS
-- Nessuno deve poter forzare status o ranking da API
CREATE OR REPLACE FUNCTION force_new_guide_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.status := 'pending';
    NEW.level := 'esploratore';
    NEW.ranking_score := 0;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_force_new_guide_defaults ON guides;
CREATE TRIGGER tr_force_new_guide_defaults
BEFORE INSERT ON guides
FOR EACH ROW
EXECUTE FUNCTION force_new_guide_defaults();


-- 4. VALIDAZIONE TOUR (CONSTRAINTS)
-- Impedisce salvataggio di dati sporchi
ALTER TABLE tours
ADD CONSTRAINT check_tour_price_positive CHECK (price_eur >= 0),
ADD CONSTRAINT check_tour_title_len CHECK (LENGTH(title) >= 5);
