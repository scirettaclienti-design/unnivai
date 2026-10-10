#!/usr/bin/env bash
# Gate QUOTA-SERVER — prova le migration 20261005_ai_quota_server_side.sql e
# 20261006_ai_ticket_itinerary_3_calls.sql su un
# Postgres 17 vero (Docker), con auth/profiles/ruoli finti come su Supabase.
# Non tocca nessun database remoto. Uso: bash scripts/test-ai-quota-sql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261005_ai_quota_server_side.sql"
# Biglietto 'itinerary' a 3 chiamate (traduttore + selettore + narratore).
MIGRATION_3CALLS="$ROOT/supabase/migrations/20261006_ai_ticket_itinerary_3_calls.sql"
# Gate P8b — rimborso della generazione quando OpenAI fallisce.
MIGRATION_REFUND="$ROOT/supabase/migrations/20261008_ai_quota_refund.sql"
# Gate P3d-c — biglietto 'itinerary' a 4 chiamate (+ riscrittura).
MIGRATION_4CALLS="$ROOT/supabase/migrations/20261008_ai_ticket_itinerary_4_calls.sql"
# TEST-ACC — l'account di prova senza tetto personale.
MIGRATION_TESTACC="$ROOT/supabase/migrations/20261010_ai_quota_test_account.sql"
NAME="dv-quota-sql-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 0.5
done
sleep 1

psql() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ schema finto Supabase (auth, profiles, ruoli)"
psql <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Come Supabase: privilegi di default ampi per anon/authenticated sulle nuove tabelle.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), is_unlimited boolean DEFAULT false);
INSERT INTO auth.users VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64'),
  ('44444444-4444-4444-4444-444444444444');
INSERT INTO public.profiles VALUES
  ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64', false),
  ('44444444-4444-4444-4444-444444444444', false),
  ('11111111-1111-1111-1111-111111111111', false),
  ('22222222-2222-2222-2222-222222222222', false),
  ('33333333-3333-3333-3333-333333333333', true);
-- Stato di produzione PRIMA della migration (05/10/2026): tabella + policy insert/update.
CREATE TABLE public.ai_quota_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day));
ALTER TABLE public.ai_quota_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_quota_select_own ON public.ai_quota_daily FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_quota_insert_own ON public.ai_quota_daily FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_quota_update_own ON public.ai_quota_daily FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
INSERT INTO public.ai_quota_daily (user_id, day, count)
  VALUES ('22222222-2222-2222-2222-222222222222', (now() AT TIME ZONE 'Europe/Rome')::date, 3);
SQL

echo "→ applico la migration (due volte: deve essere idempotente)"
psql < "$MIGRATION"
psql < "$MIGRATION"
psql < "$MIGRATION_3CALLS"
psql < "$MIGRATION_3CALLS"
psql < "$MIGRATION_REFUND"
psql < "$MIGRATION_REFUND"
psql < "$MIGRATION_4CALLS"
psql < "$MIGRATION_4CALLS"
psql < "$MIGRATION_TESTACC"
psql < "$MIGRATION_TESTACC"

echo "→ asserzioni"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;

SET ROLE service_role;
CREATE FUNCTION pg_temp.gen(subj_kind text, subj text, ticket uuid, lim int, cap int, kind text DEFAULT 'itinerary')
RETURNS jsonb LANGUAGE sql AS $$ SELECT public.ai_quota_consume(subj_kind, subj, 'generation', ticket, kind, lim, cap) $$;

-- Utente: 10 generazioni, l'11a rifiutata. Ogni biglietto vale 2 chiamate.
DO $$ DECLARE r jsonb; t uuid; BEGIN
  FOR i IN 1..10 LOOP
    t := gen_random_uuid();
    r := pg_temp.gen('user', '11111111-1111-1111-1111-111111111111', t, 10, 1000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean, format('utente generazione %s ammessa', i));
    r := pg_temp.gen('user', '11111111-1111-1111-1111-111111111111', t, 10, 1000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ticket', format('utente generazione %s, 2a chiamata sullo stesso biglietto', i));
  END LOOP;
  r := pg_temp.gen('user', '11111111-1111-1111-1111-111111111111', gen_random_uuid(), 10, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'limit', 'utente: 11a generazione rifiutata');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = '11111111-1111-1111-1111-111111111111') = 10, 'contatore utente fermo a 10');
