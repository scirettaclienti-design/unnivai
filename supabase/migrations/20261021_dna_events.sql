-- DNA-1 — il registro degli eventi del DNA: ogni gesto dell'utente diventa una riga.
--
-- Una riga = un gesto (giro completato, tappa saltata, giro salvato, scelta del Quiz,
-- ritmo o compagnia scelti, tappa raggiunta). I pesi del DNA NON leggono ancora questa
-- tabella (sara' DNA-2): qui si registra soltanto.
--
-- Colonne (nessun dato personale oltre a queste; mai posizione, testo libero, nome o email):
--   user_id    chi (auth.uid(), preso dal server se il client non lo manda)
--   kind       il gesto (elenco chiuso, CHECK)
--   category   una categoria di base del DNA (food, cultura, natura…), o null
--   city       la citta' del giro, o null
--   value      il valore del gesto (es. Rilassato, coppia, natura:Parchi), o null
--   moment     il momento della giornata della tappa (mattina, pranzo, aperitivo…), o null
--   tour_id    il giro (id testuale), o null
--   label      'test' se l'utente e' l'account di prova (messo dal SERVER, il client non lo sa)
--   created_at quando
--
-- RLS: ogni utente inserisce e legge SOLO le proprie righe; nessun accesso anonimo; nessun
-- update e nessun delete per l'utente (il registro e' una storia). La cancellazione dei dati
-- dell'utente passa dalla FK ON DELETE CASCADE.

CREATE TABLE IF NOT EXISTS public.dna_events (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    kind       text        NOT NULL,
    category   text,
    city       text,
    value      text,
    moment     text,
    tour_id    text,
    label      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dna_events_kind_valido CHECK (kind IN (
        'tour_completed', 'stop_skipped', 'tour_saved', 'quiz_choice',
        'pace_chosen', 'company_chosen', 'stop_reached'
    )),
    CONSTRAINT dna_events_label_valida CHECK (label IS NULL OR label = 'test'),
    CONSTRAINT dna_events_lunghezze CHECK (
        char_length(coalesce(category, '')) <= 40
        AND char_length(coalesce(city, ''))     <= 80
        AND char_length(coalesce(value, ''))    <= 80
        AND char_length(coalesce(moment, ''))   <= 40
        AND char_length(coalesce(tour_id, ''))  <= 120
    )
);

CREATE INDEX IF NOT EXISTS dna_events_user_created_idx
    ON public.dna_events (user_id, created_at DESC);

ALTER TABLE public.dna_events ENABLE ROW LEVEL SECURITY;

-- Nessun accesso anonimo; l'utente autenticato solo inserisce e legge.
REVOKE ALL ON public.dna_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.dna_events TO authenticated;
GRANT ALL ON public.dna_events TO service_role;

DROP POLICY IF EXISTS dna_events_insert_own ON public.dna_events;
CREATE POLICY dna_events_insert_own ON public.dna_events
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dna_events_select_own ON public.dna_events;
CREATE POLICY dna_events_select_own ON public.dna_events
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Il segno 'test' lo mette il server: l'account di prova e' quello di
-- public.ai_quota_test_account (RLS senza policy, il client non lo legge).
-- La label si decide qui e solo qui: un valore mandato dal client si ignora.
CREATE OR REPLACE FUNCTION public.dna_events_segna_test()
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

REVOKE ALL ON FUNCTION public.dna_events_segna_test() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dna_events_segna_test ON public.dna_events;
CREATE TRIGGER dna_events_segna_test
    BEFORE INSERT ON public.dna_events
    FOR EACH ROW EXECUTE FUNCTION public.dna_events_segna_test();

COMMENT ON TABLE public.dna_events IS
    'DNA-1: registro degli eventi del DNA (un gesto = una riga). RLS: solo le proprie righe, nessun anonimo.';
