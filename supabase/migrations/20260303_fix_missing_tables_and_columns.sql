-- =================================================================================
-- MIGRAZIONE: Tabelle e colonne mancanti
-- Audit ref: Flow Audit 2026-03-03
--
-- Risolve i seguenti gap individuati nell'audit:
--   1. guide_requests  → aggiunge user_id, status, created_at, duration, category, notes
--   2. guides_profile  → crea la tabella completa con tutte le colonne usate dal codice
--   3. explorers       → crea la tabella per le statistiche dell'esploratore
--   4. user_photos     → crea la tabella per le foto caricate dagli utenti
--   5. favorites       → crea la tabella per i tour preferiti (usata in dataService.js)
--   6. notifications   → aggiunge is_read, read_at, action_text, action_type, action_url, action_data
--
-- COME ESEGUIRE:
--   Supabase Dashboard → SQL Editor → incolla ed esegui questo file
-- =================================================================================


-- =================================================================================
-- HELPER: funzione per updated_at automatico (CREATE OR REPLACE è idempotente)
-- =================================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- =================================================================================
-- 1. GUIDE_REQUESTS — Colonne mancanti
--
--    Tabella esistente. La migrazione 20240223 aveva già aggiunto:
--    guide_id, tour_id, request_text, city, user_name.
--    Questo script aggiunge le colonne ancora mancanti referenziate dal codice.
-- =================================================================================

-- user_id: chi ha inviato la richiesta (esploratore)
--   Usato in: TourDetails.jsx:262, DashboardUser.jsx:140, Profile.jsx:107
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- status: ciclo di vita della richiesta
--   Valori attesi dal codice: 'open', 'accepted', 'declined', 'completed'
--   DEFAULT 'open' per retrocompatibilità con righe già presenti.
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

-- Aggiunge il CHECK solo se la colonna è appena stata creata (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'guide_requests_status_check'
          AND conrelid = 'public.guide_requests'::regclass
    ) THEN
        ALTER TABLE public.guide_requests
            ADD CONSTRAINT guide_requests_status_check
            CHECK (status IN ('open', 'accepted', 'declined', 'completed'));
    END IF;
END $$;

-- created_at: timestamp di creazione, usato per .order('created_at', ...)
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- duration: ore richieste dall'utente
--   DashboardUser.jsx inserisce: duration: 3
--   DashboardGuide.jsx legge:    req.duration || 3
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 3;

-- category: tipo di esperienza richiesta
--   DashboardUser.jsx inserisce: category: 'custom'
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'custom';

-- notes: campo alternativo a request_text (TourDetails.jsx inserisce notes: richMessage)
ALTER TABLE public.guide_requests
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Indici per pattern di query esistenti
CREATE INDEX IF NOT EXISTS idx_guide_requests_user_id
    ON public.guide_requests(user_id);

-- (già presente in 20240223, ma CREATE INDEX IF NOT EXISTS è idempotente)
CREATE INDEX IF NOT EXISTS idx_guide_requests_guide_id
    ON public.guide_requests(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_requests_status
    ON public.guide_requests(status);

-- RLS: DROP + RECREATE delle policy che referenziavano user_id prima che esistesse
ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guides view own and open requests" ON public.guide_requests;
CREATE POLICY "Guides view own and open requests"
    ON public.guide_requests FOR SELECT
    USING (
        auth.uid() = user_id                              -- l'utente vede le proprie richieste
        OR (guide_id IS NOT NULL AND guide_id = auth.uid()) -- la guida assegnata vede la richiesta
        OR guide_id IS NULL                               -- richieste aperte visibili a tutte le guide
    );

DROP POLICY IF EXISTS "Users can insert guide requests" ON public.guide_requests;
CREATE POLICY "Users can insert guide requests"
    ON public.guide_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Guide aggiornano status e guide_id (accept/decline/price offer)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'guide_requests'
          AND policyname = 'Guides can update guide requests'
    ) THEN
        CREATE POLICY "Guides can update guide requests"
            ON public.guide_requests FOR UPDATE
            USING (
                auth.uid() = guide_id
                OR (guide_id IS NULL AND auth.uid() IS NOT NULL)
            );
    END IF;
END $$;


