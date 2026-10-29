-- QUOTA-CONTORNO — tetto globale giornaliero sulle chiamate di contorno.
--
-- Prima: ogni ospite (hash IP) aveva 15 chiamate di contorno al giorno e ogni utente 40, ma NESSUN tetto sul totale: chi ha molti IP
-- poteva far salire i costi restando sempre sotto il proprio limite. Ora le chiamate di contorno (purpose 'aux') contano anche in
-- public.ai_quota_global_aux (una riga per giorno, Europe/Rome) e, raggiunto il tetto p_aux_global_cap, ai_quota_consume risponde
-- allowed=false, reason='global_aux' (e l'incremento personale di quella chiamata viene annullato).
--
-- Compatibilita': p_aux_global_cap ha DEFAULT NULL = nessun tetto, quindi il proxy GIA' deployato (che chiama con 7 parametri) continua
-- a funzionare identico finche' non si fa il deploy del nuovo. Per questo si elimina la firma a 7 parametri: con due funzioni
-- omonime la chiamata a 7 argomenti sarebbe ambigua.
--
-- Invariati: chi e' esente (profiles.is_unlimited, account di prova) non conta e non consuma il tetto; generazioni e rimborso identici.
-- Gli account in AI_UNLIMITED_USER_IDS non arrivano nemmeno qui: li esenta il proxy prima della chiamata.

CREATE TABLE IF NOT EXISTS public.ai_quota_global_aux (
    day        date        PRIMARY KEY,
    count      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_quota_global_aux ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_global_aux FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.ai_quota_consume(text, text, text, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.ai_quota_consume(text, text, text, uuid, text, integer, integer, integer);  -- ripetibile

CREATE FUNCTION public.ai_quota_consume(
    p_subject_kind text,     -- 'user' | 'guest'
    p_subject      text,     -- user id | hash IP
    p_purpose      text,     -- 'generation' | 'aux'
    p_ticket       uuid,     -- solo per 'generation'
    p_ticket_kind  text,     -- 'itinerary' | 'home_tours', solo per 'generation'
    p_limit        integer,  -- limite personale per questo purpose
    p_global_cap   integer,  -- tetto globale generazioni/giorno
    p_aux_global_cap integer DEFAULT NULL  -- tetto globale contorno/giorno; NULL = nessun tetto (vecchio proxy)
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
    v_aux_glob  integer;
    v_ticket    public.ai_generation_ticket%ROWTYPE;
BEGIN
    IF p_subject_kind NOT IN ('user', 'guest') OR coalesce(p_subject, '') = '' THEN
        RAISE EXCEPTION 'ai_quota_consume: soggetto non valido';
    END IF;
    IF p_purpose NOT IN ('generation', 'aux') THEN
        RAISE EXCEPTION 'ai_quota_consume: purpose non valido';
    END IF;
    IF p_limit IS NULL OR p_limit < 0 OR p_global_cap IS NULL OR p_global_cap < 0
       OR p_aux_global_cap < 0 THEN
        RAISE EXCEPTION 'ai_quota_consume: limiti non validi';
    END IF;

    IF p_subject_kind = 'user' THEN
        SELECT coalesce(pr.is_unlimited, false) INTO v_unlimited
          FROM public.profiles pr WHERE pr.id = p_subject::uuid;
        v_unlimited := coalesce(v_unlimited, false);
        -- L'account di prova: nessun contatore, biglietto con label 'test'.
        v_test := EXISTS (SELECT 1 FROM public.ai_quota_test_account t WHERE t.user_id = p_subject::uuid);
    END IF;

    -- ─── Chiamate di contorno ────────────────────────────────────────────────
    IF p_purpose = 'aux' THEN
        IF v_test THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'test');
        END IF;
        IF v_unlimited THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
        END IF;
        IF p_limit = 0 THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'limit', 'remaining', 0);
        END IF;
        -- Personale prima, poi globale; se il globale rifiuta, il blocco annulla anche l'incremento personale.
        BEGIN
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

            IF p_aux_global_cap IS NOT NULL THEN
                IF p_aux_global_cap = 0 THEN
                    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL_AUX';
                END IF;
                INSERT INTO public.ai_quota_global_aux AS g (day, count)
                VALUES (v_day, 1)
                ON CONFLICT (day) DO UPDATE SET count = g.count + 1, updated_at = now()
                 WHERE g.count < p_aux_global_cap
                RETURNING g.count INTO v_aux_glob;
                IF v_aux_glob IS NULL THEN
                    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL_AUX';
                END IF;
            END IF;
        EXCEPTION WHEN raise_exception THEN
            IF SQLERRM = 'AIQ_GLOBAL_AUX' THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'global_aux', 'remaining', 0);
            END IF;
            RAISE;
        END;
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

    -- L'account di prova: non conta, ma il tetto globale pieno lo ferma come tutti.
    IF v_test THEN
        IF coalesce((SELECT g.count FROM public.ai_quota_global g WHERE g.day = v_day), 0) >= p_global_cap THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'global', 'remaining', 0);
        END IF;
        INSERT INTO public.ai_generation_ticket (id, subject, kind, label)
        VALUES (p_ticket, v_subject, p_ticket_kind, 'test');
        DELETE FROM public.ai_generation_ticket WHERE created_at < now() - interval '2 days';
        RETURN jsonb_build_object('allowed', true, 'reason', 'test', 'ticket_kind', p_ticket_kind, 'remaining', NULL);
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

    INSERT INTO public.ai_generation_ticket (id, subject, kind, label)
    VALUES (p_ticket, v_subject, p_ticket_kind, NULL);
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

REVOKE ALL ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_consume(text, text, text, uuid, text, integer, integer, integer)
    TO service_role;