END $$;

-- Biglietto 'itinerary' (P3d-c): la 4a chiamata (riscrittura) passa, la 5a e' rifiutata; un biglietto altrui e' rifiutato.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); BEGIN
  PERFORM pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000);
  PERFORM pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000);
  r := pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000);
  PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto itinerary: 3a chiamata ammessa');
  r := pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000);
  PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto itinerary: 4a chiamata (riscrittura) ammessa');
  r := pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto itinerary: 5a chiamata rifiutata');
  r := pg_temp.gen('guest', 'hash-x', (SELECT id FROM ai_generation_ticket LIMIT 1), 5, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto di un altro soggetto rifiutato');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = '22222222-2222-2222-2222-222222222222') = 4, 'riga preesistente (3) +1 = 4');
END $$;

-- Ospite: 5 per IP, la 6a rifiutata; un altro IP no.
DO $$ DECLARE r jsonb; BEGIN
  FOR i IN 1..5 LOOP
    r := pg_temp.gen('guest', 'hash-a', gen_random_uuid(), 5, 1000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean, format('ospite generazione %s ammessa', i));
  END LOOP;
  r := pg_temp.gen('guest', 'hash-a', gen_random_uuid(), 5, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'limit', 'ospite: 6a generazione rifiutata');
  r := pg_temp.gen('guest', 'hash-b', gen_random_uuid(), 5, 1000);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'ospite con altro IP ammesso');
END $$;

-- Tetto globale: oggi siamo a 10+1+5+1 = 17 generazioni. Con cap 18 ne passa 1.
DO $$ DECLARE r jsonb; g int; BEGIN
  g := (SELECT count FROM ai_quota_global);
  PERFORM pg_temp.ok(g = 17, format('globale conta tutte le generazioni (%s)', g));
  r := pg_temp.gen('guest', 'hash-c', gen_random_uuid(), 5, 18);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'globale: 18a ammessa con cap 18');
  r := pg_temp.gen('guest', 'hash-d', gen_random_uuid(), 5, 18);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global', 'globale: 19a rifiutata con cap 18');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_guest WHERE ip_hash = 'hash-d'), 'rifiuto globale annulla anche il contatore personale');
END $$;

-- is_unlimited: nessun limite personale, ma conta nel globale.
DO $$ DECLARE r jsonb; BEGIN
  FOR i IN 1..12 LOOP
    r := pg_temp.gen('user', '33333333-3333-3333-3333-333333333333', gen_random_uuid(), 10, 1000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean, format('unlimited generazione %s', i));
  END LOOP;
END $$;

-- home_tours: il tipo del biglietto torna anche sulla 2a chiamata; resta a 2 chiamate.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); BEGIN
  PERFORM pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000, 'home_tours');
  r := pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000, 'itinerary');
  PERFORM pg_temp.ok(r->>'ticket_kind' = 'home_tours', 'tipo biglietto fissato alla creazione');
  r := pg_temp.gen('user', '22222222-2222-2222-2222-222222222222', t, 10, 1000, 'itinerary');
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto home_tours: 3a chiamata rifiutata');
END $$;

-- Chiamate di contorno: 40 per utente, 15 per ospite.
DO $$ DECLARE r jsonb; BEGIN
  FOR i IN 1..40 LOOP
    r := public.ai_quota_consume('user', '11111111-1111-1111-1111-111111111111', 'aux', NULL, NULL, 40, 1000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean, format('aux utente %s', i));
  END LOOP;
  r := public.ai_quota_consume('user', '11111111-1111-1111-1111-111111111111', 'aux', NULL, NULL, 40, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean, 'aux utente: 41a rifiutata');
  FOR i IN 1..15 LOOP
    PERFORM public.ai_quota_consume('guest', 'hash-a', 'aux', NULL, NULL, 15, 1000);
  END LOOP;
  r := public.ai_quota_consume('guest', 'hash-a', 'aux', NULL, NULL, 15, 1000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean, 'aux ospite: 16a rifiutata');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = '11111111-1111-1111-1111-111111111111') = 10, 'aux non tocca il contatore generazioni');
