-- Gate P8b — Guasti visibili: una generazione che OpenAI non porta a termine
-- non consuma la quota.
--
-- openai-proxy chiama questa funzione quando OpenAI risponde con un errore
-- (credito esaurito, troppe richieste, errore generico) o non risponde (rete,
-- timeout) su una chiamata con biglietto di generazione. Il conteggio torna
-- indietro, lato server:
--   · personale (utente: ai_quota_daily.count; ospite: ai_quota_guest.count),
--     tranne per gli account is_unlimited, che ai_quota_consume non conta;
--   · globale (ai_quota_global.count);
--   · nel giorno in cui il biglietto e' stato aperto (Europe/Rome), non oggi.
-- Il biglietto viene cancellato: il rimborso e' uno solo per generazione, e
-- una chiamata successiva con lo stesso biglietto riapre una generazione
-- nuova (conta di nuovo +1). Nessun contatore scende sotto zero.
--
-- Solo il biglietto del soggetto che chiama: un biglietto altrui o
-- inesistente non rimborsa niente.
-- Le chiamate di contorno (senza biglietto) non sono generazioni: non si
-- rimborsano. ai_quota_consume non cambia.

CREATE OR REPLACE FUNCTION public.ai_quota_refund(
    p_subject_kind text,     -- 'user' | 'guest'
    p_subject      text,     -- user id | hash IP
    p_ticket       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_subject   text := p_subject_kind || ':' || p_subject;
    v_ticket    public.ai_generation_ticket%ROWTYPE;
    v_day       date;
    v_unlimited boolean := false;
BEGIN
    IF p_subject_kind NOT IN ('user', 'guest') OR coalesce(p_subject, '') = '' OR p_ticket IS NULL THEN
        RAISE EXCEPTION 'ai_quota_refund: parametri non validi';
    END IF;

    SELECT * INTO v_ticket FROM public.ai_generation_ticket WHERE id = p_ticket FOR UPDATE;
    IF NOT FOUND OR v_ticket.subject <> v_subject THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'no_ticket');
    END IF;

    v_day := (v_ticket.created_at AT TIME ZONE 'Europe/Rome')::date;

    IF p_subject_kind = 'user' THEN
        SELECT coalesce(pr.is_unlimited, false) INTO v_unlimited
          FROM public.profiles pr WHERE pr.id = p_subject::uuid;
        v_unlimited := coalesce(v_unlimited, false);
    END IF;

    IF NOT v_unlimited THEN
        IF p_subject_kind = 'user' THEN
            UPDATE public.ai_quota_daily
               SET count = greatest(count - 1, 0)
             WHERE user_id = p_subject::uuid AND day = v_day;
        ELSE
            UPDATE public.ai_quota_guest
               SET count = greatest(count - 1, 0), updated_at = now()
             WHERE ip_hash = p_subject AND day = v_day;
        END IF;
    END IF;

    UPDATE public.ai_quota_global
       SET count = greatest(count - 1, 0), updated_at = now()
     WHERE day = v_day;

    DELETE FROM public.ai_generation_ticket WHERE id = p_ticket;

    RETURN jsonb_build_object('refunded', true, 'reason', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_refund(text, text, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_refund(text, text, uuid)
    TO service_role;