-- =================================================================================
-- 2. GUIDES_PROFILE — Creazione tabella
--
--    Colonne derivate dall'analisi di DashboardGuide.jsx:
--      Fetch:  .select('*').eq('user_id', user.id).single()
--      Insert: { user_id }  (creazione automatica al primo accesso guida)
--      Update: { license_number, piva, bio, status }
--      Update: { operating_cities }
--      Read:   .type, .full_name, .operating_cities, .tours_count, .rating
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.guides_profile (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- FK all'utente autenticato (relazione uno-a-uno)
    user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Dati personali: sincronizzati con auth.users ma denormalizzati per join veloci
    full_name        TEXT,
    avatar_url       TEXT,

    -- Form accreditamento (DashboardGuide.jsx: accreditationForm)
    license_number   TEXT,
    piva             TEXT,
    bio              TEXT,

    -- Stato accreditamento
    --   'pending'  → appena registrato (default)
    --   'verified' → form accreditamento inviato con successo
    --   'rejected' → rifiutato dall'amministratore
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'verified', 'rejected')),

    -- Tipo guida (DashboardGuide.jsx: updated.type === 'pro' ? 'PROFESSIONISTA' : 'LOCAL HOST')
    type             TEXT        NOT NULL DEFAULT 'host'
                                 CHECK (type IN ('pro', 'host')),

    -- Array di città in cui la guida offre servizi
    --   Usato per filtrare le richieste in arrivo (.includes(r.city))
    operating_cities TEXT[]      NOT NULL DEFAULT '{}',

    -- Statistiche aggregate (aggiornabili manualmente o tramite trigger applicativo)
    tours_count      INTEGER     NOT NULL DEFAULT 0,
    rating           NUMERIC(3,2) NOT NULL DEFAULT 5.00,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_guides_profile_updated_at ON public.guides_profile;
CREATE TRIGGER trg_guides_profile_updated_at
    BEFORE UPDATE ON public.guides_profile
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.guides_profile ENABLE ROW LEVEL SECURITY;

-- Chiunque può leggere: i profili guida compaiono nelle card tour pubbliche
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'guides_profile'
          AND policyname = 'Guide profiles are viewable by everyone'
    ) THEN
        CREATE POLICY "Guide profiles are viewable by everyone"
            ON public.guides_profile FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'guides_profile'
          AND policyname = 'Guides can insert own profile'
    ) THEN
        CREATE POLICY "Guides can insert own profile"
            ON public.guides_profile FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'guides_profile'
          AND policyname = 'Guides can update own profile'
    ) THEN
        CREATE POLICY "Guides can update own profile"
            ON public.guides_profile FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;


-- =================================================================================
-- 3. EXPLORERS — Creazione tabella
--
--    Colonne derivate da Profile.jsx:
--      Fetch: .select('tours_completed, km_walked').eq('id', userId).single()
--      Read:  explorer.tours_completed
--    Nota: PK è 'id' = user_id (pattern identico a profiles), non un UUID separato.
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.explorers (
    -- PK coincide con user_id (relazione uno-a-uno, come il pattern di profiles)
    id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Statistiche lette da Profile.jsx
    tours_completed  INTEGER     NOT NULL DEFAULT 0,
    km_walked        NUMERIC(8,2) NOT NULL DEFAULT 0.00,

    -- Statistiche aggiuntive (attualmente mock in Profile.jsx, struttura pronta)
    guides_met       INTEGER     NOT NULL DEFAULT 0,
    photos_uploaded  INTEGER     NOT NULL DEFAULT 0,
    rating           NUMERIC(3,2) NOT NULL DEFAULT 5.00,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_explorers_updated_at ON public.explorers;
CREATE TRIGGER trg_explorers_updated_at
    BEFORE UPDATE ON public.explorers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.explorers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'explorers'
          AND policyname = 'Explorers can view own record'
    ) THEN
        CREATE POLICY "Explorers can view own record"
            ON public.explorers FOR SELECT
            USING (auth.uid() = id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'explorers'
          AND policyname = 'Explorers can insert own record'
    ) THEN
        CREATE POLICY "Explorers can insert own record"
            ON public.explorers FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'explorers'
          AND policyname = 'Explorers can update own record'
    ) THEN
        CREATE POLICY "Explorers can update own record"
            ON public.explorers FOR UPDATE
            USING (auth.uid() = id);
    END IF;
END $$;