END $$;

-- Input non valido → eccezione (la Edge Function risponde 503).
DO $$ BEGIN
  BEGIN
    PERFORM public.ai_quota_consume('admin', 'x', 'generation', gen_random_uuid(), 'itinerary', 10, 1000);
    RAISE EXCEPTION 'FALLITO: soggetto non valido accettato';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLITO%' THEN RAISE; END IF;
    RAISE NOTICE 'ok  soggetto non valido → eccezione';
  END;
END $$;
RESET ROLE;

-- Giorno Europe/Rome.
SELECT pg_temp.ok((SELECT day FROM ai_quota_global) = (now() AT TIME ZONE 'Europe/Rome')::date, 'giorno = data di Roma');

-- Utente autenticato: legge solo la propria riga, non scrive, non chiama la funzione.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
SELECT pg_temp.ok((SELECT count(*) FROM ai_quota_daily) = 1, 'authenticated vede solo la propria riga');
DO $$ BEGIN
  BEGIN UPDATE ai_quota_daily SET count = 0; RAISE EXCEPTION 'FALLITO: update ammesso';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: UPDATE negato'; END;
  BEGIN INSERT INTO ai_quota_daily (user_id, day, count) VALUES ('11111111-1111-1111-1111-111111111111', '2000-01-01', 0); RAISE EXCEPTION 'FALLITO: insert ammesso';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: INSERT negato'; END;
  BEGIN DELETE FROM ai_quota_daily; RAISE EXCEPTION 'FALLITO: delete ammesso';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: DELETE negato'; END;
  BEGIN PERFORM public.ai_quota_consume('user', '11111111-1111-1111-1111-111111111111', 'aux', NULL, NULL, 999, 999); RAISE EXCEPTION 'FALLITO: execute ammesso';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: ai_quota_consume negata'; END;
  BEGIN PERFORM 1 FROM ai_quota_guest; RAISE EXCEPTION 'FALLITO: select ospiti ammessa';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: ai_quota_guest illeggibile'; END;
END $$;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM ai_quota_daily; RAISE EXCEPTION 'FALLITO: anon legge';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  anon: ai_quota_daily illeggibile'; END;
  BEGIN PERFORM public.ai_quota_consume('guest', 'h', 'aux', NULL, NULL, 999, 999); RAISE EXCEPTION 'FALLITO: anon execute';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  anon: ai_quota_consume negata'; END;
END $$;
RESET ROLE;

SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_quota_daily' AND cmd <> 'SELECT'), 'su ai_quota_daily resta solo la policy SELECT');
SQL

echo "→ asserzioni rimborso (Gate P8b)"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;
SET ROLE service_role;

-- Ospite: generazione contata, poi rimborsata → personale e globale tornano indietro.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); g0 int; BEGIN
  g0 := coalesce((SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date), 0);
  r := public.ai_quota_consume('guest', 'hash-r', 'generation', t, 'itinerary', 5, 1000);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'rimborso ospite: generazione contata');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_guest WHERE ip_hash = 'hash-r') = 1, 'rimborso ospite: personale a 1');
  r := public.ai_quota_refund('guest', 'hash-r', t);
  PERFORM pg_temp.ok((r->>'refunded')::boolean, 'rimborso ospite: refunded=true');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_guest WHERE ip_hash = 'hash-r') = 0, 'rimborso ospite: personale torna a 0');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date) = g0, 'rimborso ospite: globale torna indietro');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_generation_ticket WHERE id = t), 'rimborso ospite: biglietto chiuso');
  r := public.ai_quota_refund('guest', 'hash-r', t);
  PERFORM pg_temp.ok(NOT (r->>'refunded')::boolean, 'rimborso ospite: il secondo rimborso dello stesso biglietto non fa niente');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_guest WHERE ip_hash = 'hash-r') = 0, 'rimborso ospite: mai sotto zero');
