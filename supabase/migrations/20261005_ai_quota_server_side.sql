-- Gate QUOTA-SERVER — la quota di generazioni AI la applica il server.
--
-- PARTE 1 documenta lo stato di public.ai_quota_daily com'e' in produzione
--   (letto da information_schema / pg_policies il 05/10/2026): la tabella era
--   stata creata a mano e non aveva una migration nel repo. Idempotente: su
--   produzione non cambia nulla.
-- PARTE 2 applica la modifica:
--   - gli utenti possono solo LEGGERE la propria riga (insert/update rimossi);
--   - nuove tabelle per ospiti (per hash IP), tetto globale e biglietti;
--   - public.ai_quota_consume(): unico punto che conta, eseguibile solo da
--     service_role (la chiama la Edge Function openai-proxy).
--
-- Giorno = mezzanotte Europe/Rome. Testata in locale: scripts/test-ai-quota-sql.sh

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — stato attuale (documentazione)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_quota_daily (
    user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day        date        NOT NULL DEFAULT CURRENT_DATE,
    count      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_quota_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ai_quota_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_quota_daily_touch ON public.ai_quota_daily;
CREATE TRIGGER ai_quota_daily_touch
    BEFORE UPDATE ON public.ai_quota_daily
    FOR EACH ROW EXECUTE FUNCTION public.ai_quota_touch_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'ai_quota_daily'
                   AND policyname = 'ai_quota_select_own') THEN
    CREATE POLICY ai_quota_select_own ON public.ai_quota_daily
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- In produzione esistevano anche (rimosse nella PARTE 2):
--   ai_quota_insert_own  FOR INSERT WITH CHECK (auth.uid() = user_id)
--   ai_quota_update_own  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
-- e i grant di default di Supabase: anon e authenticated con TUTTI i privilegi
-- (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER).
-- Con quelle policy ogni utente poteva riportare il proprio contatore a 0.

-- ═════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — il contatore lo scrive solo il server
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS ai_quota_insert_own ON public.ai_quota_daily;
DROP POLICY IF EXISTS ai_quota_update_own ON public.ai_quota_daily;

REVOKE ALL ON public.ai_quota_daily FROM anon, authenticated;
GRANT SELECT ON public.ai_quota_daily TO authenticated;

-- count = generazioni del giorno; calls = chiamate di contorno (chat, monumenti, meteo...)
ALTER TABLE public.ai_quota_daily ADD COLUMN IF NOT EXISTS calls integer NOT NULL DEFAULT 0;

-- Ospiti: contati per hash SHA-256(sale + IP), calcolato nella Edge Function.
CREATE TABLE IF NOT EXISTS public.ai_quota_guest (
    ip_hash    text        NOT NULL,
    day        date        NOT NULL,
    count      integer     NOT NULL DEFAULT 0,
    calls      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ip_hash, day)
);

