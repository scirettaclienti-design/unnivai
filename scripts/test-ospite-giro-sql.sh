#!/usr/bin/env bash
# OSPITE-GIRO — prova a secco la migration 20261102200000_ospite_giro.sql su un Postgres 17 vero (Docker), dopo le migration
# della quota, con auth/profiles/ruoli finti come su Supabase. Non tocca nessun database remoto.
# Uso: bash scripts/test-ospite-giro-sql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/supabase/migrations"
NAME="dv-ospite-giro-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 0.5
done
sleep 1

psql() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ schema finto Supabase (auth con jwt(), profiles, tabelle condivise, ruoli)"
psql <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), is_unlimited boolean DEFAULT false);
INSERT INTO auth.users VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004'),
  ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64');  -- l'account di prova, registrato da 20261010190304
INSERT INTO public.profiles VALUES ('11111111-1111-1111-1111-111111111111', false), ('cee972ab-10ed-48b8-a3e9-bfd53cf66e64', false);

-- Le tabelle condivise (solo le colonne che servono) con le policy permissive di produzione.
CREATE TABLE public.reviews (id serial PRIMARY KEY, user_id uuid, testo text);
CREATE TABLE public.notifications (id serial PRIMARY KEY, user_id uuid, titolo text);
CREATE TABLE public.dna_events (id serial PRIMARY KEY, user_id uuid, kind text);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can send cross-user notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() IS NOT NULL) AND (user_id IS NOT NULL) AND (user_id <> auth.uid()));
CREATE POLICY dna_events_insert_own ON public.dna_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
SQL

echo "→ migration della quota, in ordine"
for f in 20260629205117_dvai_050_ai_quota_daily 20261005152005_ai_quota_server_side 20261006234203_ai_ticket_itinerary_3_calls \
         20261008121113_ai_quota_refund 20261008131546_ai_ticket_itinerary_4_calls 20261010190304_ai_quota_test_account \
         20261021120000_ai_quota_test_senza_contatori 20261029120000_ai_quota_tetto_contorno; do
  psql < "$M/$f.sql"
done

echo "→ applico la migration nuova (due volte: deve essere ripetibile)"
psql < "$M/20261102200000_ospite_giro.sql"
psql < "$M/20261102200000_ospite_giro.sql"

echo "→ asserzioni sui tetti"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;

SET ROLE service_role;
-- giri 1, per te 2, ip 3, ospiti 4, globale 1000
CREATE FUNCTION pg_temp.g(u text, ip text, kind text, t uuid DEFAULT gen_random_uuid(), ospiti int DEFAULT 4, glob int DEFAULT 1000)
RETURNS jsonb LANGUAGE sql AS $$ SELECT public.ai_quota_ospite(u::uuid, ip, t, kind, 1, 2, 3, ospiti, glob) $$;

DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); BEGIN
  -- Ospite nuovo: il primo giro passa e conta una volta (account, IP, ospiti, globale).
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'itinerary', t);
  PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ok', 'ospite nuovo: primo giro ammesso');
  PERFORM pg_temp.ok((SELECT giri FROM ai_quota_ospite WHERE user_id = 'd0000000-0000-0000-0000-000000000001') = 1, 'account: giri = 1');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_ospiti_ip WHERE ip_hash = 'ip-a') = 1, 'IP: 1');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_ospiti_global) = 1 AND (SELECT count FROM ai_quota_global) = 1, 'ospiti e globale: 1');

  -- Stesso biglietto: le chiamate successive della generazione non contano.
  FOR i IN 1..3 LOOP
    r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'itinerary', t);
    PERFORM pg_temp.ok((r->>'allowed')::boolean AND r->>'reason' = 'ticket', format('stesso biglietto, chiamata %s: non conta', i + 1));
  END LOOP;
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'itinerary', t);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'stesso biglietto, 5a chiamata: rifiutata');
  -- Il biglietto di un altro ospite non vale.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000002', 'ip-a', 'itinerary', t);
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ticket', 'biglietto di un altro: rifiutato');

  -- Secondo giro dello stesso ospite: rifiutato, nessun contatore si muove.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'itinerary');
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ospite_giro', 'secondo giro: ospite_giro');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_ospiti_ip WHERE ip_hash = 'ip-a') = 1, 'secondo giro: IP fermo a 1');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global) = 1, 'secondo giro: globale fermo a 1');

  -- Per Te: due, poi ospite_per_te.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'home_tours');
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'Per Te 1: ammesso');
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-a', 'home_tours');
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'Per Te 2: ammesso');
  r := pg_temp.g('d0000000-0000-0000-0000-000000000001', 'ip-b', 'home_tours');
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ospite_per_te', 'Per Te 3: ospite_per_te');

  -- IP: ip-a ha 3 generazioni (cap 3): un ospite nuovo dalla stessa rete e' fermato, l'account non resta contato.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000002', 'ip-a', 'itinerary');
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ospite_ip', 'tetto IP: ospite_ip');
  PERFORM pg_temp.ok(coalesce((SELECT giri FROM ai_quota_ospite WHERE user_id = 'd0000000-0000-0000-0000-000000000002'), 0) = 0,
                     'tetto IP: il giro dell''ospite 2 non resta contato');
  r := pg_temp.g('d0000000-0000-0000-0000-000000000002', 'ip-c', 'itinerary');
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'da un''altra rete: ammesso');

  -- Ospiti: 4 generazioni oggi (cap 4) → il prossimo ospite e' fermato, IP e account non restano contati.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000003', 'ip-d', 'itinerary');
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'ospiti', 'tetto ospiti: ospiti');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_ospiti_ip WHERE ip_hash = 'ip-d'), 'tetto ospiti: IP non contato');
  PERFORM pg_temp.ok(coalesce((SELECT giri FROM ai_quota_ospite WHERE user_id = 'd0000000-0000-0000-0000-000000000003'), 0) = 0,
                     'tetto ospiti: account non contato');
  -- Un utente registrato non passa da qui e non e' fermato dal tetto degli ospiti.
  r := public.ai_quota_consume('user', '11111111-1111-1111-1111-111111111111', 'generation', gen_random_uuid(), 'itinerary', 10, 1000, NULL);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'utente registrato: tetto ospiti pieno, passa');

  -- Globale dell'app pieno: ferma anche l'ospite (reason global), senza lasciare contatori.
  r := pg_temp.g('d0000000-0000-0000-0000-000000000004', 'ip-e', 'itinerary', gen_random_uuid(), 100, (SELECT count FROM ai_quota_global));
  PERFORM pg_temp.ok(NOT (r->>'allowed')::boolean AND r->>'reason' = 'global', 'globale pieno: global');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_ospiti_ip WHERE ip_hash = 'ip-e'), 'globale pieno: IP non contato');
END $$;

DO $$ DECLARE r jsonb; t uuid := gen_random_uuid(); g0 int; o0 int; BEGIN
  -- Rimborso: il motore si e' fermato, il giro torna disponibile.
  DELETE FROM ai_quota_ospiti_global;
  g0 := (SELECT count FROM ai_quota_global);
  r := pg_temp.g('d0000000-0000-0000-0000-000000000004', 'ip-f', 'itinerary', t);
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'rimborso: giro ammesso');
  r := public.ai_quota_ospite_rimborso('d0000000-0000-0000-0000-000000000002', 'ip-f', t);
  PERFORM pg_temp.ok(NOT (r->>'refunded')::boolean, 'rimborso del biglietto di un altro: no');
  r := public.ai_quota_ospite_rimborso('d0000000-0000-0000-0000-000000000004', 'ip-f', t);
  PERFORM pg_temp.ok((r->>'refunded')::boolean, 'rimborso: fatto');
  PERFORM pg_temp.ok((SELECT giri FROM ai_quota_ospite WHERE user_id = 'd0000000-0000-0000-0000-000000000004') = 0, 'rimborso: account a 0');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_ospiti_ip WHERE ip_hash = 'ip-f') = 0, 'rimborso: IP a 0');
  PERFORM pg_temp.ok((SELECT count FROM ai_quota_global) = g0, 'rimborso: globale come prima');
  r := pg_temp.g('d0000000-0000-0000-0000-000000000004', 'ip-f', 'itinerary');
  PERFORM pg_temp.ok((r->>'allowed')::boolean, 'dopo il rimborso: il giro si fa');
