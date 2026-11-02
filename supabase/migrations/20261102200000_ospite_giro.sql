-- OSPITE-GIRO — il giro di prova senza account (account anonimo di Supabase, `is_anonymous = true` nel JWT).
--
-- Chi entra con «Prova un giro, senza account» e' un utente anonimo: ha un id vero in auth.users, scrive le sue righe
-- (dna_events, user_preferences, saved_tours…) come ogni utente, e quando si registra (email + codice + password) resta
-- lo stesso id: giro e DNA restano suoi senza copiare niente.
--
-- I limiti dell'ospite li applica openai-proxy chiamando public.ai_quota_ospite (solo service_role):
--   · per account: p_giri generazioni 'itinerary' (Crea, Quiz, Sorprendimi) e p_per_te 'home_tours' (Per Te), per sempre;
--   · per indirizzo IP (hash, come gli ospiti di prima): p_ip_cap generazioni di ospiti al giorno;
--   · tetto globale degli ospiti: p_ospiti_cap generazioni di ospiti al giorno (secret AI_OSPITI_DAILY_CAP);
--   · e il tetto globale di tutta l'app (public.ai_quota_global, AI_GLOBAL_DAILY_CAP), come per tutti.
-- Le chiamate di contorno di un ospite passano da ai_quota_consume come 'user' (invariata).
-- Giorno = mezzanotte Europe/Rome, come le altre quote.
--
-- In piu': un ospite non scrive dove lo leggono gli altri (recensioni, tour, profili di guida e attivita', foto,
-- prenotazioni, richieste alle guide, notifiche ad altri). Policy RESTRICTIVE: valgono in AND con quelle di sempre.

-- ─── Contatori ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_quota_ospite (
    user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    giri       integer     NOT NULL DEFAULT 0,   -- generazioni 'itinerary'
    per_te     integer     NOT NULL DEFAULT 0,   -- generazioni 'home_tours'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_quota_ospiti_ip (
    ip_hash    text        NOT NULL,
    day        date        NOT NULL,
    count      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ip_hash, day)
);

