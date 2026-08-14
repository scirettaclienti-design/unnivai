-- ============================================================================
-- GATE SICUREZZA RLS — ROLLBACK
-- Data: 2026-08-14
--
-- NON È UNA MIGRATION. Sta fuori da supabase/migrations/ apposta: se il
-- migration runner lo replicasse, riaprirebbe il buco che il gate chiude.
--
-- Uso: incollare nell'SQL Editor SOLO la riga della tabella che ha fallito
-- la verifica. Le policy restano in piedi ma inerti (una policy su tabella
-- con RLS OFF non ha alcun effetto) → si torna allo stato pre-gate senza
-- perdere il lavoro fatto, e si corregge la policy prima di riprovare.
--
-- Regola: se una verifica è rossa, DISABLE immediato. Non si prosegue mai
-- con una verifica rossa.
-- ============================================================================

-- PASSO 1
ALTER TABLE public.guides          DISABLE ROW LEVEL SECURITY;

-- PASSO 2
ALTER TABLE public.bookings        DISABLE ROW LEVEL SECURITY;

-- PASSO 3 — guides_profile ha già RLS attiva PRIMA del gate.
-- Il rollback NON è un DISABLE (spegnerlo peggiorerebbe lo stato: da
-- "lettura pubblica di troppe colonne" a "scrittura libera per chiunque").
-- Il rollback è la RICREAZIONE delle tre policy rimosse dal passo 3.
--
-- Rollback COMPLETO (riapre il buco: riespone PIVA, numero di licenza,
-- URL documenti e commission_rate a chiunque abbia la anon key):
--   DROP POLICY IF EXISTS "guides_profile_select_own" ON public.guides_profile;
--   CREATE POLICY "Enable read access for all"
--       ON public.guides_profile FOR SELECT TO public USING (true);
--   CREATE POLICY "Guide profiles are viewable by everyone"
--       ON public.guides_profile FOR SELECT TO public USING (true);
--   CREATE POLICY "Enable all access for users"
--       ON public.guides_profile FOR ALL TO public
--       USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
--
-- Rollback PARZIALE, da preferire: se si rompe solo la lettura della
-- propria riga da parte della guida, ricreare la sola policy ALL su `id`
-- (l'ultimo CREATE qui sopra) senza riaprire le due USING (true).
-- Il rollback completo va tenuto acceso il minimo indispensabile.

-- PASSO 4
ALTER TABLE public.profiles        DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verifica che il rollback abbia avuto effetto:
--   select relname, relrowsecurity from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and relname in ('guides','bookings','guides_profile','profiles');
-- ============================================================================