END $$;

-- La registrazione tiene lo stesso id: l'account resta contato (nessuna riga da spostare).
-- Cancellare l'utente anonimo cancella il suo contatore.
RESET ROLE;
DELETE FROM auth.users WHERE id = 'd0000000-0000-0000-0000-000000000003';
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM ai_quota_ospite WHERE user_id = 'd0000000-0000-0000-0000-000000000003'), 'utente cancellato: contatore cancellato');

-- Sicurezza: tabelle chiuse, funzioni solo service_role.
SELECT pg_temp.ok(NOT has_table_privilege('anon', 'public.ai_quota_ospite', 'SELECT')
                  AND NOT has_table_privilege('authenticated', 'public.ai_quota_ospite', 'INSERT')
                  AND NOT has_table_privilege('authenticated', 'public.ai_quota_ospiti_ip', 'SELECT')
                  AND NOT has_table_privilege('authenticated', 'public.ai_quota_ospiti_global', 'UPDATE'), 'tabelle chiuse ad anon/authenticated');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public.ai_quota_ospite(uuid,text,uuid,text,integer,integer,integer,integer,integer)', 'EXECUTE')
                  AND NOT has_function_privilege('anon', 'public.ai_quota_ospite_rimborso(uuid,text,uuid)', 'EXECUTE')
                  AND has_function_privilege('service_role', 'public.ai_quota_ospite(uuid,text,uuid,text,integer,integer,integer,integer,integer)', 'EXECUTE'),
                  'funzioni solo service_role');
SQL

echo "→ asserzioni sulle policy (un ospite non scrive dove lo leggono gli altri)"
psql <<'SQL'
CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLITO: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;
CREATE FUNCTION pg_temp.come(uid text, anonimo boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'is_anonymous', anonimo)::text, false);
END $$;
CREATE FUNCTION pg_temp.prova(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN true; EXCEPTION WHEN insufficient_privilege THEN RETURN false; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.prova(text) TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

SELECT pg_temp.come('d0000000-0000-0000-0000-000000000001', true);
SET ROLE authenticated;
SELECT pg_temp.ok(NOT pg_temp.prova($q$INSERT INTO public.reviews (user_id, testo) VALUES ('d0000000-0000-0000-0000-000000000001', 'x')$q$),
                  'ospite: niente recensioni');
SELECT pg_temp.ok(NOT pg_temp.prova($q$INSERT INTO public.notifications (user_id, titolo) VALUES ('11111111-1111-1111-1111-111111111111', 'x')$q$),
                  'ospite: niente notifiche a un altro');
SELECT pg_temp.ok(pg_temp.prova($q$INSERT INTO public.notifications (user_id, titolo) VALUES ('d0000000-0000-0000-0000-000000000001', 'x')$q$),
                  'ospite: le sue notifiche sì');
SELECT pg_temp.ok(pg_temp.prova($q$INSERT INTO public.dna_events (user_id, kind) VALUES ('d0000000-0000-0000-0000-000000000001', 'tour_completed')$q$),
                  'ospite: il suo DNA sì');
RESET ROLE;

SELECT pg_temp.come('11111111-1111-1111-1111-111111111111', false);
SET ROLE authenticated;
SELECT pg_temp.ok(pg_temp.prova($q$INSERT INTO public.reviews (user_id, testo) VALUES ('11111111-1111-1111-1111-111111111111', 'x')$q$),
                  'utente registrato: recensione sì');
SELECT pg_temp.ok(pg_temp.prova($q$INSERT INTO public.notifications (user_id, titolo) VALUES ('d0000000-0000-0000-0000-000000000001', 'x')$q$),
                  'utente registrato: notifica a un altro come prima');
RESET ROLE;

-- Dopo la registrazione (stesso id, is_anonymous false) l'ospite scrive come tutti.
SELECT pg_temp.come('d0000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;
SELECT pg_temp.ok(pg_temp.prova($q$INSERT INTO public.reviews (user_id, testo) VALUES ('d0000000-0000-0000-0000-000000000001', 'x')$q$),
                  'ospite registrato: recensione sì');
RESET ROLE;
SQL
echo "TUTTO OK"