CREATE TABLE IF NOT EXISTS public.ai_quota_ospiti_global (
    day        date        PRIMARY KEY,
    count      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_quota_ospite        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quota_ospiti_ip     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quota_ospiti_global ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_ospite        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_quota_ospiti_ip     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_quota_ospiti_global FROM PUBLIC, anon, authenticated;

-- ─── Consumo ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.ai_quota_ospite(uuid, text, uuid, text, integer, integer, integer, integer, integer);

CREATE FUNCTION public.ai_quota_ospite(
    p_user        uuid,     -- id dell'account anonimo (verificato dal JWT nel proxy)
    p_ip_hash     text,     -- sha256(sale + IP)
    p_ticket      uuid,     -- biglietto della generazione
    p_ticket_kind text,     -- 'itinerary' | 'home_tours'
    p_giri        integer,  -- generazioni 'itinerary' per account
    p_per_te      integer,  -- generazioni 'home_tours' per account
    p_ip_cap      integer,  -- generazioni di ospiti per IP al giorno
    p_ospiti_cap  integer,  -- generazioni di ospiti al giorno, tutti insieme
    p_global_cap  integer   -- tetto globale dell'app (come ai_quota_consume)
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_day     date := (now() AT TIME ZONE 'Europe/Rome')::date;
    v_subject text := 'ospite:' || p_user::text;
    v_ticket  public.ai_generation_ticket%ROWTYPE;
    v_n       integer;
BEGIN
    IF p_user IS NULL OR coalesce(p_ip_hash, '') = '' THEN
        RAISE EXCEPTION 'ai_quota_ospite: soggetto non valido';
    END IF;
    IF p_ticket IS NULL OR p_ticket_kind NOT IN ('itinerary', 'home_tours') THEN
        RAISE EXCEPTION 'ai_quota_ospite: biglietto non valido';
    END IF;
    IF p_giri IS NULL OR p_giri < 0 OR p_per_te IS NULL OR p_per_te < 0 OR p_ip_cap IS NULL OR p_ip_cap < 0
       OR p_ospiti_cap IS NULL OR p_ospiti_cap < 0 OR p_global_cap IS NULL OR p_global_cap < 0 THEN
        RAISE EXCEPTION 'ai_quota_ospite: limiti non validi';
    END IF;

    -- Biglietto gia' aperto: chiamata successiva della stessa generazione, non conta (stesse regole di ai_quota_consume).
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

    -- Biglietto nuovo = una generazione. Account, poi IP, poi ospiti, poi globale; se uno rifiuta, il blocco
    -- annulla gli incrementi fatti prima.
    BEGIN
        IF p_ticket_kind = 'itinerary' THEN
            IF p_giri = 0 THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'ospite_giro');
            END IF;
            INSERT INTO public.ai_quota_ospite AS q (user_id, giri)
            VALUES (p_user, 1)
            ON CONFLICT (user_id) DO UPDATE SET giri = q.giri + 1, updated_at = now()
             WHERE q.giri < p_giri
            RETURNING q.giri INTO v_n;
            IF v_n IS NULL THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'ospite_giro');
            END IF;
        ELSE
            IF p_per_te = 0 THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'ospite_per_te');
            END IF;
            INSERT INTO public.ai_quota_ospite AS q (user_id, per_te)
            VALUES (p_user, 1)
            ON CONFLICT (user_id) DO UPDATE SET per_te = q.per_te + 1, updated_at = now()
             WHERE q.per_te < p_per_te
            RETURNING q.per_te INTO v_n;
            IF v_n IS NULL THEN
                RETURN jsonb_build_object('allowed', false, 'reason', 'ospite_per_te');
            END IF;
        END IF;

        IF p_ip_cap = 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_OSPITE_IP';
        END IF;
        v_n := NULL;
        INSERT INTO public.ai_quota_ospiti_ip AS i (ip_hash, day, count)
        VALUES (p_ip_hash, v_day, 1)
        ON CONFLICT (ip_hash, day) DO UPDATE SET count = i.count + 1, updated_at = now()
         WHERE i.count < p_ip_cap
        RETURNING i.count INTO v_n;
        IF v_n IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_OSPITE_IP';
        END IF;

        IF p_ospiti_cap = 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_OSPITI';
        END IF;
        v_n := NULL;
        INSERT INTO public.ai_quota_ospiti_global AS o (day, count)
        VALUES (v_day, 1)
        ON CONFLICT (day) DO UPDATE SET count = o.count + 1, updated_at = now()
         WHERE o.count < p_ospiti_cap
        RETURNING o.count INTO v_n;
        IF v_n IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_OSPITI';
        END IF;

        IF p_global_cap = 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL';
        END IF;
        v_n := NULL;
        INSERT INTO public.ai_quota_global AS g (day, count)
        VALUES (v_day, 1)
        ON CONFLICT (day) DO UPDATE SET count = g.count + 1, updated_at = now()
         WHERE g.count < p_global_cap
        RETURNING g.count INTO v_n;
        IF v_n IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AIQ_GLOBAL';
        END IF;
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'AIQ_OSPITE_IP' THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'ospite_ip');
        ELSIF SQLERRM = 'AIQ_OSPITI' THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'ospiti');
        ELSIF SQLERRM = 'AIQ_GLOBAL' THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'global');
        END IF;
        RAISE;
    END;

    INSERT INTO public.ai_generation_ticket (id, subject, kind, label)
    VALUES (p_ticket, v_subject, p_ticket_kind, NULL);
    DELETE FROM public.ai_generation_ticket WHERE created_at < now() - interval '2 days';

    RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'ticket_kind', p_ticket_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_ospite(uuid, text, uuid, text, integer, integer, integer, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_ospite(uuid, text, uuid, text, integer, integer, integer, integer, integer)
    TO service_role;

-- ─── Rimborso (il motore si e' fermato: la generazione non conta) ──────────

DROP FUNCTION IF EXISTS public.ai_quota_ospite_rimborso(uuid, text, uuid);

CREATE FUNCTION public.ai_quota_ospite_rimborso(
    p_user    uuid,
    p_ip_hash text,
    p_ticket  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ticket public.ai_generation_ticket%ROWTYPE;
    v_day    date;
BEGIN
    IF p_user IS NULL OR coalesce(p_ip_hash, '') = '' OR p_ticket IS NULL THEN
        RAISE EXCEPTION 'ai_quota_ospite_rimborso: parametri non validi';
    END IF;

    SELECT * INTO v_ticket FROM public.ai_generation_ticket WHERE id = p_ticket FOR UPDATE;
    IF NOT FOUND OR v_ticket.subject <> 'ospite:' || p_user::text THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'no_ticket');
    END IF;

    v_day := (v_ticket.created_at AT TIME ZONE 'Europe/Rome')::date;

    IF v_ticket.kind = 'itinerary' THEN
        UPDATE public.ai_quota_ospite SET giri = greatest(giri - 1, 0), updated_at = now() WHERE user_id = p_user;
    ELSE
        UPDATE public.ai_quota_ospite SET per_te = greatest(per_te - 1, 0), updated_at = now() WHERE user_id = p_user;
    END IF;
    UPDATE public.ai_quota_ospiti_ip SET count = greatest(count - 1, 0), updated_at = now()
     WHERE ip_hash = p_ip_hash AND day = v_day;
    UPDATE public.ai_quota_ospiti_global SET count = greatest(count - 1, 0), updated_at = now() WHERE day = v_day;
    UPDATE public.ai_quota_global SET count = greatest(count - 1, 0), updated_at = now() WHERE day = v_day;

    DELETE FROM public.ai_generation_ticket WHERE id = p_ticket;

    RETURN jsonb_build_object('refunded', true, 'reason', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_ospite_rimborso(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_ospite_rimborso(uuid, text, uuid) TO service_role;

-- ─── Un ospite non scrive dove lo leggono gli altri ─────────────────────────
-- (auth.jwt() ->> 'is_anonymous')::boolean e' true solo per gli account anonimi; per tutti gli altri false o assente.

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['reviews', 'tours', 'guides_profile', 'businesses_profile', 'activities', 'user_photos',
                             'bookings', 'guide_requests']
    LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('DROP POLICY IF EXISTS ospite_niente_insert ON public.%I', t);
            EXECUTE format('CREATE POLICY ospite_niente_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
                           'WITH CHECK (coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false)', t);
            EXECUTE format('DROP POLICY IF EXISTS ospite_niente_update ON public.%I', t);
            EXECUTE format('CREATE POLICY ospite_niente_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
                           'USING (coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false)', t);
        END IF;
    END LOOP;
END;
$$;

-- Le notifiche: un ospite scrive solo le sue (mai a un altro utente).
DROP POLICY IF EXISTS ospite_solo_sue_notifiche ON public.notifications;
CREATE POLICY ospite_solo_sue_notifiche ON public.notifications AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false OR user_id = auth.uid());
