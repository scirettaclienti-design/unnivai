-- ACCOUNT-PRIVACY (T8) — la cancellazione dell'account dentro l'app (linea guida Apple 5.1.1(v)).
--
-- La chiama SOLO la Edge Function `elimina-account` (service_role), dopo aver verificato il JWT dell'utente:
-- cancella i dati di quell'utente in UNA transazione (o tutto o niente) e restituisce i file di Storage da togliere.
-- Poi la funzione cancella l'utente di auth. Idempotente: se qualcosa si ferma, si può rifare.
--
-- Inventario fatto sullo schema vero (information_schema, pg_constraint, 03/11/2026). Con ON DELETE CASCADE verso
-- auth.users (partono da soli con l'utente): profiles, notifications, reviews (user_id), saved_tours, completed_tours,
-- dna_events, user_preferences, guide_requests, guides_profile, businesses_profile (id), tours (guide_id), ai_quota_daily,
-- ai_quota_test_account, ai_quota_ospite. Restavano a mano, e senza questa funzione BLOCCAVANO la cancellazione
-- (FK senza ON DELETE): bookings e favorites (→ profiles), user_photos (→ explorers e tours), explorers, guides,
-- activities.owner_id, businesses_profile.user_id. Restavano orfane, senza FK: reviews.guide_id, bookings dei suoi tour,
-- ai_generation_ticket.subject. Con SET NULL (le righe sopravvivevano anonime): nav_events, error_logs.
-- La lista d'attesa (waitlist) si lega all'indirizzo email, non all'utente: si toglie per email.
--
-- Non si cancellano, perché non sono dell'utente: place_racconti, place_facts, places_cache, city_knowledge (cache di luoghi),
-- contatori globali (ai_quota_global*, ai_quota_guest, ai_quota_ospiti_*, racconto_uso, voce_uso, città) e il bucket voce-cache
-- (audio di frasi, senza utente).

CREATE OR REPLACE FUNCTION public.elimina_dati_utente(p_user uuid, p_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_tours uuid[];
    v_files jsonb;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'utente mancante';
    END IF;

    -- I file dell'utente in Storage (li toglie la funzione con l'API di Storage, non con una DELETE sulla tabella).
    SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb)
      INTO v_files
      FROM storage.objects o
     WHERE o.owner = p_user AND o.bucket_id IN ('tour-images', 'business-media');

    SELECT coalesce(array_agg(id), '{}') INTO v_tours FROM public.tours WHERE guide_id = p_user;

    -- Foto e prenotazioni attaccate ai suoi tour (i tour spariscono con lui), poi le sue.
    DELETE FROM public.user_photos WHERE user_id = p_user OR tour_id = ANY (v_tours);
    DELETE FROM public.bookings    WHERE user_id = p_user OR tour_id = ANY (v_tours);
    DELETE FROM public.favorites   WHERE user_id = p_user;
    DELETE FROM public.reviews     WHERE user_id = p_user OR guide_id = p_user;

    DELETE FROM public.activities          WHERE owner_id = p_user;
    DELETE FROM public.businesses_profile  WHERE user_id = p_user OR id = p_user;
    DELETE FROM public.explorers           WHERE id = p_user;
    DELETE FROM public.guides              WHERE id = p_user;

    -- Righe che con SET NULL sarebbero restate anonime, o che non hanno una FK.
    DELETE FROM public.nav_events WHERE user_id = p_user;
    DELETE FROM public.error_logs WHERE user_id = p_user;
    DELETE FROM public.ai_generation_ticket WHERE subject LIKE '%:' || p_user::text;

    IF p_email IS NOT NULL AND length(btrim(p_email)) > 0 THEN
        DELETE FROM public.waitlist WHERE lower(email) = lower(btrim(p_email));
    END IF;

    -- Il resto (profiles, notifiche, DNA, giri salvati, preferenze, richieste alle guide, contatori) parte a cascata
    -- quando la funzione cancella l'utente di auth. Qui si toglie il profilo per non lasciarlo nemmeno un istante.
    DELETE FROM public.profiles WHERE id = p_user;

    RETURN jsonb_build_object('files', v_files, 'tours', coalesce(array_length(v_tours, 1), 0));
END;
$fn$;

REVOKE ALL ON FUNCTION public.elimina_dati_utente(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.elimina_dati_utente(uuid, text) TO service_role;

COMMENT ON FUNCTION public.elimina_dati_utente(uuid, text) IS
    'ACCOUNT-PRIVACY: cancella i dati di un utente in una transazione. Solo service_role, dalla Edge Function elimina-account.';