END $$;

-- Utente: rimborso personale e globale; biglietto altrui o inesistente: niente.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); c0 int; g0 int; BEGIN
  c0 := (SELECT count FROM ai_quota_daily WHERE user_id = '22222222-2222-2222-2222-222222222222' AND day = (now() AT TIME ZONE 'Europe/Rome')::date);
  g0 := (SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date);
  PERFORM public.ai_quota_consume('user', '22222222-2222-2222-2222-222222222222', 'generation', t, 'itinerary', 10, 1000);
  r := public.ai_quota_refund('guest', 'hash-intruso', t);
  PERFORM pg_temp.ok(NOT (r->>'refunded')::boolean, 'biglietto di un altro soggetto: nessun rimborso');
  r := public.ai_quota_refund('user', '22222222-2222-2222-2222-222222222222', gen_random_uuid());
  PERFORM pg_temp.ok(NOT (r->>'refunded')::boolean, 'biglietto inesistente: nessun rimborso');
  r := public.ai_quota_refund('user', '22222222-2222-2222-2222-222222222222', t);
  PERFORM pg_temp.ok((r->>'refunded')::boolean, 'rimborso utente: refunded=true');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = '22222222-2222-2222-2222-222222222222' AND day = (now() AT TIME ZONE 'Europe/Rome')::date) = c0, 'rimborso utente: personale torna indietro');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date) = g0, 'rimborso utente: globale torna indietro');
END $$;

-- Utente illimitato: il personale non era contato e non si tocca; il globale si.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); g0 int; BEGIN
  g0 := (SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date);
  PERFORM public.ai_quota_consume('user', '33333333-3333-3333-3333-333333333333', 'generation', t, 'itinerary', 10, 1000);
  r := public.ai_quota_refund('user', '33333333-3333-3333-3333-333333333333', t);
  PERFORM pg_temp.ok((r->>'refunded')::boolean, 'rimborso illimitato: refunded=true');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global WHERE day = (now() AT TIME ZONE 'Europe/Rome')::date) = g0, 'rimborso illimitato: globale torna indietro');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_daily WHERE user_id = '33333333-3333-3333-3333-333333333333' AND count < 0), 'rimborso illimitato: nessun contatore negativo');
END $$;

-- Il rimborso va al giorno in cui il biglietto e' stato aperto, non a oggi.
DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); ieri date := (now() AT TIME ZONE 'Europe/Rome')::date - 1; BEGIN
  INSERT INTO ai_quota_guest (ip_hash, day, count) VALUES ('hash-ieri', ieri, 2);
  INSERT INTO ai_quota_global (day, count) VALUES (ieri, 7);
  INSERT INTO ai_generation_ticket (id, subject, kind, created_at) VALUES (t, 'guest:hash-ieri', 'itinerary', now() - interval '1 day');
  r := public.ai_quota_refund('guest', 'hash-ieri', t);
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_guest WHERE ip_hash = 'hash-ieri' AND day = ieri) = 1, 'rimborso sul giorno del biglietto (personale)');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global WHERE day = ieri) = 6, 'rimborso sul giorno del biglietto (globale)');
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.ai_quota_refund('user', '11111111-1111-1111-1111-111111111111', gen_random_uuid()); RAISE EXCEPTION 'FALLITO: authenticated execute refund';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: ai_quota_refund negata'; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.ai_quota_refund('guest', 'h', gen_random_uuid()); RAISE EXCEPTION 'FALLITO: anon execute refund';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  anon: ai_quota_refund negata'; END;
END $$;
RESET ROLE;
SQL