-- =================================================================================
-- 4. USER_PHOTOS — Creazione tabella
--
--    Colonne derivate da Profile.jsx:
--      Fetch: .select('id, media_url, created_at, tour_id, tours(id, title, ...)')
--             .eq('user_id', userId)
--      Read:  photo.media_url, photo.created_at, photo.tours.title, photo.tours.rating
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.user_photos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Proprietario della foto
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Tour collegato (JOIN Profile.jsx: tours(id, title, ...))
    -- SET NULL: la foto rimane visibile anche se il tour viene eliminato
    tour_id     UUID        REFERENCES public.tours(id) ON DELETE SET NULL,

    -- URL del media (Supabase Storage o URL esterno)
    media_url   TEXT        NOT NULL,

    -- Metadati opzionali
    caption     TEXT,
    city        TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_photos_user_id
    ON public.user_photos(user_id);

ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_photos'
          AND policyname = 'Users can view own photos'
    ) THEN
        CREATE POLICY "Users can view own photos"
            ON public.user_photos FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_photos'
          AND policyname = 'Users can insert own photos'
    ) THEN
        CREATE POLICY "Users can insert own photos"
            ON public.user_photos FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_photos'
          AND policyname = 'Users can delete own photos'
    ) THEN
        CREATE POLICY "Users can delete own photos"
            ON public.user_photos FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;


-- =================================================================================
-- 5. FAVORITES — Creazione tabella
--
--    Colonne derivate da dataService.js (toggleFavorite):
--      Check:  .select('id').eq('user_id').eq('tour_id').maybeSingle()
--      Insert: { user_id, tour_id }
--      Delete: .delete().eq('id', existing.id)
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tour_id     UUID        NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Vincolo univoco: impedisce duplicati silenti in toggleFavorite
    CONSTRAINT favorites_user_tour_unique UNIQUE (user_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id
    ON public.favorites(user_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'favorites'
          AND policyname = 'Users can view own favorites'
    ) THEN
        CREATE POLICY "Users can view own favorites"
            ON public.favorites FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'favorites'
          AND policyname = 'Users can insert own favorites'
    ) THEN
        CREATE POLICY "Users can insert own favorites"
            ON public.favorites FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'favorites'
          AND policyname = 'Users can delete own favorites'
    ) THEN
        CREATE POLICY "Users can delete own favorites"
            ON public.favorites FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;


-- =================================================================================
-- 6. NOTIFICATIONS — Unificazione campo is_read + colonne mancanti
--
--    Audit ha rilevato tre nomi diversi per lo stesso concetto:
--      - INSERT (DashboardGuide.jsx):      is_read: false
--      - READ   (dataService.js:305):      n.is_read === true || !!n.read_at
--      - REALTIME (dataService.js:338):    !!n.read       ← terzo nome, mai inserito
--      - UPDATE (useUserNotifications.js): .update({ is_read: true })
--
--    Soluzione adottata:
--      is_read   → colonna canonica booleana (usata in tutti gli INSERT e UPDATE)
--      read_at   → timestamp opzionale per audit (quando è stata letta)
--      'read'    → nel payload realtime rifletterà 'is_read' (il frontend dovrà
--                  leggere n.is_read invece di n.read — vedi nota sotto)
--
--    NOTA per il codice (dataService.js riga 338):
--      Cambiare `is_read: n.is_read === true || !!n.read` in `is_read: !!n.is_read`
--      dopo aver eseguito questa migrazione.
-- =================================================================================

-- is_read: colonna canonica per lo stato di lettura
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS is_read     BOOLEAN     NOT NULL DEFAULT FALSE;

-- read_at: timestamp di quando la notifica è stata letta (opzionale, per audit)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS read_at     TIMESTAMPTZ;

-- action_text: testo del pulsante CTA (subscribeToNotifications riga 334)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS action_text TEXT;

-- action_type: tipo di azione (subscribeToNotifications riga 337, es. 'scopri')
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS action_type TEXT;

-- action_url: URL di destinazione del CTA (già usato in INSERT, qui formalizzato)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS action_url  TEXT;

-- action_data: payload JSON per azioni strutturate (dataService.getNotifications riga 306)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS action_data JSONB;

-- Indice parziale per query frequente: notifiche non lette per utente
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications(user_id, created_at DESC)
    WHERE is_read = FALSE;

-- =================================================================================
-- FINE MIGRAZIONE
-- =================================================================================
