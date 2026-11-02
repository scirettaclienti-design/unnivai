#!/usr/bin/env bash
# ACCOUNT-PRIVACY — prova la migration 20261103010000_elimina_account.sql su un Postgres 17 vero (Docker):
# schema finto di auth/storage + le tabelle con le loro FK REALI (verificate su pg_constraint di produzione il 03/11/2026,
# comprese quelle senza ON DELETE che bloccano la cancellazione), poi cancella un utente e conta: zero righe sue, intatte quelle degli altri.
# Non tocca nessun database remoto. Uso: bash scripts/test-elimina-account-sql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="dv-elimina-account-test-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
psql() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ schema finto (auth, storage) e tabelle con le FK reali di produzione"
psql <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE storage.objects (id serial PRIMARY KEY, bucket_id text, name text, owner uuid);
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;

CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, first_name text);
CREATE TABLE public.explorers (id uuid PRIMARY KEY REFERENCES auth.users(id), km_walked float);
CREATE TABLE public.guides (id uuid PRIMARY KEY REFERENCES auth.users(id), level text);
CREATE TABLE public.guides_profile (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, user_id uuid);
CREATE TABLE public.tours (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guide_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, title text);
CREATE TABLE public.activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES auth.users(id), name text);
CREATE TABLE public.businesses_profile (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, user_id uuid REFERENCES auth.users(id), company_name text);
CREATE TABLE public.bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id), tour_id uuid, status text);
CREATE TABLE public.favorites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id), tour_id uuid);
CREATE TABLE public.user_photos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.explorers(id),
    tour_id uuid REFERENCES public.tours(id), media_url text);
CREATE TABLE public.reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tour_id uuid, guide_id uuid, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, comment text);
CREATE TABLE public.guide_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    guide_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL, request_text text);
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, title text);
CREATE TABLE public.saved_tours (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, stops jsonb);
CREATE TABLE public.completed_tours (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, tour_id text);
CREATE TABLE public.dna_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, kind text);
CREATE TABLE public.user_preferences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, preference_data jsonb);
CREATE TABLE public.ai_quota_daily (user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, day date, count int, PRIMARY KEY (user_id, day));
CREATE TABLE public.ai_quota_test_account (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.ai_quota_ospite (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, giri int);
CREATE TABLE public.nav_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, event_type text);
CREATE TABLE public.error_logs (id bigserial PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, message text);
CREATE TABLE public.ai_generation_ticket (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, kind text);
CREATE TABLE public.waitlist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, city text);
CREATE TABLE public.place_racconti (place_id text PRIMARY KEY, testo text);   -- cache di luoghi: NON è dell'utente
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
SQL

echo "→ applico la migration (due volte: deve essere ripetibile)"
psql < "$ROOT/supabase/migrations/20261103010000_elimina_account.sql"
psql < "$ROOT/supabase/migrations/20261103010000_elimina_account.sql"

echo "→ dati: A (l'utente che se ne va, con TUTTO) e B (un altro, da non toccare)"
psql <<'SQL'
INSERT INTO auth.users VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@example.com'), ('bbbbbbbb-0000-0000-0000-000000000002', 'bruno@example.com');
INSERT INTO public.profiles VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Bruno');
INSERT INTO public.explorers VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 3), ('bbbbbbbb-0000-0000-0000-000000000002', 5);
INSERT INTO public.guides VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'pro');
INSERT INTO public.guides_profile VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO public.tours (id, guide_id, title) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tour di A'),
  ('b1000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Tour di B');
