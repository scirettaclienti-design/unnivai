-- TEST-ACC — l'account di prova di Claude Code, senza tetto personale.
--
-- Le prove reali (P3d-g, P3d-i, C1…) consumavano la quota ospite (5/giorno per
-- IP) o il tetto utente (10/giorno). Qui UN solo account, registrato in
-- public.ai_quota_test_account, salta il tetto personale (generazioni e
-- contorno); il tetto GLOBALE giornaliero vale anche per lui.
--
-- Senza buchi per nessun altro:
--   · la tabella ha RLS senza policy e nessun grant ad anon/authenticated:
--     la scrive e la legge solo service_role (e le migrazioni);
--   · al massimo UNA riga (indice unico su un'espressione costante);
--   · l'esenzione vale solo per p_subject_kind = 'user' con QUEL user id
--     (il JWT lo verifica il proxy); un ospite non puo' mai esserlo.
--
-- Le sue generazioni si registrano come le altre: +1 su ai_quota_daily (senza
-- tetto), +1 sul globale, il biglietto in ai_generation_ticket con
-- label = 'test', cosi' i costi restano misurabili. Il rimborso (P8b) funziona
-- uguale: il contatore personale era stato incrementato.
--
-- Unica differenza in ai_quota_consume rispetto a 20261008_ai_ticket_itinerary_4_calls.sql:
-- v_test (riga in ai_quota_test_account) → contatore personale senza WHERE sul
-- limite; label 'test' sul biglietto. Firma, grant e risposte invariati.

CREATE TABLE IF NOT EXISTS public.ai_quota_test_account (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    note       text NOT NULL DEFAULT 'account di prova di Claude Code',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_quota_test_account_una_sola_riga
    ON public.ai_quota_test_account ((true));

ALTER TABLE public.ai_quota_test_account ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_test_account FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_quota_test_account TO service_role;

ALTER TABLE public.ai_generation_ticket ADD COLUMN IF NOT EXISTS label text;

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
    v_test      boolean := false;
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
        -- TEST-ACC — l'account di prova: contato, ma senza tetto personale.
        v_test := EXISTS (SELECT 1 FROM public.ai_quota_test_account t WHERE t.user_id = p_subject::uuid);
    END IF;

    -- ─── Chiamate di contorno ────────────────────────────────────────────────
    IF p_purpose = 'aux' THEN
        IF v_unlimited THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
        END IF;
        IF p_limit = 0 AND NOT v_test THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
        END IF;
        IF p_subject_kind = 'user' THEN
            INSERT INTO public.ai_quota_daily AS q (user_id, day, calls)
            VALUES (p_subject::uuid, v_day, 1)
            ON CONFLICT (user_id, day) DO UPDATE SET calls = q.calls + 1
             WHERE v_test OR q.calls < p_limit
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
        IF v_test THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'test');
        END IF;
        RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'remaining', p_limit - v_count);
    END IF;

    -- ─── Generazione ─────────────────────────────────────────────────────────
    IF p_ticket IS NULL OR p_ticket_kind NOT IN ('itinerary', 'home_tours') THEN
        RAISE EXCEPTION 'ai_quota_consume: biglietto non valido';
    END IF;

    -- Biglietto gia' aperto: chiamata successiva della stessa generazione, non conta.
    -- 'itinerary': traduttore + selettore + narratore + riscrittura = 4; 'home_tours': 2.
    SELECT * INTO v_ticket FROM public.ai_generation_ticket WHERE id = p_ticket FOR UPDATE;
    IF FOUND THEN
        IF v_ticket.subject <> v_subject
           OR v_ticket.calls >= (CASE WHEN v_ticket.kind = 'itinerary' THEN 4 ELSE 2 END)
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
            IF p_limit = 0 AND NOT v_test THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
            END IF;
            IF p_subject_kind = 'user' THEN
                INSERT INTO public.ai_quota_daily AS q (user_id, day, count)
                VALUES (p_subject::uuid, v_day, 1)
                ON CONFLICT (user_id, day) DO UPDATE SET count = q.count + 1
                 WHERE v_test OR q.count < p_limit
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

    INSERT INTO public.ai_generation_ticket (id, subject, kind, label)
    VALUES (p_ticket, v_subject, p_ticket_kind, CASE WHEN v_test THEN 'test' END);
    -- Pulizia: i biglietti servono 10 minuti, ne teniamo 2 giorni.
    DELETE FROM public.ai_generation_ticket WHERE created_at < now() - interval '2 days';

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', CASE WHEN v_test THEN 'test' ELSE 'ok' END,
        'ticket_kind', p_ticket_kind,
        'remaining', CASE WHEN v_unlimited OR v_test THEN NULL ELSE p_limit - v_count END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer)
    TO service_role;

-- L'account registrato: un id, non un'email (le credenziali vivono solo in
-- .env.local di chi fa le prove). Account creato il 10/10/2026.
INSERT INTO public.ai_quota_test_account (user_id)
VALUES ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64')
ON CONFLICT (user_id) DO NOTHING;
