#!/usr/bin/env bash
# QUOTA-CONTORNO — prova a secco la migration 20261029120000_ai_quota_tetto_contorno.sql su un Postgres 17 vero (Docker),
# dopo le migration precedenti della quota, con auth/profiles/ruoli finti come su Supabase. Non tocca nessun database remoto.
# Uso: bash scripts/test-ai-quota-contorno-sql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/supabase/migrations"
NAME="dv-quota-contorno-test-$$"

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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), is_unlimited boolean DEFAULT false);
INSERT INTO auth.users VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64');
INSERT INTO public.profiles VALUES
  ('11111111-1111-1111-1111-111111111111', false),
  ('22222222-2222-2222-2222-222222222222', false),
  ('33333333-3333-3333-3333-333333333333', true),
  ('44444444-4444-4444-4444-444444444444', false),
  ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64', false);
SQL

echo "→ migration della quota, in ordine"
for f in 20260629205117_dvai_050_ai_quota_daily 20261005152005_ai_quota_server_side 20261006234203_ai_ticket_itinerary_3_calls \
         20261008121113_ai_quota_refund 20261008131546_ai_ticket_itinerary_4_calls 20261010190304_ai_quota_test_account \
         20261021120000_ai_quota_test_senza_contatori; do
  psql < "$M/$f.sql"
done

echo "→ firma a 7 parametri (vecchio proxy) PRIMA della migration nuova"
psql <<'SQL'
SET ROLE service_role;
SELECT public.ai_quota_consume('guest', 'vecchio', 'aux', NULL, NULL, 15, 1000) -> 'allowed' AS vecchio_prima;
SQL

echo "→ applico la migration nuova (due volte: deve essere ripetibile)"
psql < "$M/20261029120000_ai_quota_tetto_contorno.sql"
psql < "$M/20261029120000_ai_quota_tetto_contorno.sql"

echo "→ asserzioni"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;

SET ROLE service_role;
CREATE FUNCTION pg_temp.aux(subj_kind text, subj text, lim int, auxcap int)
RETURNS jsonb LANGUAGE sql AS $$ SELECT public.ai_quota_consume(subj_kind, subj, 'aux', NULL, NULL, lim, 1000, auxcap) $$;

DO $$ DECLARE r jsonb; BEGIN
  -- Sotto tetto: tre ospiti diversi passano, il contatore globale conta 3.
  FOR i IN 1..3 LOOP
    r := pg_temp.aux('guest', 'ospite-' || i, 15, 3);
    PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ok', format('sotto tetto: ospite %s ammesso', i));
  END LOOP;
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global_aux) = 3, 'contatore globale contorno = 3');

  -- Tetto raggiunto: il 4° sconosciuto e' fermato, con reason global_aux, e il suo contatore personale NON sale.
  r := pg_temp.aux('guest', 'ospite-4', 15, 3);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global_aux', 'tetto raggiunto: ospite 4 rifiutato (global_aux)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_guest WHERE ip_hash = 'ospite-4'), 'tetto raggiunto: nessun incremento personale lasciato indietro');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global_aux) = 3, 'tetto raggiunto: contatore globale fermo a 3');

  -- Anche un utente normale e' fermato; la generazione NON e' toccata dal tetto del contorno.
  r := pg_temp.aux('user', '11111111-1111-1111-1111-111111111111', 40, 3);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global_aux', 'tetto raggiunto: utente normale rifiutato');
  r := public.ai_quota_consume('user', '11111111-1111-1111-1111-111111111111', 'generation', gen_random_uuid(), 'itinerary', 10, 1000, 3);
  PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ok', 'tetto del contorno pieno: la generazione passa lo stesso');

  -- Esenti da profiles.is_unlimited: passano col tetto pieno e non muovono il contatore.
  r := pg_temp.aux('user', '33333333-3333-3333-3333-333333333333', 40, 3);
  PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'unlimited', 'is_unlimited: passa col tetto pieno');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global_aux) = 3, 'is_unlimited: contatore globale fermo');

  -- Limite personale: scatta prima del globale e non consuma il globale.
  DELETE FROM ai_quota_global_aux;
  FOR i IN 1..2 LOOP PERFORM pg_temp.aux('guest', 'solo', 2, 100); END LOOP;
  r := pg_temp.aux('guest', 'solo', 2, 100);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'limit', 'limite personale: 3a chiamata rifiutata (limit)');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global_aux) = 2, 'limite personale: il globale non e'' consumato dalla rifiutata');

  -- Tetto 0 = chiuso per tutti; NULL (vecchio proxy) = nessun tetto.
  r := pg_temp.aux('guest', 'zero', 15, 0);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global_aux', 'tetto 0: tutti fermati');
  r := public.ai_quota_consume('guest', 'vecchio', 'aux', NULL, NULL, 15, 1000);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'firma a 7 parametri (vecchio proxy) ancora valida, senza tetto');
END $$;

-- Sicurezza: il contatore non e' leggibile ne' scrivibile da anon/authenticated; la funzione solo da service_role.
RESET ROLE;
SELECT pg_temp.ok(NOT has_table_privilege('anon', 'public.ai_quota_global_aux', 'SELECT')
                  AND NOT has_table_privilege('authenticated', 'public.ai_quota_global_aux', 'INSERT'), 'tabella chiusa ad anon/authenticated');
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.ai_quota_consume(text,text,text,uuid,text,integer,integer,integer)', 'EXECUTE')
                  AND NOT has_function_privilege('authenticated', 'public.ai_quota_consume(text,text,text,uuid,text,integer,integer,integer)', 'EXECUTE')
                  AND has_function_privilege('service_role', 'public.ai_quota_consume(text,text,text,uuid,text,integer,integer,integer)', 'EXECUTE'), 'funzione solo service_role');
SQL
echo "TUTTO OK"