echo "→ asserzioni account di prova (TEST-ACC)"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;
SET ROLE service_role;
DO $$ DECLARE r jsonb; i int; oggi date := (now() AT TIME ZONE 'Europe/Rome')::date; g int;
  normale text := '44444444-4444-4444-4444-444444444444'; prova text := 'cee972ab-10ed-48b8-a3e9-bfd53cf66e64'; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM ai_quota_test_account) = 1, 'una sola riga registrata');
  -- utente normale: 10 passano, l'11a no
  FOR i IN 1..10 LOOP
    r := public.ai_quota_consume('user', normale, 'generation', gen_random_uuid(), 'itinerary', 10, 100000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean, format('normale: generazione %s passa', i));
  END LOOP;
  r := public.ai_quota_consume('user', normale, 'generation', gen_random_uuid(), 'itinerary', 10, 100000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'limit', 'normale: 11a generazione bloccata');
  -- account di prova: 15 passano, contate, con etichetta 'test'
  FOR i IN 1..15 LOOP
    r := public.ai_quota_consume('user', prova, 'generation', gen_random_uuid(), 'itinerary', 10, 100000);
    PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'test', format('prova: generazione %s passa', i));
  END LOOP;
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = prova::uuid AND day = oggi) = 15, 'prova: le generazioni sono contate (15)');
  PERFORM pg_temp.ok((SELECT count(*) FROM ai_generation_ticket WHERE subject = 'user:' || prova AND label = 'test') = 15, 'prova: 15 biglietti con etichetta test');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_generation_ticket WHERE subject = 'user:' || normale AND label IS NOT NULL), 'normale: nessuna etichetta');
  -- contorno: anche li' niente tetto personale per la prova, si per il normale
  FOR i IN 1..45 LOOP r := public.ai_quota_consume('user', prova, 'aux', NULL, NULL, 40, 100000); END LOOP;
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'prova: 45a chiamata di contorno passa');
  -- tetto globale: vale anche per la prova
  g := (SELECT count FROM ai_quota_global WHERE day = oggi);
  r := public.ai_quota_consume('user', prova, 'generation', gen_random_uuid(), 'itinerary', 10, g);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global', 'prova: il tetto globale la blocca');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = prova::uuid AND day = oggi) = 15, 'prova: generazione rifiutata dal globale non contata');
  -- un ospite non e' mai la prova, nemmeno con lo stesso testo come soggetto
  FOR i IN 1..5 LOOP PERFORM public.ai_quota_consume('guest', prova, 'generation', gen_random_uuid(), 'itinerary', 5, 100000); END LOOP;
  r := public.ai_quota_consume('guest', prova, 'generation', gen_random_uuid(), 'itinerary', 5, 100000);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean, 'ospite con lo stesso id come soggetto: tetto normale');
  -- rimborso della prova: il personale torna indietro
  r := public.ai_quota_refund('user', prova, (SELECT id FROM ai_generation_ticket WHERE subject = 'user:' || prova LIMIT 1));
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_daily WHERE user_id = prova::uuid AND day = oggi) = 14, 'prova: rimborso del personale');
  -- una seconda riga e' impossibile
  BEGIN INSERT INTO ai_quota_test_account (user_id) VALUES (normale::uuid); RAISE EXCEPTION 'FALLITO: seconda riga';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok  seconda riga rifiutata'; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM public.ai_quota_test_account; RAISE EXCEPTION 'FALLITO: authenticated legge';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: lettura negata'; END;
  BEGIN INSERT INTO public.ai_quota_test_account (user_id) VALUES ('11111111-1111-1111-1111-111111111111'); RAISE EXCEPTION 'FALLITO: authenticated scrive';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  authenticated: scrittura negata'; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN INSERT INTO public.ai_quota_test_account (user_id) VALUES ('11111111-1111-1111-1111-111111111111'); RAISE EXCEPTION 'FALLITO: anon scrive';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  anon: scrittura negata'; END;
END $$;
RESET ROLE;
SQL

echo "✓ migration ai_quota: tutte le asserzioni passate"