-- Tetto globale: generazioni di tutta l'app nel giorno.
CREATE TABLE IF NOT EXISTS public.ai_quota_global (
    day        date        PRIMARY KEY,
    count      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Biglietti: una generazione = un biglietto = max 2 chiamate in 10 minuti.
CREATE TABLE IF NOT EXISTS public.ai_generation_ticket (
    id         uuid        PRIMARY KEY,
    subject    text        NOT NULL,           -- 'user:<uuid>' | 'guest:<hash>'
    kind       text        NOT NULL CHECK (kind IN ('itinerary', 'home_tours')),
    calls      integer     NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_generation_ticket_created_at_idx
    ON public.ai_generation_ticket (created_at);

ALTER TABLE public.ai_quota_guest       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quota_global      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_ticket ENABLE ROW LEVEL SECURITY;
-- Nessuna policy: dal client non si legge ne' si scrive. Solo service_role.
REVOKE ALL ON public.ai_quota_guest, public.ai_quota_global, public.ai_generation_ticket
    FROM anon, authenticated;

-- ─── ai_quota_consume ────────────────────────────────────────────────────────
-- Ritorna jsonb { allowed, reason, remaining?, ticket_kind? }
--   reason: 'ok' | 'ticket' (biglietto gia' aperto) | 'unlimited'
--           | 'limit' | 'global' | 'ticket' (rifiuto: biglietto esaurito/scaduto/altrui)
-- Ogni errore di input solleva un'eccezione: la Edge Function risponde 503 e
-- non chiama OpenAI.
CREATE OR REPLACE FUNCTION public.ai_quota_consume(
    p_subject_kind text,     -- 'user' | 'guest'
    p_subject      text,     -- user id | hash IP
    p_purpose      text,     -- 'generation' | 'aux'
    p_ticket       uuid,     -- solo per 'generation'
    p_ticket_kind  text,     -- 'itinerary' | 'home_tours', solo per 'generation'
    p_limit        integer,  -- limite personale per questo purpose
    p_global_cap   integer   -- tetto globale generazioni/giorno
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_day       date    := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_subject   text    := p_subject_kind || ':' || p_subject;
    v_unlimited boolean := false;
    v_count     integer;
    v_global    integer;
    v_ticket    public.ai_generation_ticket%ROWTYPE;
BEGIN
    IF p_subject_kind NOT IN ('user', 'guest') OR coalesce(p_subject, '') = '' THEN
        RAISE EXCEPTION 'ai_quota_consume: soggetto non valido';
    END IF;
    IF p_purpose NOT IN ('generation', 'aux') THEN
        RAISE EXCEPTION 'ai_quota_consume: purpose non valido';
    END IF;
    IF p_limit IS NULL OR p_limit < 0 OR p_global_cap IS NULL OR p_global_cap < 0 THEN
        RAISE EXCEPTION 'ai_quota_consume: limiti non validi';
    END IF;

    IF p_subject_kind = 'user' THEN
        SELECT coalesce(pr.is_unlimited, false) INTO v_unlimited
          FROM public.profiles pr WHERE pr.id = p_subject::uuid;
        v_unlimited := coalesce(v_unlimited, false);
    END IF;

    -- ─── Chiamate di contorno ────────────────────────────────────────────────
    IF p_purpose = 'aux' THEN
        IF v_unlimited THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
        END IF;
        IF p_limit = 0 THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
        END IF;
        IF p_subject_kind = 'user' THEN
            INSERT INTO public.ai_quota_daily AS q (user_id, day, calls)
            VALUES (p_subject::uuid, v_day, 1)
            ON CONFLICT (user_id, day) DO UPDATE SET calls = q.calls + 1
             WHERE q.calls < p_limit
            RETURNING q.calls INTO v_count;
        ELSE
            INSERT INTO public.ai_quota_guest AS q (ip_hash, day, calls)
            VALUES (p_subject, v_day, 1)
            ON CONFLICT (ip_hash, day) DO UPDATE SET calls = q.calls + 1, updated_at = now()
             WHERE q.calls < p_limit
            RETURNING q.calls INTO v_count;
        END IF;
        IF v_count IS NULL THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
        END IF;
        RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'remaining', p_limit - v_count);
    END IF;

    -- ─── Generazione ─────────────────────────────────────────────────────────
    IF p_ticket IS NULL OR p_ticket_kind NOT IN ('itinerary', 'home_tours') THEN
        RAISE EXCEPTION 'ai_quota_consume: biglietto non valido';
    END IF;

    -- Biglietto gia' aperto: seconda chiamata della stessa generazione, non conta.
    SELECT * INTO v_ticket FROM public.ai_generation_ticket WHERE id = p_ticket FOR UPDATE;
    IF FOUND THEN
        IF v_ticket.subject <> v_subject
           OR v_ticket.calls >= 2
           OR v_ticket.created_at < now() - interval '10 minutes' THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'ticket');
        END IF;
        UPDATE public.ai_generation_ticket SET calls = calls + 1 WHERE id = p_ticket;
        RETURN jsonb_build_object('allowed', true, 'reason', 'ticket', 'ticket_kind', v_ticket.kind);
    END IF;

    -- Biglietto nuovo = una generazione. Personale prima, poi globale; se il
    -- globale rifiuta, il blocco annulla anche l'incremento personale.
    BEGIN
        IF NOT v_unlimited THEN
            IF p_limit = 0 THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
            END IF;
            IF p_subject_kind = 'user' THEN
                INSERT INTO public.ai_quota_daily AS q (user_id, day, count)
                VALUES (p_subject::uuid, v_day, 1)
                ON CONFLICT (user_id, day) DO UPDATE SET count = q.count + 1
                 WHERE q.count < p_limit
                RETURNING q.count INTO v_count;
            ELSE
                INSERT INTO public.ai_quota_guest AS q (ip_hash, day, count)
                VALUES (p_subject, v_day, 1)
                ON CONFLICT (ip_hash, day) DO UPDATE SET count = q.count + 1, updated_at = now()
                 WHERE q.count < p_limit
                RETURNING q.count INTO v_count;
            END IF;
            IF v_count IS NULL THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
            END IF;
        END IF;

        IF p_global_cap = 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL';
        END IF;
        INSERT INTO public.ai_quota_global AS g (day, count)
        VALUES (v_day, 1)
        ON CONFLICT (day) DO UPDATE SET count = g.count + 1, updated_at = now()
         WHERE g.count < p_global_cap
        RETURNING g.count INTO v_global;
        IF v_global IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL';
        END IF;
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'AIQ_GLOBAL' THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'global', 'remaining', 0);
        END IF;
        RAISE;
    END;

    INSERT INTO public.ai_generation_ticket (id, subject, kind) VALUES (p_ticket, v_subject, p_ticket_kind);
    -- Pulizia: i biglietti servono 10 minuti, ne teniamo 2 giorni.
    DELETE FROM public.ai_generation_ticket WHERE created_at < now() - interval '2 days';

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'ok',
        'ticket_kind', p_ticket_kind,
        'remaining', CASE WHEN v_unlimited THEN NULL ELSE p_limit - v_count END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer)
    TO service_role;
