-- DNA-6 — correzioni del DNA e giri salvati.
--
-- 1) Un nuovo gesto nel registro: 'dna_correction'. L'utente dice dal Profilo «piu' di questo»,
--    «meno di questo» o «azzera» per una categoria. Il registro resta una storia (nessun update,
--    nessun delete): una correzione e' una riga in piu', non una cancellazione.
--      category = la categoria corretta (food, cultura, natura…), obbligatoria
--      value    = 'piu' | 'meno' | 'azzera'
--
-- 2) Una tabella minima per i giri generati che l'utente salva (Per Te, Quiz, Crea, Sorprendimi).
--    `favorites` non va bene: il suo tour_id e' un uuid con chiave esterna su `tours`, e un giro
--    generato dall'AI non e' una riga di `tours`.
--
-- RLS: ogni utente legge, inserisce e toglie SOLO i propri giri; nessun accesso anonimo; nessun
-- update. Il segno 'test' (account di prova) lo mette il server, come in dna_events.

-- ── 1. dna_events: il nuovo gesto ────────────────────────────────────────────

ALTER TABLE public.dna_events DROP CONSTRAINT IF EXISTS dna_events_kind_valido;
ALTER TABLE public.dna_events ADD CONSTRAINT dna_events_kind_valido CHECK (kind IN (
    'tour_completed', 'stop_skipped', 'tour_saved', 'quiz_choice',
    'pace_chosen', 'company_chosen', 'stop_reached', 'dna_correction'
));

ALTER TABLE public.dna_events DROP CONSTRAINT IF EXISTS dna_events_correzione_valida;
ALTER TABLE public.dna_events ADD CONSTRAINT dna_events_correzione_valida CHECK (
    kind <> 'dna_correction'
    OR (value IN ('piu', 'meno', 'azzera') AND category IS NOT NULL)
);

-- ── 2. saved_tours: i giri salvati ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_tours (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    tour_id    text        NOT NULL,
    source     text        NOT NULL,
    title      text        NOT NULL,
    city       text,
    stops      jsonb       NOT NULL DEFAULT '[]'::jsonb,
    label      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT saved_tours_user_tour_unique UNIQUE (user_id, tour_id),
    CONSTRAINT saved_tours_source_valida CHECK (source IN ('per_te', 'quiz', 'crea', 'sorprendimi', 'altro')),
    CONSTRAINT saved_tours_label_valida CHECK (label IS NULL OR label = 'test'),
    CONSTRAINT saved_tours_lunghezze CHECK (
        char_length(tour_id) BETWEEN 1 AND 120
        AND char_length(title) BETWEEN 1 AND 120
        AND char_length(coalesce(city, '')) <= 80
    ),
    CONSTRAINT saved_tours_tappe_valide CHECK (
        jsonb_typeof(stops) = 'array'
        AND jsonb_array_length(stops) <= 30
        AND pg_column_size(stops) <= 20000
    )
);

CREATE INDEX IF NOT EXISTS saved_tours_user_created_idx
    ON public.saved_tours (user_id, created_at DESC);

ALTER TABLE public.saved_tours ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.saved_tours FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_tours TO authenticated;
GRANT ALL ON public.saved_tours TO service_role;

DROP POLICY IF EXISTS saved_tours_select_own ON public.saved_tours;
CREATE POLICY saved_tours_select_own ON public.saved_tours
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_tours_insert_own ON public.saved_tours;
CREATE POLICY saved_tours_insert_own ON public.saved_tours
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_tours_delete_own ON public.saved_tours;
CREATE POLICY saved_tours_delete_own ON public.saved_tours
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Il segno 'test' lo decide il server (come dna_events_segna_test): il client non lo sa.
CREATE OR REPLACE FUNCTION public.saved_tours_segna_test()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.ai_quota_test_account t WHERE t.user_id = NEW.user_id) THEN
        NEW.label := 'test';
    ELSE
        NEW.label := NULL;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.saved_tours_segna_test() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS saved_tours_segna_test ON public.saved_tours;
CREATE TRIGGER saved_tours_segna_test
    BEFORE INSERT ON public.saved_tours
    FOR EACH ROW EXECUTE FUNCTION public.saved_tours_segna_test();

COMMENT ON TABLE public.saved_tours IS
    'DNA-6: i giri generati che l''utente salva. RLS: solo i propri, nessun anonimo, nessun update.';
