-- =================================================================================
-- CORREZIONE TABELLA TOURS PER FILTRI FRONTEND (CRITICO)
-- Obiettivo: Aggiungere colonne strutturate per evitare full-scan su JSONB
-- =================================================================================

-- 1. Aggiungi colonne per Filtri Rapidi
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS price_eur DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS max_participants INT DEFAULT 10;

-- 2. Crea Indici per Velocizzare le Query Filtrate
CREATE INDEX IF NOT EXISTS idx_tours_price ON tours(price_eur);
CREATE INDEX IF NOT EXISTS idx_tours_city ON tours(city);
CREATE INDEX IF NOT EXISTS idx_tours_duration ON tours(duration_minutes);

-- 3. (Opzionale) Popola i dati esistenti estraendo dal vecchio JSON se necessario
-- UPDATE tours 
-- SET price_eur = (data->>'price')::decimal,
--     duration_minutes = (data->>'duration')::int
-- WHERE price_eur = 0;