INSERT INTO public.activities (owner_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Bar di A'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Bar di B');
INSERT INTO public.businesses_profile VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A srl');
INSERT INTO public.bookings (user_id, tour_id, status) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'accepted'),   -- A prenota un tour di B
  ('bbbbbbbb-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'accepted'),   -- B prenota un tour di A (sparisce col tour)
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'accepted');   -- B su B: resta
INSERT INTO public.favorites (user_id, tour_id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002');
INSERT INTO public.user_photos (user_id, tour_id, media_url) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'a.jpg'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'b-su-tour-di-a.jpg'),  -- bloccherebbe la cancellazione del tour di A
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'b.jpg');
INSERT INTO public.reviews (tour_id, guide_id, user_id, comment) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A recensisce B'),
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B recensisce A (guida)'),
  ('b1000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'B su B');
INSERT INTO public.guide_requests (user_id, guide_id, tour_id, request_text) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', NULL, 'A chiede a B'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'B chiede ad A');
INSERT INTO public.notifications (user_id, title) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'x'), ('bbbbbbbb-0000-0000-0000-000000000002', 'y');
INSERT INTO public.saved_tours (user_id, stops) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '[]'), ('bbbbbbbb-0000-0000-0000-000000000002', '[]');
INSERT INTO public.completed_tours (user_id, tour_id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 't'), ('bbbbbbbb-0000-0000-0000-000000000002', 't');
INSERT INTO public.dna_events (user_id, kind) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'k'), ('bbbbbbbb-0000-0000-0000-000000000002', 'k');
INSERT INTO public.user_preferences (user_id, preference_data) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '{}'), ('bbbbbbbb-0000-0000-0000-000000000002', '{}');
INSERT INTO public.ai_quota_daily VALUES ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 3), ('bbbbbbbb-0000-0000-0000-000000000002', current_date, 3);
INSERT INTO public.ai_quota_test_account VALUES ('aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO public.ai_quota_ospite VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 1), ('bbbbbbbb-0000-0000-0000-000000000002', 1);
INSERT INTO public.nav_events (user_id, event_type) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'e'), ('bbbbbbbb-0000-0000-0000-000000000002', 'e');
INSERT INTO public.error_logs (user_id, message) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'e'), ('bbbbbbbb-0000-0000-0000-000000000002', 'e'), (NULL, 'senza utente');
INSERT INTO public.ai_generation_ticket (subject, kind) VALUES ('user:aaaaaaaa-0000-0000-0000-000000000001', 'itinerary'), ('ospite:aaaaaaaa-0000-0000-0000-000000000001', 'home_tours'),
  ('user:bbbbbbbb-0000-0000-0000-000000000002', 'itinerary'), ('guest:abc123', 'itinerary');
INSERT INTO public.waitlist (email, city) VALUES ('Anna@Example.com', 'Roma'), ('bruno@example.com', 'Roma');
INSERT INTO public.place_racconti VALUES ('p1', 'racconto di un luogo');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('tour-images', 'a/1.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'), ('business-media', 'a/2.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('tour-images', 'b/1.jpg', 'bbbbbbbb-0000-0000-0000-000000000002'), ('voce-cache', 'frase.mp3', NULL);
SQL

echo "→ PRIMA: senza la funzione la cancellazione dell'utente si blocca sulle FK (è il motivo della migration)"
if psql -c "DELETE FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'" >/dev/null 2>&1; then
  echo "ATTESO un blocco sulle FK, invece la DELETE è passata"; exit 1
fi
echo "   bloccata, come previsto"

echo "→ un utente normale NON può chiamare la funzione (solo service_role)"
if psql -c "SET ROLE authenticated; SELECT public.elimina_dati_utente('bbbbbbbb-0000-0000-0000-000000000002')" >/dev/null 2>&1; then
  echo "authenticated ha potuto chiamare la funzione"; exit 1
fi
if psql -c "SET ROLE anon; SELECT public.elimina_dati_utente('bbbbbbbb-0000-0000-0000-000000000002')" >/dev/null 2>&1; then
  echo "anon ha potuto chiamare la funzione"; exit 1
fi

echo "→ cancello A come service_role (funzione + utente di auth), due volte (idempotente)"
FILES=$(psql -At -c "SET ROLE service_role; SELECT public.elimina_dati_utente('aaaaaaaa-0000-0000-0000-000000000001', 'anna@example.com')" | tail -1)
echo "   file da togliere: $FILES"
case "$FILES" in *'a/1.jpg'*'a/2.jpg'*|*'a/2.jpg'*'a/1.jpg'*) ;; *) echo "mancano i file di A"; exit 1;; esac
case "$FILES" in *'b/1.jpg'*|*'frase.mp3'*) echo "la lista contiene file non suoi"; exit 1;; esac
psql -c "DELETE FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'"
psql -c "SET ROLE service_role; SELECT public.elimina_dati_utente('aaaaaaaa-0000-0000-0000-000000000001', 'anna@example.com')" >/dev/null

echo "→ conti: zero righe di A, intatte quelle di B"
psql <<'SQL'
DO $t$
DECLARE
    a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
    b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
    t text; n int;
    -- tabelle con una colonna utente: (tabella, colonna)
    tab text[][] := ARRAY[
        ['profiles','id'],['explorers','id'],['guides','id'],['guides_profile','id'],['tours','guide_id'],['activities','owner_id'],
        ['businesses_profile','user_id'],['bookings','user_id'],['favorites','user_id'],['user_photos','user_id'],['reviews','user_id'],
        ['reviews','guide_id'],['guide_requests','user_id'],['guide_requests','guide_id'],['notifications','user_id'],['saved_tours','user_id'],
        ['completed_tours','user_id'],['dna_events','user_id'],['user_preferences','user_id'],['ai_quota_daily','user_id'],
        ['ai_quota_test_account','user_id'],['ai_quota_ospite','user_id'],['nav_events','user_id'],['error_logs','user_id']];
