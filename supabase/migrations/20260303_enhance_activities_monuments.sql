-- =================================================================================
-- MIGRAZIONE: Arricchimento tabella activities per POI / Monumenti
-- Audit ref: Flow Audit 2026-03-03
--
-- Aggiunge le colonne necessarie per la scheda completa di un monumento:
--   curiosità storiche, icona personalizzata, orari, ingresso, durata suggerita.
--
-- Retrocompatibile: tutte le colonne hanno DEFAULT o accettano NULL,
-- quindi le righe esistenti non vengono invalidate.
-- =================================================================================

-- ── type ──────────────────────────────────────────────────────────────────────
-- Distingue il POI: 'monument' | 'museum' | 'church' | 'viewpoint' | 'poi'
-- Usato da UnnivaiMap.getIcon() e dal filtro categoria in MapPage.
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'poi';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activities_type_check'
          AND conrelid = 'public.activities'::regclass
    ) THEN
        ALTER TABLE public.activities
            ADD CONSTRAINT activities_type_check
            CHECK (type IN ('monument','museum','church','viewpoint','poi','food','shopping','nature','sport'));
    END IF;
END $$;

-- ── icon ──────────────────────────────────────────────────────────────────────
-- Emoji unicode mostrata nel marker della mappa e nella scheda dettaglio.
-- Esempi: '🏛️' (monumento), '⛪' (chiesa), '🏰' (castello), '🗿' (statua).
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS icon TEXT;

-- ── historical_notes ─────────────────────────────────────────────────────────
-- Testo libero con le curiosità storiche del monumento.
-- Mostrato nella scheda dettaglio sotto il titolo.
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS historical_notes TEXT;

-- ── fun_facts ────────────────────────────────────────────────────────────────
-- Array di brevi curiosità mostrate come bullet points nella scheda.
-- Esempio: ARRAY['Costruito nel 1506','Alta 57 metri','Patrimonio UNESCO']
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS fun_facts TEXT[];

-- ── opening_hours ─────────────────────────────────────────────────────────────
-- JSONB con orari strutturati per giorno della settimana.
-- Formato atteso dal codice:
--   { "lun": "09:00-18:00", "mar": "09:00-18:00", ..., "dom": "Chiuso" }
-- NULL = orari non disponibili (mostrato "Orari non disponibili" in UI).
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS opening_hours JSONB;

-- ── website_url ───────────────────────────────────────────────────────────────
-- URL ufficiale del sito web del monumento / museo.
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ── image_url ────────────────────────────────────────────────────────────────
-- URL dell'immagine copertina mostrata nella scheda dettaglio.
-- Fallback: UnnivaiMap usa già getItemImage() se questo è NULL.
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── admission_fee ─────────────────────────────────────────────────────────────
-- Costo del biglietto in EUR. NULL = ingresso gratuito.
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10, 2);

-- ── duration_minutes ─────────────────────────────────────────────────────────
-- Durata suggerita della visita in minuti.
-- Mostrato nella scheda come "Visita consigliata: X min".
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- ── Indici ────────────────────────────────────────────────────────────────────
-- Filtraggio per tipo (es. "mostra solo i monumenti") usato da MapPage filters.
CREATE INDEX IF NOT EXISTS idx_activities_type
    ON public.activities(type);

-- Filtraggio combinato (città + tipo) — il pattern più comune in getActivitiesByCity.
CREATE INDEX IF NOT EXISTS idx_activities_city_type
    ON public.activities(city, type);