BEGIN
    FOR i IN 1..array_length(tab, 1) LOOP
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', tab[i][1], tab[i][2]) INTO n USING a;
        IF n <> 0 THEN RAISE EXCEPTION 'A ha ancora % righe in %.%', n, tab[i][1], tab[i][2]; END IF;
    END LOOP;
    SELECT count(*) INTO n FROM auth.users WHERE id = a;                                   IF n <> 0 THEN RAISE EXCEPTION 'auth.users di A c''è ancora'; END IF;
    SELECT count(*) INTO n FROM public.ai_generation_ticket WHERE subject LIKE '%' || a::text; IF n <> 0 THEN RAISE EXCEPTION 'biglietti di A ancora lì'; END IF;
    SELECT count(*) INTO n FROM public.waitlist WHERE lower(email) = 'anna@example.com';   IF n <> 0 THEN RAISE EXCEPTION 'lista d''attesa di A ancora lì'; END IF;
    SELECT count(*) INTO n FROM public.bookings WHERE tour_id = 'a1000000-0000-0000-0000-000000000001'; IF n <> 0 THEN RAISE EXCEPTION 'prenotazioni dei tour di A ancora lì'; END IF;
    SELECT count(*) INTO n FROM public.user_photos WHERE tour_id = 'a1000000-0000-0000-0000-000000000001'; IF n <> 0 THEN RAISE EXCEPTION 'foto sui tour di A ancora lì'; END IF;

    -- B intatto: ogni tabella ha ancora le sue righe
    FOR i IN 1..array_length(tab, 1) LOOP
        CONTINUE WHEN tab[i][1] IN ('ai_quota_test_account','guides','guides_profile','reviews') AND tab[i][2] <> 'user_id';
        CONTINUE WHEN tab[i][1] IN ('ai_quota_test_account','guides','guides_profile','businesses_profile','guide_requests') AND tab[i][2] <> 'id' AND tab[i][1] <> 'guide_requests';
        CONTINUE WHEN tab[i][1] = 'guide_requests';   -- le richieste tra A e B spariscono tutte con A (una verso A, una da A)
        CONTINUE WHEN tab[i][1] = 'reviews' AND tab[i][2] = 'guide_id';
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', tab[i][1], tab[i][2]) INTO n USING b;
        IF n = 0 THEN RAISE EXCEPTION 'B ha perso le righe di %.%', tab[i][1], tab[i][2]; END IF;
    END LOOP;
    SELECT count(*) INTO n FROM public.bookings WHERE user_id = b; IF n <> 1 THEN RAISE EXCEPTION 'B: prenotazioni %, attese 1', n; END IF;
    SELECT count(*) INTO n FROM public.user_photos WHERE user_id = b; IF n <> 1 THEN RAISE EXCEPTION 'B: foto %, attese 1', n; END IF;
    SELECT count(*) INTO n FROM public.reviews WHERE user_id = b; IF n <> 1 THEN RAISE EXCEPTION 'B: recensioni %, attese 1', n; END IF;
    SELECT count(*) INTO n FROM public.tours WHERE guide_id = b; IF n <> 1 THEN RAISE EXCEPTION 'B: tour %, attesi 1', n; END IF;
    SELECT count(*) INTO n FROM public.ai_generation_ticket; IF n <> 2 THEN RAISE EXCEPTION 'biglietti rimasti %, attesi 2 (B e guest)', n; END IF;
    SELECT count(*) INTO n FROM public.waitlist WHERE lower(email) = 'bruno@example.com'; IF n <> 1 THEN RAISE EXCEPTION 'lista d''attesa di B persa'; END IF;
    SELECT count(*) INTO n FROM public.error_logs WHERE user_id IS NULL; IF n <> 1 THEN RAISE EXCEPTION 'errori senza utente: %, attesi 1', n; END IF;
    SELECT count(*) INTO n FROM public.place_racconti; IF n <> 1 THEN RAISE EXCEPTION 'la cache dei luoghi non è dell''utente e non va toccata'; END IF;
    SELECT count(*) INTO n FROM storage.objects; IF n <> 4 THEN RAISE EXCEPTION 'la funzione non deve toccare storage.objects (lo fa l''API): %', n; END IF;
END
$t$;
SQL
echo "TUTTO OK"
